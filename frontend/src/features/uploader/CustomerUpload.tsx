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

async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item:T)=>Promise<void>
) {
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

async function blake3FileMerkle(
    file: File,
    chunkSize: number
): Promise<string> {

    const hashes: string[] = [];

    let offset = 0;


    while (offset < file.size) {

        const end = Math.min(
            offset + chunkSize,
            file.size
        );


        const chunk = file.slice(
            offset,
            end
        );


        hashes.push(
            await blake3Blob(chunk)
        );


        offset = end;
    }


    return merkleRoot(hashes);
}
async function blake3Blob(blob: Blob): Promise<string> {
    const hasher = blake3.create();

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
    chunk: Blob,
    offset: number,
    chunkSize: number,
) {
    const hash = await blake3Blob(chunk);

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

                    const chunkSizes = 32 * 1024 * 1024;

                    const fileHash = await blake3FileMerkle(
                        item.file,
                        chunkSizes
                    );

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

                    const chunks = [];

                    let offset = 0;

                    while (offset < item.file.size) {
                        const end = Math.min(
                            offset + chunkSize,
                            item.file.size
                        );

                        chunks.push({
                            blob: item.file.slice(offset, end),
                            offset
                        });

                        offset = end;
                    }

                    await runWithConcurrency(
                        chunks,
                        6,
                        async ({blob, offset}) => {

                            await uploadChunk(
                                uuid,
                                uploadToken,
                                blob,
                                offset,
                                blob.size
                            );

                        }
                    );

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