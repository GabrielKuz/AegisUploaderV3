import { PublicClientApplication } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_AZURE_TENANT_ID ?? "common";
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? "00000000-0000-0000-0000-000000000000";
const isEntraConfigured = Boolean(
    import.meta.env.VITE_AZURE_TENANT_ID && import.meta.env.VITE_AZURE_CLIENT_ID,
);

const apiScope =
    import.meta.env.VITE_AZURE_API_SCOPE ??
    (isEntraConfigured ? `api://${clientId}/access_as_user` : "User.Read");

export const msalConfig = {
    auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
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

export { isEntraConfigured };

export const msalInstance = new PublicClientApplication(msalConfig);

export async function initializeMsalInstance(): Promise<void> {
    await msalInstance.initialize();

    const redirectResult = await msalInstance.handleRedirectPromise();

    if (redirectResult?.account) {
        msalInstance.setActiveAccount(redirectResult.account);
    }

    const activeAccount =
        msalInstance.getActiveAccount() ??
        msalInstance.getAllAccounts()[0] ??
        null;

    if (activeAccount) {
        msalInstance.setActiveAccount(activeAccount);
    }
}