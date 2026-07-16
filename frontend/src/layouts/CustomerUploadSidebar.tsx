
import { useCustomerUpload } from "./CustomerLayoutContext";

import "./CustomerUploadSidebar.css";

const BYTE_UNITS = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
] as const;

function formatBytes(bytes: number): string {
    if (bytes <= 0) {
        return "0 B";
    }

    const unitIndex = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        BYTE_UNITS.length - 1,
    );

    const value = bytes / 1024 ** unitIndex;

    return `${value.toFixed(1)} ${BYTE_UNITS[unitIndex]} `;
}

export function CustomerUploadSidebar() {
    const {
        uploadedCount,
        uploadedBytes,
        uuid,
    } = useCustomerUpload();

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
                <span>UUID</span>
                <code>{uuid}</code>
            </div>
        </div>
    );
}