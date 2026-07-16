import {
    useRef,
    useState,
    useEffect,
    type ChangeEvent,
} from "react";
import { useParams } from "react-router-dom";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import "./CustomerUpload.css";
import {
    saveUploadSession,
    deleteUploadSession,
    getUploadSessions,
} from "./indexedDb";
import { useCustomerUpload } from "./CustomerLayoutContext";


type SelectedFile = {
    id: string;
    file: File;
    preview: string;
};

type UploadStatus = {
    receivedRanges: [number, number][];
    receivedSize: number;
    expectedSize: number;
    chunkSize: number;
    completed: boolean;
    chunksReceived: number;
};

async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>
) {
    const queue = [...items];
    const active: Promise<void>[] = [];

    const runNext = async () => {
        if (queue.length === 0) return;

        const item = queue.shift()!;
        const p = worker(item).finally(() => {
            active.splice(active.indexOf(p), 1);
        });

        active.push(p);

        if (active.length < limit) {
            await runNext();
        }
    };

    const starters = Array.from({ length: limit }, runNext);

    await Promise.all(starters);
    await Promise.all(active);
}

async function sha256File(file: File): Promise<string> {
    const hasher = sha256.create();
    const reader = file.stream().getReader();

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            hasher.update(value);
        }

        return bytesToHex(hasher.digest());
    } finally {
        reader.releaseLock();
    }
}
async function sha256Blob(blob: Blob): Promise<string> {
    const hasher = sha256.create();
    const reader = blob.stream().getReader();

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            hasher.update(value);
        }

        return bytesToHex(hasher.digest());
    } finally {
        reader.releaseLock();
    }
}

async function getUploadStatus(
    uuid: string,
    uploadToken: string,
): Promise<UploadStatus> {
    const response = await fetch(
        `/api/uploadfile/${uuid}/${uploadToken}/status`
    );

    if (!response.ok) {
        throw new Error("Failed to get upload status");
    }

    return response.json();
}

