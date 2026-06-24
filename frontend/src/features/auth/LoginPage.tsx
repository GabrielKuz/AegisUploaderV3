import "./LoginPage.css";

const securityItems = [
  {
    number: "01",
    title: "Single Sign-On",
    description: "Access is handled through your approved company identity provider.",
  },
  {
    number: "02",
    title: "Controlled Data",
    description: "Designed for secure ITAR and CUI transfer workflows.",
  },
  {
    number: "03",
    title: "Gov Cloud Ready",
    description: "Built for Azure Government Cloud deployment and auditing.",
  },
];

export function LoginPage() {
  const handleSsoLogin = () => {
    // Placeholder until backend gives real auth route.
    window.location.href = "/api/auth/login";
  };

  return (
    <main className="login-page">
      <section className="brand-side" aria-label="Aegis secure portal branding">
        <div className="brand-grid" />
        <div className="brand-shapes" aria-hidden="true">
          <span className="shape shape-one" />
          <span className="shape shape-two" />
          <span className="shape shape-three" />
          <span className="shape shape-outline" />
        </div>

        <header className="brand-header">
          <img
            className="brand-logo"
            src="/images/aegis-logo.svg"
            alt="Aegis Software"
          />
       
        </header>

        <section className="brand-message">

          <h1>
            Secure access for{" "}
            <span>controlled customer data.</span>
          </h1>

          <p className="brand-description">
            A protected portal for transferring ITAR and CUI-related files with
            clear access control, expiration, and audit visibility.
          </p>
        </section>

        <section className="security-list" aria-label="Security highlights">
          {securityItems.map((item) => (
            <article className="security-item" key={item.number}>
              <span>{item.number}</span>
              <div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </section>
      </section>

      <section className="auth-side" aria-label="Login">
        <a className="support-link" href="mailto:support@aegissoftware.com">
          Help & Support
        </a>

        <section className="auth-card">
          <div className="auth-icon" aria-hidden="true">
            <span />
          </div>

          <h2>Welcome back</h2>

          <p className="auth-copy">
            Continue with your company Single Sign-On account to access the
            secure data portal.
          </p>

          <button className="sso-button" type="button" onClick={handleSsoLogin}>
            <span className="sso-button-label">Continue with SSO</span>
            <span className="sso-button-arrow" aria-hidden="true">
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

        <section className="identity-card" aria-label="Identity provider">
          <div className="identity-grid" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div>
            <h3>Microsoft Entra ID</h3>
            <p>Enterprise identity authentication for approved users.</p>
          </div>
        </section>

        <footer className="auth-footer">
          <span>Protected by enterprise security controls</span>
          <nav aria-label="Legal links">
            <a href="/privacy">Privacy Policy</a>
            <span>/</span>
            <a href="/terms">Terms of Use</a>
          </nav>
        </footer>
      </section>
    </main>
  );
}