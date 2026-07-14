import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

import { isEntraConfigured } from "../features/auth/authConfig";
import { getActiveAccount } from "../features/auth/entraAuth";
import { getDevUser, signOutDevUser } from "../features/auth/devAuth";
import { ThemeToggle } from "../theme/ThemeToggle";

import "./AppLayout.css";

type PortalNavItem = {
    to: string;
    label: string;
    end?: boolean;
};

type PortalLayoutProps = {
    productName: string;
    sectionName: string;
    navLabel?: string;
    navItems?: PortalNavItem[];
    sidebarContent?: React.ReactNode;
    defaultUserName?: string;
    showUserMenu?: boolean;
    showSignOut?: boolean;
};

function getNavLinkClassName({ isActive }: { isActive: boolean }) {
    return isActive ? "nav-link nav-link-active" : "nav-link";
}

export function PortalLayout({
    productName,
    sectionName,
    navLabel = "Portal navigation",
    navItems = [],
    sidebarContent,
    defaultUserName = "Support User",
    showUserMenu = true,
    showSignOut = true,
}: PortalLayoutProps) {
    const navigate = useNavigate();
    const { accounts, instance } = useMsal();

    const devUser = getDevUser();
    const entraAccount = getActiveAccount(instance) ?? accounts[0];
    const showSidebar = navItems.length > 0 || Boolean(sidebarContent);

    const displayName =
        entraAccount?.name ??
        devUser?.name ??
        defaultUserName;

    const displayEmail =
        entraAccount?.username ??
        devUser?.email;

    const handleSignOut = async () => {
        signOutDevUser();

        if (isEntraConfigured) {
            const account = getActiveAccount(instance) ?? accounts[0];

            if (account && !instance.getActiveAccount()) {
                instance.setActiveAccount(account);
            }

            await instance.logoutRedirect({
                account: account ?? undefined,
                postLogoutRedirectUri: window.location.origin,
            });

            return;
        }

        navigate("/", { replace: true });
    };

    return (
        <div className={showSidebar ? "layout" : "layout layout-no-sidebar"}>
            <header className="header">
                <div className="brand">
                    <img
                        src="/images/Aegis-Logo.svg"
                        alt="Aegis Software"
                        className="logo"
                    />

                    <div className="divide" aria-hidden="true" />

                    <div className="title">
                        <span className="product-name">{productName}</span>
                        <span className="section-name">{sectionName}</span>
                    </div>
                </div>

                <div className="header-actions">
                    {showUserMenu && (
                        <div className="user-details">
                            <strong className="user-name">
                                {displayName}
                            </strong>

                            {displayEmail && (
                                <span className="email">
                                    {displayEmail}
                                </span>
                            )}
                        </div>
                    )}

                    <ThemeToggle />

                    {showSignOut && (
                        <button
                            className="user-button"
                            type="button"
                            onClick={handleSignOut}
                        >
                            Sign out
                        </button>
                    )}
                </div>
            </header>

            {(showSidebar || sidebarContent) && (
                <aside className="sidebar">
                    {sidebarContent ? (
                        sidebarContent
                    ) : (
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

            <main className="main">
                <Outlet />
            </main>
        </div>
    );
}