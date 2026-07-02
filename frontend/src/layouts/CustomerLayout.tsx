import {
    Navigate,
    NavLink,
    Outlet,
    useParams,
} from "react-router-dom";

import { ThemeToggle } from "../theme/ThemeToggle";
import "./AppLayout.css";

export function CustomerLayout() {
    const { uuid } = useParams();

    if (!uuid) {
        return <Navigate to="/" replace />;
    }

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
                        to={`/upload/${uuid}`}
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
                        to={`/upload/${uuid}/details`}
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