import type { ReactNode } from "react";
import { useMsal } from "@azure/msal-react";
import {
    Navigate,
    useLocation,
} from "react-router-dom";
import {
    isDevAuthEnabled,
    isEntraConfigured,
} from "./authConfig";
import { getDevUser } from "./devAuth";
import {
    getActiveAccount,
    isAdmin,
} from "./entraAuth";

type RequireAdminUserProps = {
    children: ReactNode;
};

/**
 * Protects routes that require administrator access.
 *
 * Entra environments use the Admin application role.
 * Local development uses the stored dev-user role.
 */
export function RequireAdminUser({
    children,
}: RequireAdminUserProps) {
    const location = useLocation();
    const { instance } = useMsal();

    const account = isEntraConfigured
        ? getActiveAccount(instance)
        : null;

    const devUser = isDevAuthEnabled
        ? getDevUser()
        : null;

    const isAuthenticated =
        Boolean(account) ||
        Boolean(devUser);

    const hasAdminAccess = isEntraConfigured
        ? isAdmin(account)
        : devUser?.role === "admin";

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/"
                replace
                state={{
                    from: `${location.pathname}${location.search}`,
                }}
            />
        );
    }

    if (!hasAdminAccess) {
        return (
            <Navigate
                to="/support"
                replace
            />
        );
    }

    return children;
}