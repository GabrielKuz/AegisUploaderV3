import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

import { isEntraConfigured } from "../features/auth/authConfig";
import {
  getAccountDisplayName,
  getAccountEmail,
  getActiveAccount,
} from "../features/auth/entraAuth";
import { getDevUser, signOutDevUser } from "../features/auth/devAuth";
import { ThemeToggle } from "../theme/ThemeToggle";
import "./AppLayout.css";

export function SupportLayout() {
  const navigate = useNavigate();
  const { accounts, instance } = useMsal();
  const account = getActiveAccount(instance);
  const devUser = getDevUser();

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  const handleSignOut = () => {
    if (!isEntraConfigured) {
      signOutDevUser();
      navigate("/", { replace: true });
      return;
    }

    void instance.logoutRedirect({
      postLogoutRedirectUri: "/",
    });
    navigate("/", { replace: true });
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="brand">
          <img
            src="/images/aegis-logo.svg"
            alt="Aegis Software"
            className="logo"
          />

          <div className="divide" aria-hidden="true" />

          <div>
            <span className="product-name">
              Secure Data Portal
            </span>
            <span className="section-name">
              Customer Support
            </span>
          </div>
        </div>

        <div className="user-menu">
          <div>
            <strong>
              {isEntraConfigured
                ? getAccountDisplayName(account)
                : devUser?.name ?? "Support User"}
            </strong>
            <span>
              {isEntraConfigured
                ? getAccountEmail(account)
                : devUser?.email ?? ""}
            </span>
          </div>

          <ThemeToggle />

          <button type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <nav aria-label="Customer support">
          <NavLink
            to="/support"
            end
            className={({ isActive }) =>
              isActive
                ? "nav-link nav-link-active"
                : "nav-link"
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/support/links"
            end
            className={({ isActive }) =>
              isActive
                ? "nav-link nav-link-active"
                : "nav-link"
            }
          >
            Created links
          </NavLink>

          <NavLink
            to="/support/links/new"
            className={({ isActive }) =>
              isActive
                ? "nav-link nav-link-active"
                : "nav-link"
            }
          >
            Create link
          </NavLink>
        </nav>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}