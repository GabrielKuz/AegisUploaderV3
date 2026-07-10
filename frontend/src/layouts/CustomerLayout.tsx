import { Navigate, useParams } from "react-router-dom";

import { PortalLayout } from "./PortalLayout";
import { CustomerUploadProvider } from "./CustomerLayoutContext";
import { CustomerUploadSidebar } from "./CustomerUploadSidebar";

export function CustomerLayout() {
    const { uuid } = useParams();

    if (!uuid) {
        return <Navigate to="/" replace />;
    }

    return (
        <CustomerUploadProvider uuid={uuid}>
            <PortalLayout
                productName="Customer Upload"
                sectionName="Provide Files"
                sidebarContent={<CustomerUploadSidebar />}
            />
        </CustomerUploadProvider>
    );
}