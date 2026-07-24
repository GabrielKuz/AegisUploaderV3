import type {
  AccountInfo,
  IPublicClientApplication,
} from "@azure/msal-browser";
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
  const storedDestination = window.localStorage.getItem(
    POST_LOGIN_REDIRECT_KEY,
  );

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
export type PortalRole = "admin" | "support";

export function getUserRoles(
  account: AccountInfo | null = getActiveAccount(),
): string[] {
  if (!account) {
    return [];
  }

  const claims = account.idTokenClaims as Record<string, unknown> | undefined;

  const roles = claims?.roles;

  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter((role): role is string => typeof role === "string");
}

/**
 * Converts Entra app roles into portal role used by React.
 *
 * Entra role "Admin"  -> admin portal
 * Entra role "User"   -> support portal
 *
 * Admin takes precedence when account has both roles.
 */
export function getPortalRole(
  account: AccountInfo | null = getActiveAccount(),
): PortalRole | null {
  const roles = new Set(
    getUserRoles(account).map((role) => role.trim().toLowerCase()),
  );

  if (roles.has("admin")) {
    return "admin";
  }

  if (roles.has("user") || roles.has("support")) {
    return "support";
  }

  return null;
}

export function isAdmin(
  account: AccountInfo | null = getActiveAccount(),
): boolean {
  return getPortalRole(account) === "admin";
}

export function isSupportUser(
  account: AccountInfo | null = getActiveAccount(),
): boolean {
  return getPortalRole(account) === "support";
}

export function getDefaultPortalPath(
  account: AccountInfo | null = getActiveAccount(),
): "/admin" | "/support" | null {
  const role = getPortalRole(account);

  if (role === "admin") {
    return "/admin";
  }

  if (role === "support") {
    return "/support";
  }

  return null;
}

function isSafeInternalPath(destination: string): boolean {
  return destination.startsWith("/") && !destination.startsWith("//");
}

/**
 * Ensures a stored redirect is valid for account's actual role.
 *
 * Admin accounts cannot enter /support.
 * Support accounts cannot enter /admin.
 */
export function getAuthorizedPortalDestination(
  account: AccountInfo | null,
  requestedDestination?: string,
): string | null {
  const role = getPortalRole(account);
  const defaultDestination = getDefaultPortalPath(account);

  if (!role || !defaultDestination) {
    return null;
  }

  if (!requestedDestination || !isSafeInternalPath(requestedDestination)) {
    return defaultDestination;
  }

  if (
    role === "admin" &&
    (requestedDestination === "/admin" ||
      requestedDestination.startsWith("/admin/"))
  ) {
    return requestedDestination;
  }

  if (
    role === "support" &&
    (requestedDestination === "/support" ||
      requestedDestination.startsWith("/support/"))
  ) {
    return requestedDestination;
  }

  return defaultDestination;
}
