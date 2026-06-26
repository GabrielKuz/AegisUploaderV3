import { useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "../../theme/ThemeToggle";
import { signInDevUser } from "./devAuth";
import "./LoginPage.css";

/**
 * Optional navigation state supplied by protected routes.
 *
 * When a user is redirected to login, `from` stores the internal
 * route they originally attempted to access.
 */
type LoginLocationState = {
  from?: unknown;
};

/**
 * Data structure used to render the security highlight cards.
 */
type SecurityItem = {
  number: string;
  title: string;
  description: string;
};

/**
 * Default route used when no valid redirect destination is provided.
 */
const DEFAULT_DESTINATION = "/support";

/**
 * Security features displayed in the left branding panel.
 *
 * Keeping this content in an array avoids repeated JSX and makes
 * future additions easier to maintain.
 */
const securityItems: SecurityItem[] = [
  {
    number: "01",
    title: "Single Sign-On",
    description:
      "Access is handled through your approved company identity provider.",
  },
  {
    number: "02",
    title: "Controlled Data",
    description:
      "Designed for secure ITAR and CUI transfer workflows.",
  },
  {
    number: "03",
    title: "Gov Cloud Ready",
    description:
      "Built for Azure Government Cloud deployment and auditing.",
  },
];

/**
 * Returns a safe internal route for post-login navigation.
 *
 * External URLs and protocol-relative URLs are rejected to prevent
 * untrusted redirects from being used after authentication.
 */
function getSafeDestination(state: unknown): string {
  if (
    typeof state !== "object" ||
    state === null ||
    !("from" in state)
  ) {
    return DEFAULT_DESTINATION;
  }

  const { from } = state as LoginLocationState;

  const isValidInternalPath =
    typeof from === "string" &&
    from.startsWith("/") &&
    !from.startsWith("//");

  return isValidInternalPath
    ? from
    : DEFAULT_DESTINATION;
}

/**
 * Login screen for the secure customer-data portal.
 *
 * The page contains:
 * - Portal branding and security highlights
 * - Theme and support controls
 * - Development SSO authentication
 * - Identity-provider and legal information
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Simulates SSO authentication during development.
   *
   * The destination route determines which mock role is assigned:
   * upload routes receive the customer role, while all other routes
   * receive the support role.
   */
  const handleSsoLogin = () => {
    const destination = getSafeDestination(location.state);

    const role = destination.startsWith("/upload")
      ? "customer"
      : "support";

    signInDevUser(role);
    navigate(destination, { replace: true });
  };

  return (
    <main className="login-page">
      {/* ================================================================
          BRANDING PANEL
          Contains the portal message and security highlights.
          ================================================================ */}
      <section
        className="brand-side"
        aria-labelledby="portal-heading"
      >
        {/* Decorative background grid. */}
        <div
          className="brand-grid"
          aria-hidden="true"
        />

        {/* Decorative diamond shapes. */}
        <div
          className="brand-shapes"
          aria-hidden="true"
        >
          <span className="shape shape-one" />
          <span className="shape shape-two" />
          <span className="shape shape-three" />
          <span className="shape shape-outline" />
        </div>

        {/* Company branding. */}
        <header className="brand-header">
          <img
            className="brand-logo"
            src="/images/aegis-logo.svg"
            alt="Aegis Software"
          />
        </header>

        {/* Primary portal message. */}
        <div className="brand-message">
          <h1 id="portal-heading">
            Secure access for{" "}
            <span>controlled customer data.</span>
          </h1>

          <p className="brand-description">
            A protected portal for transferring ITAR and CUI-related
            files with clear access control, expiration, and audit
            visibility.
          </p>
        </div>

        {/* Security capabilities rendered from shared data. */}
        <section
          className="security-list"
          aria-label="Security highlights"
        >
          {securityItems.map((item) => (
            <article
              className="security-item"
              key={item.number}
            >
              <span
                className="security-number"
                aria-hidden="true"
              >
                {item.number}
              </span>

              <div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </section>
      </section>

      {/* ================================================================
          AUTHENTICATION PANEL
          Contains theme controls, login actions, and legal information.
          ================================================================ */}
      <section
        className="auth-side"
        aria-labelledby="login-heading"
      >
        {/* Page-level controls remain visible at the top of the panel. */}
        <div className="auth-controls">
          <ThemeToggle />

          <a
            className="support-link"
            href="mailto:support@aegissoftware.com"
          >
            Help &amp; Support
          </a>
        </div>

        {/* Primary authentication card. */}
        <section className="auth-card">
          <div
            className="auth-icon"
            aria-hidden="true"
          >
            <span />
          </div>

          <h2 id="login-heading">
            Welcome back
          </h2>

          <p className="auth-copy">
            Continue with your company Single Sign-On account to
            access the secure data portal.
          </p>

          <button
            className="sso-button"
            type="button"
            onClick={handleSsoLogin}
          >
            <span className="sso-button-label">
              Continue with SSO
            </span>

            <span
              className="sso-button-arrow"
              aria-hidden="true"
            >
              ↗
            </span>
          </button>

          <div className="access-note">
            <span>Need access?</span>

            <a href="mailto:admin@aegissoftware.com">
              Contact your administrator
            </a>
          </div>
        </section>

        {/* Identity-provider information. */}
        <aside
          className="identity-card"
          aria-label="Identity provider information"
        >
          <div
            className="identity-grid"
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
            <span />
          </div>

          <div>
            <h3>Microsoft Entra ID</h3>

            <p>
              Enterprise identity authentication for approved users.
            </p>
          </div>
        </aside>

        {/* Security notice and legal navigation. */}
        <footer className="auth-footer">
          <span>
            Protected by enterprise security controls
          </span>

          <nav aria-label="Legal links">
            <a href="/privacy">
              Privacy Policy
            </a>

            <span aria-hidden="true">
              /
            </span>

            <a href="/terms">
              Terms of Use
            </a>
          </nav>
        </footer>
      </section>
    </main>
  );
}