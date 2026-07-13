import { Navigate, useParams } from "react-router-dom";

import { PortalLayout } from "./PortalLayout";

export function CustomerLayout() {
    const { uuid } = useParams();

    if (!uuid) {
        return <Navigate to="/" replace />;
    }

    return (
        <PortalLayout
            productName="Customer Upload"
            sectionName="Provide files for support"
            showUserMenu={false}
            showSignOut={false}
        />
    );
}