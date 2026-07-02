import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getDevUser, signOutDevUser } from "../features/auth/devAuth";
import { ThemeToggle } from "../theme/ThemeToggle";
import "./Layout.css";

export function SupportLayout() {
  const navigate = useNavigate();
  const user = getDevUser();

  const handleSignOut = () => {
    signOutDevUser();
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

          <div className="divide">
            |
          </div>

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
            <strong>{user?.name ?? "Support User"}</strong>
            <span>{user?.email}</span>
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