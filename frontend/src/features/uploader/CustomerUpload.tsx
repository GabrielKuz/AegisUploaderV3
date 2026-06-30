import "./CustomerUpload.css";
import "../../styles/SupportTheme.css";
import { useRef, useState } from "react";
import { useParams } from "react-router-dom";

export function CustomerUpload() {
    const { uuid } = useParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    type SelectedFile = {
        file: File;
        preview: string;
    };

    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        console.log("selectedFiles:", selectedFiles);

        if (!files) return;

        const newFiles = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));

        setSelectedFiles(prev => {
            const existingNames = new Set(prev.map(f => f.file.name));
            const filteredNew = newFiles.filter(
                f => !existingNames.has(f.file.name)
            );
            return [...prev, ...filteredNew];
        });
    };

    const removeFile = (indexToRemove: number) => {
        setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    return (
        <main className="support-main">
            <div className="upload-content">
                {uuid && (
                    <p className="note">
                        Upload link ID: {uuid}
                    </p>
                )}

                <p className="note">
                    <b>Note:</b> This link is temporary and will cease
                    working after (insert time here). Please ensure that
                    you upload your files by the given time remaining.
                </p>

                <div className="upload-box">
                    <p>Choose file(s) or drag and drop here</p>
                    <button className="browse-button" onClick={handleBrowseClick}>
                        Browse Files
                    </button>

                    {selectedFiles.length > 0 && (
                        <div className="selected-files">


                            {selectedFiles.map((item, index) => (
                                <div key={index} className="selected-file">
                                    <span>{item.file.name}</span>

                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <a
                                            href={item.preview}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Preview
                                        </a>

                                        <button
                                            onClick={() => removeFile(index)}
                                            className="delete-button"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        multiple style={{ display: "none" }}
                        onChange={handleFileChange}
                    />

                    {selectedFiles.length > 0 && (
                        <button className="browse-button">
                            Upload Files
                        </button>
                    )}
                </div>

            </div>

        </main>
    );

}