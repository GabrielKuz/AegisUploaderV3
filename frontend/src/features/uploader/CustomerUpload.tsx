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
                setUploadStatus((s) => ({
                    ...s,
                    [item.file.name]: "uploading",
                }));

                try {
                    const sha256Hash = await sha256File(item.file);
                    console.log("UPLOAD DEBUG", {
                        name: item.file.name,
                        size: item.file.size,
                        type: item.file.type,
                    });
                    const response = await fetch(`/api/uploadfile/${uuid}`, {
                        method: "POST",
                        headers: {
                            "X-File-Name": item.file.name,
                            "X-File-Hash": sha256Hash,
                            "X-User-Location": "US",
                            "Content-Type": "application/octet-stream",
                        },
                        body: item.file,
                    });
                                        if (!response.ok) {
                        throw new Error("upload failed");
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