import { useCallback, useEffect } from "react";
import { useMsal } from "@azure/msal-react";

import { isEntraConfigured } from "./authConfig";
import { getDevToken } from "./devAuth";
import { getActiveAccount, getApiAccessToken } from "./entraAuth";

/**
 * Returns API token for current authenticated session.
 * Route protection remains responsibility of RequireEntraUser.
 * Hook only provides tokens to API-calling components.
 */
export function useApiAccessToken(): () => Promise<string | null> {
  const { accounts, instance } = useMsal();

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  return useCallback(async () => {
    if (!isEntraConfigured) {
      return getDevToken();
    }

    const account = getActiveAccount(instance) ?? accounts[0] ?? null;

    if (!account) {
      return null;
    }

    if (!instance.getActiveAccount()) {
      instance.setActiveAccount(account);
    }

    return getApiAccessToken(instance, account);
  }, [accounts, instance]);
}
