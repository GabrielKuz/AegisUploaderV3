import {
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import { useParams } from "react-router-dom";
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

    // start initial batch
    const starters = Array.from({ length: limit }, runNext);

    await Promise.all(starters);
    await Promise.all(active);
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
                setUploadStatus((s) => ({
                    ...s,
                    [item.file.name]: "uploading",
                }));
        try {
            await runWithConcurrency(selectedFiles, 3, async (item) => {
                setUploadStatus((s) => ({
                    ...s,
                    [item.file.name]: "uploading",
                }));

                try {
                    const fileBuffer = await item.file.arrayBuffer();
                try {
                    const fileBuffer = await item.file.arrayBuffer();

                    const hashBuffer = await crypto.subtle.digest(
                        "SHA-256",
                        fileBuffer
                    );
                    const hashBuffer = await crypto.subtle.digest(
                        "SHA-256",
                        fileBuffer
                    );

                    const sha256 = Array.from(new Uint8Array(hashBuffer))
                        .map((b) => b.toString(16).padStart(2, "0"))
                        .join("");
                    const sha256 = Array.from(new Uint8Array(hashBuffer))
                        .map((b) => b.toString(16).padStart(2, "0"))
                        .join("");

                    const formData = new FormData();
                    formData.append("file", item.file);
                    const formData = new FormData();
                    formData.append("file", item.file);

                    const response = await fetch(`/api/uploadfile/${uuid}`, {
                        method: "POST",
                        headers: {
                            "X-File-Hash": sha256,
                            "X-User-Location": "US",
                            
                        },
                        body: formData,
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