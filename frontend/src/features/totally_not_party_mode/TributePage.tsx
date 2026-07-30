import { useLocation, useNavigate } from "react-router-dom";

/**
 * Keep team data near the top so names and roles are easy
 * to update without searching through the JSX.
 */
const INTERN_TEAMS = [
  {
    department: "Frontend",
    members: ["Katie", "Colin"],
    contribution:
      "Built the Support, Admin, Customer Upload, authentication, and visual experience.",
  },
  {
    department: "Backend",
    members: ["Ben", "Gabe", "Brendan"],
    contribution:
      "Built secure upload processing, APIs, storage workflows, and backend reliability.",
  },
  {
    department: "Infrastructure",
    members: ["Corey"],
    contribution:
      "Built and supported the cloud, deployment, Docker, and infrastructure foundation.",
  },
] as const;

const PROJECT_ACHIEVEMENTS = [
  "Merge conflicts resolved: More than anyone wanted",
  "Console logs investigated: Too many to count",
  "Large files tested: Extremely large",
  "Deadlocks encountered: Character building",
  "Production vibes: Optimal",
] as const;

/**
 * Hidden page route:
 *
 * /support/intern-tribute-2026
 * /admin/intern-tribute-2026
 */
export function TributePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const basePath = location.pathname.startsWith("/admin")
    ? "/admin"
    : "/support";

  return (
    <main className="intern-tribute-page">
      <div className="intern-tribute-page__stars" aria-hidden="true" />

      <section className="intern-tribute-page__content">
        <button
          type="button"
          className="intern-tribute-page__back"
          onClick={() => navigate(basePath)}
        >
          ← Return to application
        </button>

        <header className="intern-tribute-page__header">
          <div className="intern-tribute-page__shield" aria-hidden="true">
            🛡️
          </div>

          <p className="party-eyebrow">Classified Archive Unlocked</p>

          <h1>The 2026 Intern Team</h1>

          <p>Built securely. Debugged repeatedly. Shipped together.</p>
        </header>

        <div className="intern-tribute-grid">
          {INTERN_TEAMS.map((team) => (
            <article key={team.department} className="intern-tribute-card">
              <span>{team.department}</span>

              <h2>{team.members.join(", ")}</h2>

              <p>{team.contribution}</p>
            </article>
          ))}
        </div>

        <section className="intern-achievements">
          <p className="party-eyebrow">Project Statistics</p>

          <h2>Completely accurate* metrics</h2>

          <div>
            {PROJECT_ACHIEVEMENTS.map((achievement) => (
              <p key={achievement}>{achievement}</p>
            ))}
          </div>

          <small>*Accuracy may depend on who is reading the console.</small>
        </section>

        <blockquote className="intern-tribute-quote">
          “The strongest shield was the teammates we debugged with along the
          way.”
        </blockquote>
      </section>
    </main>
  );
}
