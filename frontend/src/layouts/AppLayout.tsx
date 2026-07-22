import type { ReactNode } from "react";
import { useMsal } from "@azure/msal-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { isEntraConfigured } from "../features/auth/authConfig";
import { getDevUser, signOutDevUser } from "../features/auth/devAuth";
import { getActiveAccount } from "../features/auth/entraAuth";
import { ThemeToggle } from "../theme/ThemeToggle";

import "./AppLayout.css";

type AppNavItem = {
  to: string;
  label: string;
  end?: boolean;
};

type AppLayoutProps = {
  productName: string;
  sectionName: string;
  navLabel?: string;
  navItems?: readonly AppNavItem[];
  sidebarContent?: ReactNode;
  defaultUserName?: string;
  showUserMenu?: boolean;
  showSignOut?: boolean;
};

function getNavLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? "app-nav-link app-nav-link--active" : "app-nav-link";
}

/**
 * Shared application shell for the support, admin,
 * and customer portals.
 */
export function AppLayout({
  productName,
  sectionName,
  navLabel = "Portal navigation",
  navItems = [],
  sidebarContent,
  defaultUserName = "Support User",
  showUserMenu = true,
  showSignOut = true,
}: AppLayoutProps) {
  const navigate = useNavigate();
  const { instance } = useMsal();

  const account = isEntraConfigured ? getActiveAccount(instance) : null;

  const devUser = isEntraConfigured ? null : getDevUser();

  const showSidebar = navItems.length > 0 || Boolean(sidebarContent);

  const displayName = account?.name ?? devUser?.name ?? defaultUserName;

  const displayEmail = account?.username ?? devUser?.email;

  const layoutClassName = showSidebar
    ? "app-layout"
    : "app-layout app-layout--no-sidebar";

  async function handleSignOut(): Promise<void> {
    if (!isEntraConfigured) {
      signOutDevUser();

      navigate("/", {
        replace: true,
      });

      return;
    }

    if (account && !instance.getActiveAccount()) {
      instance.setActiveAccount(account);
    }

    await instance.logoutRedirect({
      account: account ?? undefined,
      postLogoutRedirectUri: window.location.origin,
    });
  }

  return (
    <div className={layoutClassName}>
      <header className="app-header">
        <div className="app-brand">
          <img
            className="app-logo"
            src="/images/Aegis-Logo.svg"
            alt="Aegis Software"
          />

          <div className="app-divider" aria-hidden="true" />

          <div className="app-title">
            <span className="app-product-name">{productName}</span>

            <span className="app-section-name">{sectionName}</span>
          </div>
        </div>

        <div className="app-header-actions">
          {showUserMenu && (
            <div className="app-user-details">
              <strong className="app-user-name">{displayName}</strong>

              {displayEmail && (
                <span className="app-user-email">{displayEmail}</span>
              )}
            </div>
          )}

          <ThemeToggle />

          {showSignOut && (
            <button
              className="app-sign-out"
              type="button"
              onClick={() => void handleSignOut()}
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {showSidebar && (
        <aside
          className="app-sidebar"
          aria-label={sidebarContent ? navLabel : undefined}
        >
          {sidebarContent ?? (
            <nav aria-label={navLabel}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={getNavLinkClassName}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </aside>
      )}

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