async function uploadChunk(
    uuid: string,
    uploadToken: string,
    chunk: Blob,
    offset: number,
    chunkSize: number,
) {
    const hash = await sha256Blob(chunk);

    const response = await fetch(
        `/api/uploadfile/${uuid}/${uploadToken}`,
        {
            method: "POST",
            headers: {
                "X-Chunk-Offset": offset.toString(),
                "X-Chunk-Size": chunkSize.toString(),
                "X-Chunk-Hash": hash,
                "Content-Type": "application/octet-stream",
            },
            body: chunk,
        },
    );

    if (!response.ok) {
        throw new Error("Chunk upload failed");
    }
}
async function resumeInterruptedUploads() {
    const uploads = await getUploadSessions();

    for (const upload of uploads) {
        const {
            uuid,
            uploadToken,
            chunkSize,
            file,
        } = upload;

        let status = await getUploadStatus(uuid, uploadToken);

        while (!status.completed) {
            const missingOffsets: number[] = [];

            for (
                let offset = 0;
                offset < file.size;
                offset += chunkSize
            ) {
                const end = Math.min(
                    offset + chunkSize,
                    file.size,
                );

                const exists = status.receivedRanges.some(
                    ([start, finish]: [number, number]) =>
                        start <= offset &&
                        finish >= end
                );

                if (!exists) {
                    missingOffsets.push(offset);
                }
            }

            for (const offset of missingOffsets) {
                const end = Math.min(
                    offset + chunkSize,
                    file.size,
                );

                const chunk = file.slice(offset, end);

                await uploadChunk(
                    uuid,
                    uploadToken,
                    chunk,
                    offset,
                    chunk.size,
                );
            }

            status = await getUploadStatus(
                uuid,
                uploadToken,
            );
        }

        const completeResponse = await fetch(
            `/api/uploadfile/${uuid}/${uploadToken}/complete`,
            { method: "POST" },
        );

        if (completeResponse.ok) {
            await deleteUploadSession(uploadToken);
        }
    }
}
export function CustomerUpload() {
    const { uuid } = useParams();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { setUploadStats } = useCustomerUpload();
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [uploading, setUploading] = useState(false);

    const [dragActive, setDragActive] = useState(false);
    type UploadState = {
        status: "waiting" | "uploading" | "retrying" | "done" | "error";
        progress: number;
        retry?: number;
    };

    const [uploadStatus, setUploadStatus] =
        useState<Record<string, UploadState>>({});
    const uploadedFiles = selectedFiles.filter(
        (item) => uploadStatus[item.id]?.status === "done"
    );

    const uploadedBytes = uploadedFiles.reduce(
        (total, item) => total + item.file.size,
        0
    );
    useEffect(() => {
        setUploadStats(
            uploadedFiles.length,
            uploadedBytes
        );
    }, [
        uploadedFiles.length,
        uploadedBytes,
        setUploadStats,
    ]);

    useEffect(() => {
        return () => {
            selectedFiles.forEach((item) => {
                URL.revokeObjectURL(item.preview);
            });
        };
    }, []);
    if (!uuid) {
        return <p>Invalid upload link.</p>;
    }

    useEffect(() => {
        resumeInterruptedUploads();
    }, []);

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };
    const addFiles = (files: FileList | File[]) => {
        const newFiles = Array.from(files).map((file) => ({
            id: crypto.randomUUID(),
            file,
            preview: URL.createObjectURL(file),
        }));

        setSelectedFiles((currentFiles) => {
            const existingNames = new Set(
                currentFiles.map((item) => item.file.name)
            );

            const uniqueNewFiles = newFiles.filter(
                (item) => !existingNames.has(item.file.name)
            );

            return [...currentFiles, ...uniqueNewFiles];
        });
    };
    const handleFileChange = (
        event: ChangeEvent<HTMLInputElement>,
    ) => {


        if (!event.target.files) {
            return;
        }

        addFiles(event.target.files);

        event.target.value = "";
    };

    const removeFile = (indexToRemove: number) => {
        setSelectedFiles((currentFiles) => {
            const removed = currentFiles[indexToRemove];

            if (removed) {
                URL.revokeObjectURL(removed.preview);
            }

            return currentFiles.filter(
                (_, index) => index !== indexToRemove
            );
        });
    };

    const handleDragOver = (
        event: React.DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = (
        event: React.DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        setDragActive(false);
    };

    const handleDrop = (
        event: React.DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        setDragActive(false);

        if (event.dataTransfer.files.length > 0) {
            addFiles(event.dataTransfer.files);
        }
    };
    const uploadFiles = async () => {
        setUploading(true);

        try {
            await runWithConcurrency(selectedFiles, 3, async (item) => {
                try {
                    setUploadStatus((s) => ({
                        ...s,
                        [item.id]: {
                            status: "uploading",
                            progress: 0,
                        },
                    }));

                    const fileHash = await sha256File(item.file);

                    const startResponse = await fetch(
                        `/api/uploadfile/${uuid}/start`,
                        {
                            method: "POST",
                            headers: {
                                "X-File-Name": item.file.name,
                                "X-File-Hash": fileHash,
                                "X-File-Size": item.file.size.toString(),
                                "X-User-Location": "US",
                            },
                        },
                    );

                    if (!startResponse.ok) {
                        throw new Error("Failed to start upload");
                    }

                    const {
                        uploadToken,
                        chunkSize,
                    }: {
                        uploadToken: string;
                        chunkSize: number;
                    } = await startResponse.json();

                    await saveUploadSession({
                        uuid,
                        uploadToken,
                        fileName: item.file.name,
                        fileHash,
                        fileSize: item.file.size,
                        chunkSize,
                        file: item.file,
                    })


                    let offset = 0;

                    while (offset < item.file.size) {
                        const end = Math.min(
                            offset + chunkSize,
                            item.file.size,
                        );

                        const chunk = item.file.slice(offset, end);

                        let uploaded = false;
                        let attempts = 0;


                        while (!uploaded && attempts < 3) {
                            try {
                                await uploadChunk(
                                    uuid,
                                    uploadToken,
                                    chunk,
                                    offset,
                                    chunk.size,
                                );

                                uploaded = true;

                                setUploadStatus((s) => ({
                                    ...s,
                                    [item.id]: {
                                        ...s[item.id],
                                        status: "uploading",
                                    },
                                }));
                            } catch {
                                attempts++;

                                setUploadStatus((s) => ({
                                    ...s,
                                    [item.id]: {
                                        ...s[item.id],
                                        status: "retrying",
                                        retry: attempts,
                                    },
                                }));

                                if (attempts >= 3) {
                                    throw new Error("Chunk failed after retries");
                                }

                                await new Promise((resolve) => setTimeout(resolve, 1000));
                            }
                        }
                        offset = end;
                        const percent = Math.round((offset / item.file.size) * 100);

                        setUploadStatus((s) => ({
                            ...s,
                            [item.id]: {
                                ...s[item.id],
                                progress: percent,
                            },
                        }));
                    }
                    let status = await getUploadStatus(uuid, uploadToken);

                    while (!status.completed) {
                        const missingOffsets: number[] = [];

                        for (
                            let offset = 0;
                            offset < item.file.size;
                            offset += chunkSize
                        ) {
                            const end = Math.min(
                                offset + chunkSize,
                                item.file.size,
                            );

                            const exists = status.receivedRanges.some(
                                ([start, finish]) =>
                                    start <= offset &&
                                    finish >= end
                            );

                            if (!exists) {
                                missingOffsets.push(offset);
                            }
                        }
                        for (const offset of missingOffsets) {
                            const end = Math.min(
                                offset + chunkSize,
                                item.file.size,
                            );

                            const chunk = item.file.slice(offset, end);

                            await uploadChunk(
                                uuid,
                                uploadToken,
                                chunk,
                                offset,
                                chunk.size,
                            );
                        }
                        status = await getUploadStatus(uuid, uploadToken);
                    }
                    const completeResponse = await fetch(
                        `/api/uploadfile/${uuid}/${uploadToken}/complete`,
                        {
                            method: "POST",
                        },
                    );

                    if (!completeResponse.ok) {
                        throw new Error("Failed to complete upload");
                    }

                    await deleteUploadSession(uploadToken);

                    setUploadStatus((s) => ({
                        ...s,
                        [item.id]: {
                            status: "done",
                            progress: 100,
                        },
                    }));

                } catch {
                    setUploadStatus((s) => ({
                        ...s,
                        [item.id]: {
                            ...s[item.id],
                            status: "error",
                        },
                    }));
                }
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <section
            className="customer-upload-page"
            aria-labelledby="customer-upload-heading"
        >
            <div className="upload-panel">

                <h1 id="customer-upload-heading">
                    Upload your files
                </h1>


                <p className="upload-note">
                    This link is temporary and will stop working after the
                    assigned expiration time. Please upload your files before
                    the link expires.
                </p>

                <div
                    className={`upload-box ${dragActive ? "drag-active" : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <p>Choose files or drag and drop here.</p>

                    <button
                        className="browse-button"
                        type="button"
                        onClick={handleBrowseClick}
                    >
                        Browse files
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="file-input"
                        onChange={handleFileChange}
                    />

                    {selectedFiles.length > 0 && (
                        <div className="selected-files">
                            {selectedFiles.map((item, index) => (
                                <div
                                    key={`${item.id}-${index}`}
                                    className="selected-file"
                                >
                                    <div className="selected-file-info">
                                        <span>{item.file.name}</span>

                                        {uploadStatus[item.id] && (
                                            <small>
                                                {uploadStatus[item.id].status === "uploading" &&
                                                    `Uploading (${uploadStatus[item.id].progress}%)`}

                                                {uploadStatus[item.id].status === "retrying" &&
                                                    `Retrying... (${uploadStatus[item.id].retry}/3)`}

                                                {uploadStatus[item.id].status === "done" &&
                                                    "Uploaded"}

                                                {uploadStatus[item.id].status === "error" &&
                                                    "Failed"}
                                            </small>
                                        )}
                                        {uploadStatus[item.id] && (
                                            <div className="upload-progress">
                                                <div
                                                    className={`upload-progress-fill ${uploadStatus[item.id].status}`}
                                                    style={{
                                                        width: `${uploadStatus[item.id].progress}%`,
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
                                            disabled={uploading}
                                            onClick={() => removeFile(index)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedFiles.length > 0 && (
                        <button
                            className="browse-button"
                            type="button"
                            onClick={uploadFiles}
                            disabled={uploading}
                        >
                            {uploading ? "Uploading..." : "Upload files"}
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}