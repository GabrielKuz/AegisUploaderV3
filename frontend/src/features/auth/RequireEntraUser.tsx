import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

import { isEntraConfigured } from "./authConfig";
import { getDevUser } from "./devAuth";
import { getActiveAccount, getPortalRole, type PortalRole } from "./entraAuth";

type RequireEntraUserProps = {
  children: ReactNode;
  requiredRole?: PortalRole;
};

function getDevPortalRole(): PortalRole | null {
  const devUser = getDevUser();

  if (devUser?.role === "admin") {
    return "admin";
  }

  if (devUser?.role === "support") {
    return "support";
  }

  return null;
}

export function RequireEntraUser({
  children,
  requiredRole,
}: RequireEntraUserProps) {
  const location = useLocation();
  const { accounts, instance } = useMsal();

  const account = getActiveAccount(instance);

  const devUser = getDevUser();

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  const isAuthenticated = isEntraConfigured
    ? Boolean(account)
    : Boolean(devUser);

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          from: `${location.pathname}` + `${location.search}`,
        }}
      />
    );
  }

  const currentRole = isEntraConfigured
    ? getPortalRole(account)
    : getDevPortalRole();

  if (requiredRole && currentRole !== requiredRole) {
    /*
     * Redirect recognized users to their own portal.
     * This prevents changing roles by editing the URL.
     */
    if (currentRole === "admin") {
      return <Navigate to="/admin" replace />;
    }

    if (currentRole === "support") {
      return <Navigate to="/support" replace />;
    }

    return (
      <main className="access-denied-page" role="alert">
        <h1>Access not assigned</h1>

        <p>
          Your account is authenticated, but it does not have an Admin or User
          portal role. Contact an administrator to have the correct Entra
          application role assigned.
        </p>
      </main>
    );
  }

  return children;
}
