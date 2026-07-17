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
import { getActiveAccount } from "./entraAuth";

type RequireAuthenticatedUserProps = {
    children: ReactNode;
};

/**
 * Protects routes that require an authenticated user.
 *
 * In deployed environments, authentication comes from Microsoft Entra.
 * In local development, authentication comes from the stored dev user.
 */
export function RequireAuthenticatedUser({
    children,
}: RequireAuthenticatedUserProps) {
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

    return children;
}