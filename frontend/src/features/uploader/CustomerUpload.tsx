import {
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import { useParams } from "react-router-dom";

import "../../styles/SupportTheme.css";
import "./CustomerUpload.css";

type SelectedFile = {
    file: File;
    preview: string;
};

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
            for (const item of selectedFiles) {
                setUploadStatus((currentStatus) => ({
                    ...currentStatus,
                    [item.file.name]: "uploading",
                }));

                const formData = new FormData();
                formData.append("file", item.file);

                const fileBuffer = await item.file.arrayBuffer();
                const hashBuffer = await crypto.subtle.digest(
                    "SHA-256",
                    fileBuffer,
                );

                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const sha256 = hashArray
                    .map((byte) => byte.toString(16).padStart(2, "0"))
                    .join("");

                const response = await fetch(`/api/uploadfile/${uuid}`, {
                    method: "POST",
                    headers: {
                        Region: "US",
                        "X-File-Hash": sha256,
                    },
                    body: formData,
                });

                if (!response.ok) {
                    setUploadStatus((currentStatus) => ({
                        ...currentStatus,
                        [item.file.name]: "error",
                    }));
                    continue;
                }

                setUploadStatus((currentStatus) => ({
                    ...currentStatus,
                    [item.file.name]: "done",
                }));
            }
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