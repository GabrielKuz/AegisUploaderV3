import { PublicClientApplication } from "@azure/msal-browser";

const DEFAULT_CLIENT_ID = "00000000-0000-0000-0000-000000000000";

const tenantId = import.meta.env.VITE_AZURE_TENANT_ID ?? "common";

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? DEFAULT_CLIENT_ID;

export const isEntraConfigured = Boolean(
  import.meta.env.VITE_AZURE_TENANT_ID &&
  import.meta.env.VITE_AZURE_CLIENT_ID,
);

export const isDevAuthEnabled =
  import.meta.env.DEV &&
  !isEntraConfigured;

const apiScope =
  import.meta.env.VITE_AZURE_API_SCOPE ??
  (isEntraConfigured ? `api://${clientId}/access_as_user` : "User.Read");

export const msalConfig = {
  auth: {
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientId,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [apiScope],
};

export const apiRequest = {
  scopes: [apiScope],
};

export const msalInstance =
  new PublicClientApplication(msalConfig);

/**
 * Initializes MSAL, processes login redirect, and establishes
 * active account used throughout application.
 */
export async function initializeMsalInstance():
  Promise<void> {
  await msalInstance.initialize();

  const redirectResult = await msalInstance.handleRedirectPromise();

  const account =
    redirectResult?.account ??
    msalInstance.getActiveAccount() ??
    msalInstance.getAllAccounts()[0] ??
    null;

  if (account) {
    msalInstance.setActiveAccount(account);
  }
}