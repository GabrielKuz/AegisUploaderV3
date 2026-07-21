import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
} from "react";
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { useCustomerUpload } from "./CustomerUploadContext";
import {
    deleteUploadSession,
    getUploadSessions,
    saveUploadSession,
    type UploadSession,
} from "./indexedDb";

import "./CustomerUpload.css";

const FILE_CHUNK_SIZE = 32 * 1024 * 1024;
const HASH_CONCURRENCY = 4;
const MAX_CHUNK_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;
const UPLOAD_CONCURRENCY = 3;

type SelectedFile = {
    id: string;
    file: File;
    preview: string;
    uploadSession?: UploadSession;
};

type UploadPhase = "hashing" | "uploading" | "retrying" | "done" | "error";

type UploadState = {
    status: UploadPhase;
    progress: number;
    retry?: number;
};

type UploadStatus = {
    completed: boolean;
    receivedRanges: [number, number][];
    receivedSize: number;
};

type StartUploadResponse = {
    uploadToken: string;
    chunkSize?: number;
};

type HashableChunk = {
    blob: Blob;
    hash?: string;
};

// Runs asynchronous worker over all items while limiting how many workers may run concurrently.
async function runWithConcurrency<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
    if (items.length === 0) {
        return;
    }

    const concurrency = Math.max(1, Math.min(limit, items.length));

    let nextIndex = 0;

    async function runWorker(): Promise<void> {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            await worker(items[currentIndex]);
        }
    }
    await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
}

// Pauses execution for requested duration.
function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

// Creates stable identifier for duplicate-file detection.
function getFileKey(file: File): string {
    return [file.name, file.size, file.lastModified].join(":");
}

// Creates local UI representation of selected file.
function createSelectedFile(file: File, uploadSession?: UploadSession): SelectedFile {
    return {
        id: uploadSession ? `session-${uploadSession.uploadToken}` : crypto.randomUUID(), file, preview: URL.createObjectURL(file), uploadSession
    };
}

// Calculates upload percentage while safely handling empty files.
function calculateProgress(uploadedBytes: number, totalBytes: number): number {
    if (totalBytes <= 0) {
        return 100;
    }

    return Math.min(100, Math.max(0, Math.round((uploadedBytes / totalBytes) * 100)));
}

// Returns BLAKE3 digest for file or blob.
async function hashBlob(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return bytesToHex(blake3(bytes));
}

// Builds BLAKE3 Merkle root expected by upload API.
async function buildFileHash(file: File): Promise<string> {
    if (file.size === 0) {
        return hashBlob(file);
    }

    const chunks: HashableChunk[] = [];

    for (let offset = 0; offset < file.size; offset += FILE_CHUNK_SIZE) {
        const end = Math.min(offset + FILE_CHUNK_SIZE, file.size);

        chunks.push({
            blob: file.slice(offset, end),
        });
    }

    await runWithConcurrency(chunks, HASH_CONCURRENCY, async (chunk) => {
        chunk.hash = await hashBlob(chunk.blob);
    });

    return merkleRoot(chunks.map((chunk) => {
        if (!chunk.hash) {
            throw new Error("Missing chunk hash.");
        }
        return chunk.hash;
    }),
    );
}

function merkleRoot(hashes: readonly string[]): string {
    if (hashes.length === 0) {
        throw new Error("Cannot create a Merkle root without hashes.");
    }

    let level:
        Uint8Array<ArrayBufferLike>[] = hashes.map((hash) => Uint8Array.from(hash.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16,)) ?? []));

    while (level.length > 1) {
        const nextLevel: Uint8Array<ArrayBufferLike>[] = [];

        for (
            let index = 0;
            index < level.length;
            index += 2) {
            const left = level[index];
            const right = index + 1 < level.length ? level[index + 1] : left;
            const combined = new Uint8Array(left.length + right.length);
            combined.set(left, 0);
            combined.set(right, left.length);
            nextLevel.push(blake3(combined));
        }
        level = nextLevel;
    }

    return bytesToHex(level[0]);
}

/**
 * Returns the current server-side status for an upload session.
 */
async function getUploadStatus(
    uuid: string,
    uploadToken: string,
): Promise<UploadStatus> {
    const response = await fetch(`/api/uploadfile/${uuid}/${uploadToken}/status`);

    if (!response.ok) {
        throw new Error(`Failed to get upload status. Status: ${response.status}`);
    }

    return (await response.json()) as UploadStatus;
}

/**
 * Uploads and verifies one file chunk using BLAKE3.
 */
