import "./Layout.css";
import { ThemeToggle } from "../theme/ThemeToggle";
import { NavLink, Outlet } from "react-router-dom";
export function CustomerLayout() {
    return (
        <div className="layout">
            <header className="header">
                <div className="brand">
                    <img
                        src="/images/aegis-logo.svg"
                        alt="Aegis Software"
                        className="logo"
                    />

                    <div className="divide">
                        |
                    </div>
                    <div className="title">
                        <span className="product-name">
                            Customer Upload
                        </span>
                        <span className="section-name">
                            Provide files for support
                        </span>
                    </div>
                </div>
                <div className="header-actions">
                    <ThemeToggle />
                </div>
            </header>

            <aside className="sidebar">
                <nav aria-label="Customer Upload">
                    <NavLink
                        to="/upload"
                        end
                        className={({ isActive }) =>
                            isActive
                                ? "nav-link nav-link-active"
                                : "nav-link"
                        }
                    >
                        Upload Files
                    </NavLink>

                    <NavLink
                        to="/upload/details"
                        className={({ isActive }) =>
                            isActive
                                ? "nav-link nav-link-active"
                                : "nav-link"
                        }
                    >
                        Upload Details
                    </NavLink>
                </nav>
            </aside>

            <main className="main">
                <Outlet />
            </main>
        </div>
    );
}