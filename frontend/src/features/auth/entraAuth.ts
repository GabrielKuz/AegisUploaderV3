import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type IPublicClientApplication,
} from "@azure/msal-browser";

import {
  apiRequest,
  msalInstance,
} from "./authConfig";

const POST_LOGIN_REDIRECT_KEY =
  "aegis-post-login-redirect";

/**
 * Returns active account for supplied MSAL instance.
 *
 * Retains first cached account as fallback, due to
 * application using single-account login flow.
*/
export function getActiveAccount(
  instance:
    IPublicClientApplication =
    msalInstance,
): AccountInfo | null {
  return (
    instance.getActiveAccount() ??
    instance.getAllAccounts()[0] ??
    null
  );
}

export function getAccountDisplayName(
  account: AccountInfo | null,
): string {
  return (
    account?.name ??
    account?.username ??
    "Signed-in user"
  );
}

export function getAccountEmail(
  account: AccountInfo | null,
): string {
  return (
    account?.username ??
    account?.idTokenClaims
      ?.preferred_username ??
    ""
  );
}

export function setPostLoginRedirect(
  destination: string,
): void {
  window.sessionStorage.setItem(
    POST_LOGIN_REDIRECT_KEY,
    destination,
  );
}

export function getPostLoginRedirect(
  defaultDestination = "/support",
): string {
  const storedDestination = window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY,);
  const isSafeInternalPath = typeof storedDestination === "string" && storedDestination.startsWith("/") && !storedDestination.startsWith("//");

  return isSafeInternalPath ? storedDestination : defaultDestination;
}

export function clearPostLoginRedirect():
  void {
  window.sessionStorage.removeItem(
    POST_LOGIN_REDIRECT_KEY,
  );
}

/**
 * Acquires API access token for account already authenticated
 * through LoginPage and MSAL initialization.
*
 * Function does not start original login flow. It redirects
 * only when Microsoft requires renewed interaction for token access.
*/
export async function getApiAccessToken(
  instance:
    IPublicClientApplication =
    msalInstance,
): Promise<string> {
  const account =
    getActiveAccount(instance);

  if (!account) {
    throw new Error(
      "No signed-in account is available.",
    );
  }

  if (!instance.getActiveAccount()) {
    instance.setActiveAccount(account);
  }

  try {
    const result =
      await instance.acquireTokenSilent({
        ...apiRequest,
        account,
      });

    return result.accessToken;
  } catch (error) {
    if (
      error instanceof
      InteractionRequiredAuthError
    ) {
      await instance.acquireTokenRedirect({
        ...apiRequest,
        account,
      });
    }

    throw error;
  }
}

export function getUserRoles(
  account:
    AccountInfo | null =
    getActiveAccount(),
): string[] {
  if (!account) {
    return [];
  }

  const claims =
    account.idTokenClaims as
    | Record<string, unknown>
    | undefined;

  const roles = claims?.roles;

  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter(
    (role): role is string =>
      typeof role === "string",
  );
}

export function isAdmin(
  account:
    AccountInfo | null =
    getActiveAccount(),
): boolean {
  return getUserRoles(account).includes(
    "Admin",
  );
}