async function uploadChunk(uuid: string, uploadToken: string, chunk: Blob, offset: number): Promise<void> {
    const chunkHash = await hashBlob(chunk);
    const response = await fetch(`/api/uploadfile/${uuid}/${uploadToken}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/octet-stream",
            "X-Chunk-Hash": chunkHash,
            "X-Chunk-Offset": offset.toString(),
            "X-Chunk-Size": chunk.size.toString(),
        },
        body: chunk,
    });

    if (!response.ok) {
        throw new Error(`Chunk upload failed. Status: ${response.status}`);
    }
}

// Uploads one chunk with limited number of retries.
async function uploadChunkWithRetry(
    session: UploadSession,
    offset: number,
    onRetry: (attempt: number) => void,
): Promise<void> {
    const end = Math.min(offset + session.chunkSize, session.file.size);

    const chunk = session.file.slice(offset, end);

    for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt += 1) {
        try {
            await uploadChunk(session.uuid, session.uploadToken, chunk, offset);

            return;
        } catch (error) {
            if (attempt >= MAX_CHUNK_RETRIES) {
                throw error;
            }

            onRetry(attempt);

            await delay(RETRY_DELAY_MS);
        }
    }
}

/**
 * Returns chunk offsets not yet represented by the received
 * ranges reported by the server.
 */
function getMissingOffsets(
    fileSize: number,
    chunkSize: number,
    receivedRanges: readonly [number, number][],
): number[] {
    const missingOffsets: number[] = [];

    for (let offset = 0; offset < fileSize; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, fileSize);

        const wasReceived = receivedRanges.some(
            ([start, finish]) => start <= offset && finish >= end,
        );

        if (!wasReceived) {
            missingOffsets.push(offset);
        }
    }

    return missingOffsets;
}

/**
 * Uploads every chunk for a newly created session.
 */
async function uploadAllChunks(
    session: UploadSession,
    onProgress: (progress: number) => void,
    onRetry: (attempt: number) => void,
): Promise<void> {
    if (session.file.size === 0) {
        onProgress(100);
        return;
    }

    for (
        let offset = 0;
        offset < session.file.size;
        offset += session.chunkSize
    ) {
        await uploadChunkWithRetry(session, offset, onRetry);

        const uploadedBytes = Math.min(
            offset + session.chunkSize,
            session.file.size,
        );

        onProgress(calculateProgress(uploadedBytes, session.file.size));
    }
}

/**
 * Checks for server-side missing chunks and uploads them again.
 */
async function repairMissingChunks(
    session: UploadSession,
    onProgress: (progress: number) => void,
    onRetry: (attempt: number) => void,
): Promise<void> {
    const maximumVerificationRounds = 5;

    for (
        let verificationRound = 0;
        verificationRound < maximumVerificationRounds;
        verificationRound += 1
    ) {
        const status = await getUploadStatus(session.uuid, session.uploadToken);

        onProgress(calculateProgress(status.receivedSize, session.file.size));

        if (status.completed) {
            return;
        }

        const missingOffsets = getMissingOffsets(
            session.file.size,
            session.chunkSize,
            status.receivedRanges,
        );

        if (missingOffsets.length === 0) {
            return;
        }

        for (const offset of missingOffsets) {
            await uploadChunkWithRetry(session, offset, onRetry);

            const uploadedBytes = Math.min(
                offset + session.chunkSize,
                session.file.size,
            );

            onProgress(calculateProgress(uploadedBytes, session.file.size));
        }
    }

    const finalStatus = await getUploadStatus(session.uuid, session.uploadToken);

    const remainingOffsets = getMissingOffsets(
        session.file.size,
        session.chunkSize,
        finalStatus.receivedRanges,
    );

    if (!finalStatus.completed && remainingOffsets.length > 0) {
        throw new Error("The server is still missing one or more file chunks.");
    }
}

/**
 * Marks an upload session complete and removes its saved
 * IndexedDB recovery record.
 */
async function completeUploadSession(session: UploadSession): Promise<void> {
    const response = await fetch(
        `/api/uploadfile/${session.uuid}/${session.uploadToken}/complete`,
        {
            method: "POST",
        },
    );

    if (!response.ok) {
        throw new Error(`Failed to complete upload. Status: ${response.status}`);
    }

    try {
        await deleteUploadSession(session.uploadToken);
    } catch (error) {
        console.error(
            "The upload completed, but its recovery record could not be removed:",
            error,
        );
    }
}

/**
 * Creates and persists a new server-side upload session.
 */
async function createUploadSession(
    uuid: string,
    file: File,
): Promise<UploadSession> {
    const fileHash = await buildFileHash(file);

    const response = await fetch(`/api/uploadfile/${uuid}/start`, {
        method: "POST",
        headers: {
            "X-File-Hash": fileHash,
            "X-File-Name": file.name,
            "X-File-Size": file.size.toString(),
            "X-User-Location": "US",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to start upload. Status: ${response.status}`);
    }

    const data = (await response.json()) as Partial<StartUploadResponse>;

    if (typeof data.uploadToken !== "string" || !data.uploadToken) {
        throw new Error("The upload server returned an invalid session.");
    }

    const chunkSize =
        typeof data.chunkSize === "number" &&
            Number.isFinite(data.chunkSize) &&
            data.chunkSize > 0
            ? data.chunkSize
            : FILE_CHUNK_SIZE;

    if (chunkSize !== FILE_CHUNK_SIZE) {
        throw new Error(
            `The upload server returned chunk size ${chunkSize}, but the BLAKE3 Merkle hash was built with ${FILE_CHUNK_SIZE}-byte chunks.`,
        );
    }

    const session: UploadSession = {
        uuid,
        uploadToken: data.uploadToken,
        fileName: file.name,
        fileHash,
        fileSize: file.size,
        chunkSize,
        file,
    };

    await saveUploadSession(session);

    return session;
}

