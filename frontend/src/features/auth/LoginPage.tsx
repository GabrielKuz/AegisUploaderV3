import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

import { ThemeToggle } from "../../theme/ThemeToggle";
import { isEntraConfigured, loginRequest } from "./authConfig";
import { signInDevUser } from "./devAuth";
import {
  clearPostLoginRedirect,
  getActiveAccount,
  getPostLoginRedirect,
  setPostLoginRedirect,
} from "./entraAuth";

import "./LoginPage.css";

type LoginLocationState = {
  from?: unknown;
};

type SecurityItem = {
  number: string;
  title: string;
  description: string;
};

const DEFAULT_DESTINATION = "/support";

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

  return isValidInternalPath ? from : DEFAULT_DESTINATION;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts, instance } = useMsal();
  const account = getActiveAccount(instance);

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  useEffect(() => {
    if (!account) {
      return;
    }

    const destination = getPostLoginRedirect(
      getSafeDestination(location.state),
    );

    clearPostLoginRedirect();
    navigate(destination, { replace: true });
  }, [account, location.state, navigate]);

  const handleSsoLogin = () => {
    const destination = getSafeDestination(location.state);

    if (!isEntraConfigured) {
      const role = destination.startsWith("/upload/")
        ? "customer"
        : "support";

      signInDevUser(role);
      navigate(destination, { replace: true });
      return;
    }

    setPostLoginRedirect(destination);
    void instance.loginRedirect(loginRequest);
  };

  return (
    <main className="login-page">
      <header className="login-header">
        <div className="login-header-brand">
          <img
            className="login-header-logo"
            src="/images/Aegis-Logo.svg"
            alt="Aegis Software"
          />

          <div className="login-header-divider" aria-hidden="true" />

          <div className="login-header-title">
            <span className="login-product-name">
              Secure Data Portal
            </span>

            <span className="login-section-name">
              Customer Data Access
            </span>
          </div>
        </div>

        <div className="login-header-actions">
          <ThemeToggle />

          <a className="support-link" href="mailto:helpdesk@AISCorp.com">
            Help &amp; Support
          </a>
        </div>
      </header>

      <section
        className="brand-side"
        aria-labelledby="portal-heading"
      >
        <div className="brand-grid" aria-hidden="true" />

        <div className="brand-shapes" aria-hidden="true">
          <span className="shape shape-one" />
          <span className="shape shape-two" />
          <span className="shape shape-three" />
          <span className="shape shape-outline" />
        </div>

        <div className="brand-message">
          <h1 id="portal-heading">
            Secure access for{" "}
            <span>controlled customer data.</span>
          </h1>

          <p className="brand-description">
            A protected portal for transferring controlled files with
            clear access control, expiration, and audit visibility.
          </p>
        </div>

        <section
          className="security-list"
          aria-label="Security highlights"
        >
          {securityItems.map((item) => (
            <article className="security-item" key={item.number}>
              <span className="security-number" aria-hidden="true">
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

      <section
        className="auth-side"
        aria-labelledby="login-heading"
      >
        <section className="auth-card">
          <img
            className="auth-icon"
            src="/images/Aegis-Icon.png"
            alt=""
            aria-hidden="true"
          />

          <h2 id="login-heading">
            Welcome back
          </h2>

          <p className="auth-copy">
            Continue with your company Single Sign-On account to access
            secure customer upload tools.
          </p>

          <button
            className="sso-button"
            type="button"
            onClick={handleSsoLogin}
          >
            <img
              className="sso-button-logo"
              src="/images/Microsoft-Logo.png"
              alt=""
              aria-hidden="true"
            />

            <span className="sso-button-label">
              Continue with Microsoft Entra ID
            </span>

            <span className="sso-button-arrow" aria-hidden="true">
              ↗
            </span>
          </button>

          <div className="access-note">
            <span>Need access?</span>
            <a href="mailto:helpdesk@AISCorp.com">
              Contact the help desk
            </a>
          </div>
        </section>

        <footer className="auth-footer">
          <span>
            Protected by enterprise security controls
          </span>

          <nav aria-label="Legal links">
            <a href="https://www.aiscorp.com/privacy-policy/">Privacy Policy</a>
            <span aria-hidden="true">/</span>
            <a href="https://www.aiscorp.com/support-addendum/">Terms of Use</a>
          </nav>
        </footer>
      </section>
    </main>
  );
}