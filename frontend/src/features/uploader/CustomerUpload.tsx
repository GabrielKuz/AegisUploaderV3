import {
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import { useParams } from "react-router-dom";
import "./CustomerUpload.css";
import { useCustomerUpload } from "../../layouts/CustomerLayoutContext";

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

    // start initial batch
    const starters = Array.from({ length: limit }, runNext);

    await Promise.all(starters);
    await Promise.all(active);
}

export function CustomerUpload() {
    const { uuid } = useParams();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const {
        setUploadStats
    } = useCustomerUpload();
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    type UploadState = {
    status: "uploading" | "done" | "error";
    progress: number;
    };

    const [uploadStatus, setUploadStatus] = useState<Record<string, UploadState>>({});
    const [dragActive, setDragActive] = useState(false);

    const uploadedFiles = selectedFiles.filter(
        (item) => uploadStatus[item.file.name]?.status === "done"
    );

    //const uploadedCount = uploadedFiles.length;

    const uploadedBytes = uploadedFiles.reduce(
        (total, item) => total + item.file.size,
        0
    );

    /*const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 B";

        const units = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    };*/
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
    const uploadSingleFile = (
        file: File,
        sha256: string,
        uuid: string,
        onProgress: (progress: number) => void
    ) => {
        return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.open(
                "POST",
                `/api/uploadfile/${uuid}`
            );

            xhr.setRequestHeader(
                "X-File-Hash",
                sha256
            );

            xhr.setRequestHeader(
                "X-User-Location",
                "US"
            );

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round(
                        (event.loaded / event.total) * 100
                    );

                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject();
                }
            };

            xhr.onerror = () => reject();

            const formData = new FormData();
            formData.append("file", file);

            xhr.send(formData);
        });
    };
    const uploadFiles = async () => {
        setUploading(true);

        try {
            await runWithConcurrency(selectedFiles, 3, async (item) => {
                setUploadStatus((s) => ({
                    ...s,
                    [item.file.name]: {
                        status: "uploading",
                        progress: 0,
                    },
                }));

                try {
                    const fileBuffer = await item.file.arrayBuffer();

                    const hashBuffer = await crypto.subtle.digest(
                        "SHA-256",
                        fileBuffer
                    );

                    const sha256 = Array.from(new Uint8Array(hashBuffer))
                        .map((b) => b.toString(16).padStart(2, "0"))
                        .join("");

                    const formData = new FormData();
                    formData.append("file", item.file);

                    await uploadSingleFile(
                        item.file,
                        sha256,
                        uuid,
                        (progress) => {
                            setUploadStatus((s) => ({
                                ...s,
                                [item.file.name]: {
                                    status: "uploading",
                                    progress,
                                },
                            }));
                        }
                    );

                   setUploadStatus((s) => ({
                        ...s,
                        [item.file.name]: {
                            status: "done",
                            progress: 100,
                        },
                    }));

                    setUploadStats(
                        uploadedFiles.length + 1,
                        uploadedBytes + item.file.size
                    );
                } catch {
                    setUploadStatus((s) => ({
                        ...s,
                        [item.file.name]: {
                            status: "error",
                            progress: 0,
                        },
                    }));
                }
            });
        } finally {
            setUploading(false);
        }
    };
    return (
        <section className="customer-upload-page">
            <div className="upload-panel">

                
                
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
                                    key={`${item.file.name}-${index}`}
                                    className="selected-file"
                                >
                                    <div className="selected-file-info">
                                        <span>{item.file.name}</span>

                                        <small>
                                            {uploadStatus[item.file.name]?.status === "uploading" &&
                                                `Uploading... ${uploadStatus[item.file.name].progress}%`
                                            }

                                            {uploadStatus[item.file.name]?.status === "done" &&
                                                "Uploaded"
                                            }

                                            {uploadStatus[item.file.name]?.status === "error" &&
                                                "Failed"
                                            }
                                        </small>

                                        {uploadStatus[item.file.name]?.status === "uploading" && (
                                            <progress
                                                value={uploadStatus[item.file.name].progress}
                                                max="100"
                                            />
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
        </div>
    </section>
    );
}