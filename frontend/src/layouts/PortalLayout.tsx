import { NavLink, Outlet, useNavigate } from "react-router-dom";

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
    defaultUserName?: string;
    showUserMenu?: boolean;
    showSignOut?: boolean;
    sidebarContent?: React.ReactNode;
};

function getNavLinkClassName({ isActive }: { isActive: boolean }) {
    return isActive ? "nav-link nav-link-active" : "nav-link";
}

export function PortalLayout({
    productName,
    sectionName,
    navLabel = "Portal navigation",
    navItems = [],
    defaultUserName = "Support User",
    showUserMenu = true,
    showSignOut = true,
    sidebarContent,
}: PortalLayoutProps) {
    const navigate = useNavigate();
    const user = getDevUser();
    const showSidebar = navItems.length > 0 || !!sidebarContent;

    const handleSignOut = () => {
        signOutDevUser();
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
                        <strong className="product-name">{productName}</strong>
                        <span className="section-name">{sectionName}</span>
                    </div>
                </div>

                <div className="header-actions">
                    {showUserMenu && (
                        <div className="user-details">
                            <strong className="user-name">
                                {user?.name ?? defaultUserName}
                            </strong>

                            {user?.email && (
                                <span className="email">
                                    {user.email}
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