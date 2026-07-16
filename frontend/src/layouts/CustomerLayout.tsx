
import { Navigate, useParams } from "react-router-dom";

import { AppLayout } from "./AppLayout";
import { CustomerUploadProvider } from "./CustomerLayoutContext";
import { CustomerUploadSidebar } from "./CustomerUploadSidebar";

export function CustomerLayout() {
    const { uuid } = useParams();

    if (!uuid) {
        return <Navigate to="/" replace />;
    }

    return (
        <CustomerUploadProvider uuid={uuid}>
            <AppLayout
                productName="Customer Upload"
                sectionName="Provide Files"
                navLabel="Upload summary"
                sidebarContent={<CustomerUploadSidebar />}
                showUserMenu={false}
                showSignOut={false}
            />
        </CustomerUploadProvider>
    );
}