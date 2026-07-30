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
    department: "Third Column",
    members: ["Secret Sixth Person"],
    contribution: "I needed a third box for the formatting to work :/",
  }
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
          
          <p className="party-eyebrow">Secret: Party Mode</p>

          <h1>The 2026 Intern Team: Before</h1>

          
        </header>

        <div className="intern-tribute-photo">
          <img
            src="/images/interns.jpg"
            alt="The 2026 intern team"
          />
        </div>
        <header className="intern-tribute-page__header">

          

          <h1>The 2026 Intern Team: After</h1>


        </header>
        <div className = "intern-tribute-photo">
          <img
            src="/images/interns2.jpeg"
            alt="The 2026 intern team but better"
          />
        </div>
        <div className="intern-tribute-grid">
          {INTERN_TEAMS.map((team) => (
            <article key={team.department} className="intern-tribute-card">
              <span>{team.department}</span>

              <h2>{team.members.join(", ")}</h2>

              <p>{team.contribution}</p>
            </article>
          ))}
        </div>

     

        <blockquote className="intern-tribute-quote">
          “It works on <i>my</i> computer.”
        </blockquote>
      </section>
    </main>
  );
}
