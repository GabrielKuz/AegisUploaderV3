import { Navigate, useParams } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

import { isEntraConfigured } from "./authConfig";
import { getDevUser } from "./devAuth";
import { getActiveAccount, getPortalRole } from "./entraAuth";

export function RoleAwareRedirect() {
  const { uuid } = useParams<{
    uuid: string;
  }>();

  const { instance } = useMsal();

  if (!uuid) {
    return <Navigate to="/" replace />;
  }

  if (!isEntraConfigured) {
    const devUser = getDevUser();

    if (devUser?.role === "admin") {
      return <Navigate to={`/admin/view-uploads/${uuid}`} replace />;
    }

    if (devUser?.role === "support") {
      return <Navigate to={`/support/view-uploads/${uuid}`} replace />;
    }

    return (
      <Navigate
        to="/"
        replace
        state={{
          from: `/view-uploads/${uuid}`,
        }}
      />
    );
  }

  const account = getActiveAccount(instance);

  if (!account) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          from: `/view-uploads/${uuid}`,
        }}
      />
    );
  }

  const role = getPortalRole(account);

  if (role === "admin") {
    return <Navigate to={`/admin/view-uploads/${uuid}`} replace />;
  }

  if (role === "support") {
    return <Navigate to={`/support/view-uploads/${uuid}`} replace />;
  }

  return (
    <main role="alert">
      <h1>Access not assigned</h1>

      <p>Your account does not have an Admin or User application role.</p>
    </main>
  );
}
