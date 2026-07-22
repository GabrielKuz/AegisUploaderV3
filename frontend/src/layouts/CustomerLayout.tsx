import { Navigate, useParams } from "react-router-dom";

import { AppLayout } from "./AppLayout";
import {
    CustomerUploadProvider,
    useCustomerUpload,
} from "../features/customer/CustomerUploadContext";
import { formatBytes } from "../utils/formatters";

/**
 * Displays customer upload statistics in the application sidebar.
 */
function CustomerUploadSummary() {
    const {
        uploadedCount,
        uploadedBytes,
        uuid,
    } = useCustomerUpload();

    return (
        <section
            className="customer-upload-summary"
            aria-labelledby="upload-summary-title"
        >
            <h2
                id="upload-summary-title"
                className="customer-upload-summary-title"
            >
                Upload Summary
            </h2>

            <dl className="customer-upload-summary-list">
                <div className="customer-upload-summary-item">
                    <dt>Files Uploaded</dt>
                    <dd>{uploadedCount}</dd>
                </div>

                <div className="customer-upload-summary-item">
                    <dt>Total Uploaded</dt>
                    <dd>{formatBytes(uploadedBytes)}</dd>
                </div>

                <div className="customer-upload-summary-item">
                    <dt>UUID</dt>
                    <dd>
                        <code>{uuid}</code>
                    </dd>
                </div>
            </dl>
        </section>
    );
}

/**
 * Provides customer upload routes with shared state and layout.
 */
export function CustomerLayout() {
    const { uuid } = useParams<{
        uuid: string;
    }>();

    if (!uuid) {
        return <Navigate to="/" replace />;
    }

    return (
        <CustomerUploadProvider
            key={uuid}
            uuid={uuid}
        >
            <AppLayout
                productName="Customer Upload"
                sectionName="Provide Files"
                navLabel="Upload summary"
                sidebarContent={<CustomerUploadSummary />}
                showUserMenu={false}
                showSignOut={false}
            />
        </CustomerUploadProvider>
    );
}