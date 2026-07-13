import {
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import { useParams } from "react-router-dom";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import "./CustomerUpload.css";

type SelectedFile = {
    file: File;
    preview: string;
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

export function CustomerUpload() {
    const { uuid } = useParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});

    if (!uuid) {
        return <p>Invalid upload link.</p>;
    }

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (
        event: ChangeEvent<HTMLInputElement>,
    ) => {
        const files = event.target.files;

        if (!files) {
            return;
        }

        const newFiles = Array.from(files).map((file) => ({
            file,
            preview: URL.createObjectURL(file),
        }));

        setSelectedFiles((currentFiles) => {
            const existingNames = new Set(
                currentFiles.map((item) => item.file.name),
            );

            const uniqueNewFiles = newFiles.filter(
                (item) => !existingNames.has(item.file.name),
            );

            return [...currentFiles, ...uniqueNewFiles];
        });

        event.target.value = "";
    };

    const removeFile = (indexToRemove: number) => {
        setSelectedFiles((currentFiles) =>
            currentFiles.filter((_, index) => index !== indexToRemove),
        );
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


                    setUploadStatus((s) => ({
                        ...s,
                        [item.file.name]: "uploading",
                    }));

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
                            } catch {
                                attempts++;

                                if (attempts >= 3) {
                                    throw new Error(
                                        "Chunk failed after retries",
                                    );
                                }
                            }
                        }

                        offset = end;
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

                <div className="upload-box">
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