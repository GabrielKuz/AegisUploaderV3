import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getDevUser, signOutDevUser } from "../features/auth/devAuth";
import { ThemeToggle } from "../theme/ThemeToggle";
import "./SupportLayout.css";

export function SupportLayout() {
  const navigate = useNavigate();
  const user = getDevUser();

  const handleSignOut = () => {
    signOutDevUser();
    navigate("/", { replace: true });
  };

  return (
    <div className="support-layout">
      <header className="support-header">
        <div className="support-brand">
          <img
            src="/images/aegis-logo.svg"
            alt="Aegis Software"
            className="support-logo"
          />

          <div className="divide">
            |
          </div>

          <div>
            <span className="support-product-name">
              Secure Data Portal
            </span>
            <span className="support-section-name">
              Customer Support
            </span>
          </div>
        </div>

        <div className="support-user-menu">
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

      <aside className="support-sidebar">
        <nav aria-label="Customer support">
          <NavLink
            to="/support"
            end
            className={({ isActive }) =>
              isActive
                ? "support-nav-link support-nav-link-active"
                : "support-nav-link"
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/support/links"
            className={({ isActive }) =>
              isActive
                ? "support-nav-link support-nav-link-active"
                : "support-nav-link"
            }
          >
            Created links
          </NavLink>

          <NavLink
            to="/support/links/new"
            className={({ isActive }) =>
              isActive
                ? "support-nav-link support-nav-link-active"
                : "support-nav-link"
            }
          >
            Create link
          </NavLink>
        </nav>
      </aside>

      <main className="support-main">
        <Outlet />
      </main>
    </div>
  );
}