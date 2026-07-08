import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getDevUser } from "./devAuth";
 
type RequireDevUserProps = {
  children: ReactNode;
};
 
export function RequireDevUser({ children }: RequireDevUserProps) {
  const location = useLocation();
  const user = getDevUser();
 
  if (!user) {
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
