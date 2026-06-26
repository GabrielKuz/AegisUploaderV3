import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getDevUser } from "./devAuth";

type RequireSupportUserProps = {
  children: ReactNode;
};

export function RequireSupportUser({
  children,
}: RequireSupportUserProps) {
  const location = useLocation();
  const user = getDevUser();

  if (!user) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}