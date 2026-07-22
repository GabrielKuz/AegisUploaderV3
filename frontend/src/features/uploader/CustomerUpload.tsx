import {
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import { useParams } from "react-router-dom";
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import "./CustomerUpload.css";


type SelectedFile = {
    file: File;
    preview: string;
};

type PreparedChunk = {
    blob: Blob;
    offset: number;
    hash?: string;
};

const FILE_CHUNK_SIZE = 4*1024*1024;
const HASH_CONCURRENCY = 4;
const UPLOAD_CONCURRENCY = 6;
const RETRY_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 500;

async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>
) {
    if (items.length === 0) {
        return;
    }

    let index = 0;

    async function runner() {
        while (index < items.length) {
            const current = index++;
            await worker(items[current]);
        }
    }

    await Promise.all(
        Array.from(
            {length: limit},
            runner
        )
    );
}

function delay(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function shouldRetryResponse(response: Response) {
    return (
        response.status >= 500 ||
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429
    );
}

async function fetchWithRetry(
    input: RequestInfo | URL,
    init: RequestInit,
    action: string,
): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(input, init);

            if (response.ok || !shouldRetryResponse(response)) {
                return response;
            }

            lastError = new Error(
                `${action} failed with status ${response.status}`
            );
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (attempt < RETRY_ATTEMPTS - 1) {
            const backoff = RETRY_BASE_DELAY_MS * (2 ** attempt);
            const jitter = Math.floor(Math.random() * 250);
            await delay(backoff + jitter);
        }
    }

    throw lastError ?? new Error(`${action} failed`);
}

async function hashBlob(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());

    return bytesToHex(blake3(bytes));
}

async function buildChunkHashes(
    file: File,
    chunkSize: number
): Promise<{ fileHash: string; chunks: PreparedChunk[] }> {
    const chunks: PreparedChunk[] = [];

    for (let offset = 0; offset < file.size; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, file.size);

        chunks.push({
            blob: file.slice(offset, end),
            offset,
        });
    }

    await runWithConcurrency(
        chunks,
        Math.min(HASH_CONCURRENCY, chunks.length),
        async (chunk) => {
            chunk.hash = await hashBlob(chunk.blob);
        },
    );

    const chunkHashes = chunks.map((chunk) => {
        if (!chunk.hash) {
            throw new Error("Missing chunk hash");
        }

        return chunk.hash;
    });

    return {
        fileHash: merkleRoot(chunkHashes),
        chunks,
    };
}
function merkleRoot(hashes: string[]): string {
    if (hashes.length === 0) {
        throw new Error("No hashes");
    }
    let level: Uint8Array<ArrayBufferLike>[] = hashes.map(
        h => Uint8Array.from(
            h.match(/.{1,2}/g)!.map(
                byte => parseInt(byte, 16)
            )
        )
    );


    while (level.length > 1) {
        const next: Uint8Array<ArrayBufferLike>[] = [];

        for (let i = 0; i < level.length; i += 2) {

            const left = level[i];

            const right =
                i + 1 < level.length
                    ? level[i + 1]
                    : left;


            const combined = new Uint8Array(
                left.length + right.length
            );

            combined.set(left, 0);
            combined.set(right, left.length);


            next.push(
                blake3(combined)
            );
        }

        level = next;
    }


    return bytesToHex(level[0]);
}
async function uploadChunk(
    uuid: string,
    uploadToken: string,
    chunk: PreparedChunk,
) {
    if (!chunk.hash) {
        throw new Error("Missing chunk hash");
    }

    const response = await fetchWithRetry(
        `/api/uploadfile/${uuid}/${uploadToken}`,
        {
            method: "POST",
            headers: {
                "X-Chunk-Offset": chunk.offset.toString(),
                "X-Chunk-Size": chunk.blob.size.toString(),
                "X-Chunk-Hash": chunk.hash,
                "Content-Type": "application/octet-stream",
            },
            body: chunk.blob,
        },
        `chunk ${chunk.offset}`,
    );

    if (!response.ok) {
        throw new Error("Chunk upload failed");
    }
}

export function CustomerUpload() {
    const { uuid } = useParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});
    const [dragActive, setDragActive] = useState(false);

    if (!uuid) {
        return <p>Invalid upload link.</p>;
    }

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };
    const addFiles = (files: FileList | File[]) => {
        const newFiles = Array.from(files).map((file) => ({
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
        setSelectedFiles((currentFiles) =>
            currentFiles.filter((_, index) => index !== indexToRemove),
        );
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
                        [item.file.name]: "starting",
                    }));

                    const chunkSizes = FILE_CHUNK_SIZE;

                    setUploadStatus((s) => ({
                        ...s,
                        [item.file.name]: "hashing",
                    }));

                    const {
                        fileHash,
                        chunks,
                    } = await buildChunkHashes(
                        item.file,
                        chunkSizes
                    );

                    const startResponse = await fetchWithRetry(
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
                        `start upload for ${item.file.name}`,
                    );

                    if (!startResponse.ok) {
                        throw new Error("Failed to start upload");
                    }

                    const {
                        uploadToken,
                    }: {
                        uploadToken: string;
                    } = await startResponse.json();


                    setUploadStatus((s) => ({
                        ...s,
                        [item.file.name]: "uploading",
                    }));

                    await runWithConcurrency(
                        chunks,
                        Math.min(UPLOAD_CONCURRENCY, chunks.length),
                        async (chunk) => {

                            await uploadChunk(
                                uuid,
                                uploadToken,
                                chunk,
                            );

                        }
                    );

                    const completeResponse = await fetchWithRetry(
                        `/api/uploadfile/${uuid}/${uploadToken}/complete`,
                        {
                            method: "POST",
                        },
                        `complete upload for ${item.file.name}`,
                    );

                    if (!completeResponse.ok) {
                        throw new Error("Failed to complete upload");
                    }

                    setUploadStatus((s) => ({
                        ...s,
                        [item.file.name]: "done",
                    }));

                } catch {
                    setUploadStatus((s) => ({
                        ...s,
                        [item.file.name]: "error",
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
                <p className="upload-eyebrow">
                    Secure upload
                </p>

                <h1 id="customer-upload-heading">
                    Upload your files
                </h1>

                <p className="upload-link-id">
                    Upload link ID: {uuid}
                </p>

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
                                    key={`${item.file.name}-${index}`}
                                    className="selected-file"
                                >
                                    <div className="selected-file-info">
                                        <span>{item.file.name}</span>

                                        <small>
                                            {uploadStatus[item.file.name] === "hashing" &&
                                                "Hashing..."}
                                            {uploadStatus[item.file.name] === "uploading" &&
                                                "Uploading..."}
                                            {uploadStatus[item.file.name] === "done" &&
                                                "Uploaded"}
                                            {uploadStatus[item.file.name] === "error" &&
                                                "Failed"}
                                        </small>
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