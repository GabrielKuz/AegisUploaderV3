import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

import { isEntraConfigured } from "./authConfig";
import { getActiveAccount } from "./entraAuth";
import { getDevUser } from "./devAuth";

type RequireEntraUserProps = {
  children: ReactNode;
};

export function RequireEntraUser({ children }: RequireEntraUserProps) {
  const location = useLocation();
  const { accounts, instance } = useMsal();
  const account = getActiveAccount(instance);
  const devUser = getDevUser();

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  if (isEntraConfigured && !account) {
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

  if (!isEntraConfigured && !devUser) {
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
