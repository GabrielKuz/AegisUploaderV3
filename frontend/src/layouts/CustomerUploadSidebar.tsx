import { useCustomerUpload } from "./CustomerLayoutContext";
import "./CustomerUploadSidebar.css";

export function CustomerUploadSidebar() {
    const {
        uploadedCount,
        uploadedBytes,
        uuid,
    } = useCustomerUpload();

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 B";

        const units = [
            "B",
            "KB",
            "MB",
            "GB",
        ];

        const i = Math.floor(
            Math.log(bytes) / Math.log(1024)
        );

        return `${(
            bytes / Math.pow(1024, i)
        ).toFixed(1)} ${units[i]}`;
    };

    return (
        <div className="customer-upload-sidebar">
            <div className="customer-upload-sidebar-title">
                Upload Summary
            </div>

            <div className="customer-upload-sidebar-item">
                <span>Files Uploaded</span>
                <strong>{uploadedCount}</strong>
            </div>

            <div className="customer-upload-sidebar-item">
                <span>Total Uploaded</span>
                <strong>{formatBytes(uploadedBytes)}</strong>
            </div>

            <div className="customer-upload-sidebar-item">
                <span>Upload Link</span>
                <code>{uuid}</code>
            </div>
        </div>
    );
}