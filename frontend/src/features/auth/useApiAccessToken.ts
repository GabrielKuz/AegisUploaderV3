import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import {
    isDevAuthEnabled,
    isEntraConfigured,
} from "./authConfig";
import { getDevToken } from "./devAuth";
import {
    getActiveAccount,
    getApiAccessToken,
} from "./entraAuth";

/**
 * Returns correct API token for current authentication mode.
 *
 * LoginPage responsible for signing users in. This hook only
 * acquires token for existing Entra or development session.
 */
export function useApiAccessToken():
    () => Promise<string | null> {
    const { instance } = useMsal();

    return useCallback(async () => {
        if (isDevAuthEnabled) {
            return getDevToken();
        }

        if (
            !isEntraConfigured ||
            !getActiveAccount(instance)
        ) {
            return null;
        }

        return getApiAccessToken(instance);
    }, [instance]);
}