/**
 * Returns readable text for a file's current upload state.
 */
function getUploadStateText(state: UploadState): string {
    switch (state.status) {
        case "hashing":
            return "Hashing...";

        case "uploading":
            return `Uploading (${state.progress}%)`;

        case "retrying":
            return state.retry
                ? `Retrying chunk (${state.retry}/${MAX_CHUNK_RETRIES})`
                : "Resuming interrupted upload";

        case "done":
            return "Uploaded";

        case "error":
            return "Failed. Select Upload files to retry.";

        default:
            return "";
    }
}

export function CustomerUpload() {
    const { setUploadStats, uuid } = useCustomerUpload();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const selectedFilesRef = useRef<SelectedFile[]>([]);

    const resumedUuidRef = useRef<string | null>(null);

    const dragDepthRef = useRef(0);

    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

    const [uploadStatus, setUploadStatus] = useState<Record<string, UploadState>>(
        {},
    );

    const [dragActive, setDragActive] = useState(false);

    const [uploading, setUploading] = useState(false);

    const [resuming, setResuming] = useState(false);

    const uploadedFiles = useMemo(
        () => selectedFiles.filter(({ id }) => uploadStatus[id]?.status === "done"),
        [selectedFiles, uploadStatus],
    );

    const uploadedBytes = useMemo(
        () =>
            uploadedFiles.reduce((totalBytes, { file }) => totalBytes + file.size, 0),
        [uploadedFiles],
    );

    const hasPendingFiles = useMemo(
        () => selectedFiles.some(({ id }) => uploadStatus[id]?.status !== "done"),
        [selectedFiles, uploadStatus],
    );

    const isBusy = uploading || resuming;

    useEffect(() => {
        setUploadStats(uploadedFiles.length, uploadedBytes);
    }, [setUploadStats, uploadedBytes, uploadedFiles.length]);

    useEffect(() => {
        selectedFilesRef.current = selectedFiles;
    }, [selectedFiles]);

    useEffect(() => {
        return () => {
            selectedFilesRef.current.forEach(({ preview }) => {
                URL.revokeObjectURL(preview);
            });
        };
    }, []);

    useEffect(() => {
        function preventUnhandledFileDrop(event: globalThis.DragEvent): void {
            if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) {
                event.preventDefault();
            }
        }

        window.addEventListener("dragover", preventUnhandledFileDrop);

        window.addEventListener("drop", preventUnhandledFileDrop);

        return () => {
            window.removeEventListener("dragover", preventUnhandledFileDrop);

            window.removeEventListener("drop", preventUnhandledFileDrop);
        };
    }, []);

    const attachUploadSession = useCallback(
        (fileId: string, session: UploadSession): void => {
            setSelectedFiles((currentFiles) =>
                currentFiles.map((selectedFile) =>
                    selectedFile.id === fileId
                        ? {
                            ...selectedFile,
                            uploadSession: session,
                        }
                        : selectedFile,
                ),
            );
        },
        [],
    );

    const processFile = useCallback(
        async (
            selectedFile: SelectedFile,
            resumeExistingSession = false,
        ): Promise<void> => {
            setUploadStatus((currentStatus) => ({
                ...currentStatus,
                [selectedFile.id]: {
                    status: resumeExistingSession ? "retrying" : "hashing",
                    progress: currentStatus[selectedFile.id]?.progress ?? 0,
                },
            }));

            try {
                let session = selectedFile.uploadSession;

                const isNewSession = !session;

                if (!session) {
                    session = await createUploadSession(uuid, selectedFile.file);

                    attachUploadSession(selectedFile.id, session);
                }

                if (session.uuid !== uuid) {
                    throw new Error(
                        "The saved upload session belongs to a different upload link.",
                    );
                }

                const updateProgress = (progress: number): void => {
                    setUploadStatus((currentStatus) => ({
                        ...currentStatus,
                        [selectedFile.id]: {
                            status: "uploading",
                            progress,
                        },
                    }));
                };

                const updateRetry = (attempt: number): void => {
                    setUploadStatus((currentStatus) => ({
                        ...currentStatus,
                        [selectedFile.id]: {
                            status: "retrying",
                            progress: currentStatus[selectedFile.id]?.progress ?? 0,
                            retry: attempt,
                        },
                    }));
                };

                if (isNewSession) {
                    await uploadAllChunks(session, updateProgress, updateRetry);
                }

                await repairMissingChunks(session, updateProgress, updateRetry);

                await completeUploadSession(session);

                setUploadStatus((currentStatus) => ({
                    ...currentStatus,
                    [selectedFile.id]: {
                        status: "done",
                        progress: 100,
                    },
                }));
            } catch (error) {
                console.error(`Upload failed for ${selectedFile.file.name}:`, error);

                setUploadStatus((currentStatus) => ({
                    ...currentStatus,
                    [selectedFile.id]: {
                        status: "error",
                        progress: currentStatus[selectedFile.id]?.progress ?? 0,
                    },
                }));
            }
        },
        [attachUploadSession, uuid],
    );

    useEffect(() => {
        if (resumedUuidRef.current === uuid) {
            return;
        }

        resumedUuidRef.current = uuid;

        async function resumeSavedUploads(): Promise<void> {
            setResuming(true);

            try {
                const savedSessions = await getUploadSessions(uuid);

                if (savedSessions.length === 0) {
                    return;
                }

                const resumedFiles = savedSessions.map((session) =>
                    createSelectedFile(session.file, session),
                );

                const existingTokens = new Set(
                    selectedFilesRef.current
                        .map(({ uploadSession }) => uploadSession?.uploadToken)
                        .filter((token): token is string => Boolean(token)),
                );

                const filesToResume = resumedFiles.filter(({ uploadSession }) =>
                    Boolean(
                        uploadSession && !existingTokens.has(uploadSession.uploadToken),
                    ),
                );

                resumedFiles
                    .filter(({ uploadSession }) =>
                        Boolean(
                            uploadSession && existingTokens.has(uploadSession.uploadToken),
                        ),
                    )
                    .forEach(({ preview }) => {
                        URL.revokeObjectURL(preview);
                    });

                setSelectedFiles((currentFiles) => [...currentFiles, ...filesToResume]);

                await runWithConcurrency(
                    filesToResume,
                    UPLOAD_CONCURRENCY,
                    (selectedFile) => processFile(selectedFile, true),
                );
            } catch (error) {
                console.error("Failed to resume interrupted uploads:", error);
            } finally {
                setResuming(false);
            }
        }

        void resumeSavedUploads();
    }, [processFile, uuid]);

    function handleBrowseClick(): void {
        fileInputRef.current?.click();
    }

    function addFiles(files: FileList | File[]): void {
        const incomingFiles = Array.from(files);

        setSelectedFiles((currentFiles) => {
            const existingKeys = new Set(
                currentFiles.map(({ file }) => getFileKey(file)),
            );

            const filesToAdd: SelectedFile[] = [];

            incomingFiles.forEach((file) => {
                const fileKey = getFileKey(file);

                if (existingKeys.has(fileKey)) {
                    return;
                }

                existingKeys.add(fileKey);

                filesToAdd.push(createSelectedFile(file));
            });

            return filesToAdd.length > 0
                ? [...currentFiles, ...filesToAdd]
                : currentFiles;
        });
    }

    function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
        if (!event.target.files) {
            return;
        }

        addFiles(event.target.files);
        event.target.value = "";
    }

    async function removeFile(fileId: string): Promise<void> {
        const fileToRemove = selectedFilesRef.current.find(
            ({ id }) => id === fileId,
        );

        if (!fileToRemove) {
            return;
        }

        URL.revokeObjectURL(fileToRemove.preview);

        setSelectedFiles((currentFiles) =>
            currentFiles.filter(({ id }) => id !== fileId),
        );

        setUploadStatus((currentStatus) => {
            const nextStatus = {
                ...currentStatus,
            };

            delete nextStatus[fileId];

            return nextStatus;
        });

        if (fileToRemove.uploadSession && uploadStatus[fileId]?.status !== "done") {
            try {
                await deleteUploadSession(fileToRemove.uploadSession.uploadToken);
            } catch (error) {
                console.error("Failed to remove the saved upload session:", error);
            }
        }
    }

    function containsFiles(event: DragEvent<HTMLDivElement>): boolean {
        return Array.from(event.dataTransfer.types).includes("Files");
    }

    function handleDragEnter(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        event.stopPropagation();

        if (isBusy || !containsFiles(event)) {
            return;
        }

        dragDepthRef.current += 1;
        event.dataTransfer.dropEffect = "copy";
        setDragActive(true);
    }

    function handleDragOver(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        event.stopPropagation();

        if (isBusy || !containsFiles(event)) {
            event.dataTransfer.dropEffect = "none";
            return;
        }

        event.dataTransfer.dropEffect = "copy";

        if (!dragActive) {
            setDragActive(true);
        }
    }

    function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        event.stopPropagation();

        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

        if (dragDepthRef.current === 0) {
            setDragActive(false);
        }
    }

    function handleDrop(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        event.stopPropagation();

        dragDepthRef.current = 0;
        setDragActive(false);

        if (isBusy) {
            return;
        }

        const droppedFiles = Array.from(event.dataTransfer.files);

        if (droppedFiles.length === 0) {
            return;
        }

        addFiles(droppedFiles);
        event.dataTransfer.clearData();
    }

    async function uploadFiles(): Promise<void> {
        if (isBusy) {
            return;
        }

        const filesToUpload = selectedFiles.filter(
            ({ id }) => uploadStatus[id]?.status !== "done",
        );

        if (filesToUpload.length === 0) {
            return;
        }

        setUploading(true);

        try {
            await runWithConcurrency(
                filesToUpload,
                UPLOAD_CONCURRENCY,
                (selectedFile) =>
                    processFile(selectedFile, Boolean(selectedFile.uploadSession)),
            );
        } finally {
            setUploading(false);
        }
    }

    return (
        <section
            className="customer-upload-page"
            aria-labelledby="customer-upload-heading"
        >
            <div className="upload-panel">
                <h1 id="customer-upload-heading">Upload your files</h1>

                <p className="upload-note">
                    This link is temporary and will stop working after the assigned
                    expiration time. Please upload your files before the link expires.
                </p>

                <div
                    className={dragActive ? "upload-box drag-active" : "upload-box"}
                    aria-busy={isBusy}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <p>Select or drag and drop file(s) here</p>

                    <button
                        className="browse-button"
                        type="button"
                        disabled={isBusy}
                        onClick={handleBrowseClick}
                    >
                        {resuming ? "Resuming uploads..." : "Browse files"}
                    </button>

                    <input
                        ref={fileInputRef}
                        className="file-input"
                        type="file"
                        multiple
                        disabled={isBusy}
                        aria-label="Select files to upload"
                        onChange={handleFileChange}
                    />

                    {selectedFiles.length > 0 && (
                        <div className="selected-files" aria-live="polite">
                            {selectedFiles.map((item) => {
                                const state = uploadStatus[item.id];

                                return (
                                    <div key={item.id} className="selected-file">
                                        <div className="selected-file-info">
                                            <span>{item.file.name}</span>

                                            {state && <small>{getUploadStateText(state)}</small>}

                                            {state && (
                                                <div
                                                    className="upload-progress"
                                                    role="progressbar"
                                                    aria-label={`Upload progress for ${item.file.name}`}
                                                    aria-valuemin={0}
                                                    aria-valuemax={100}
                                                    aria-valuenow={state.progress}
                                                >
                                                    <div
                                                        className={`upload-progress-fill ${state.status}`}
                                                        style={{
                                                            width: `${state.progress}%`,
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="selected-file-actions">
                                            <a
                                                href={item.preview}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Preview
                                            </a>

                                            <button
                                                className="delete-button"
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => void removeFile(item.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {selectedFiles.length > 0 && hasPendingFiles && (
                        <button
                            className="browse-button"
                            type="button"
                            disabled={isBusy}
                            onClick={() => void uploadFiles()}
                        >
                            {uploading
                                ? "Uploading..."
                                : resuming
                                    ? "Resuming..."
                                    : "Upload files"}
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}
