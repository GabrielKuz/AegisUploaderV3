import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import { apiRequest, msalInstance } from "./authConfig";

const POST_LOGIN_REDIRECT_KEY = "aegis-post-login-redirect";

export function getActiveAccount(
  instance: IPublicClientApplication = msalInstance,
): AccountInfo | null {
  return instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
}

export function getAccountDisplayName(account: AccountInfo | null): string {
  return account?.name ?? account?.username ?? "Signed-in user";
}

export function getAccountEmail(account: AccountInfo | null): string {
  return account?.username ?? account?.idTokenClaims?.preferred_username ?? "";
}

export function setPostLoginRedirect(destination: string): void {
  window.localStorage.setItem(POST_LOGIN_REDIRECT_KEY, destination);
}

export function getPostLoginRedirect(defaultDestination = "/support"): string {
  const storedDestination = window.localStorage.getItem(POST_LOGIN_REDIRECT_KEY);

  if (
    storedDestination &&
    storedDestination.startsWith("/") &&
    !storedDestination.startsWith("//")
  ) {
    return storedDestination;
  }

  return defaultDestination;
}

export function clearPostLoginRedirect(): void {
  window.localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
}

export async function getApiAccessToken(
  instance: IPublicClientApplication = msalInstance,
  account: AccountInfo | null = getActiveAccount(instance),
): Promise<string> {
  const activeAccount = account ?? getActiveAccount(instance);

  if (!activeAccount) {
    throw new Error("No signed-in account is available");
  }

  try {
    const result = await instance.acquireTokenSilent({
      ...apiRequest,
      account: activeAccount,
    });

    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect({
        ...apiRequest,
        account: activeAccount,
      });
    }

    throw error;
  }
}
export function getUserRoles(
  account: AccountInfo | null = getActiveAccount(),
): string[] {
  if (!account) {
    return [];
  }

  const claims = account.idTokenClaims as Record<string, unknown>;

  const roles = claims["roles"];

  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter((role): role is string => typeof role === "string");
}

export function isAdmin(
  account: AccountInfo | null = getActiveAccount(),
): boolean {
  return getUserRoles(account).includes("Admin");
}