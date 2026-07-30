import { useState, type CSSProperties } from "react";
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
  },
] as const;

/**
 * Hidden page routes:
 *
 * /support/intern-tribute-2026
 * /admin/intern-tribute-2026
 */
export function TributePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [comparisonPosition, setComparisonPosition] = useState(50);

  const basePath = location.pathname.startsWith("/admin")
    ? "/admin"
    : "/support";

  /**
   * Passes the slider position into CSS.
   *
   * The custom property controls the after-photo crop,
   * divider line, and draggable handle.
   */
  const comparisonStyle = {
    "--comparison-position": `${comparisonPosition}%`,
  } as CSSProperties;

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

          <h1>The 2026 Intern Team</h1>

          <p>Drag the slider to compare before and after.</p>
        </header>

        <figure
          className="intern-comparison"
          style={comparisonStyle}
          aria-label="Before and after comparison of the 2026 intern team"
        >
          {/*
           * The before image is the base layer and remains
           * visible on the right side of the comparison.
           */}
          <img
            className="intern-comparison__image intern-comparison__before"
            src="/images/interns.jpg"
            alt="The 2026 intern team before"
          />

          {/*
           * The after image sits above the original and is
           * cropped according to the slider position.
           */}
          <img
            className="intern-comparison__image intern-comparison__after"
            src="/images/interns2.jpeg"
            alt="The 2026 intern team after"
          />

          <span
            className="intern-comparison__label intern-comparison__label--after"
            aria-hidden="true"
          >
            After
          </span>

          <span
            className="intern-comparison__label intern-comparison__label--before"
            aria-hidden="true"
          >
            Before
          </span>

          <div className="intern-comparison__divider" aria-hidden="true">
            <span className="intern-comparison__handle">
              <span>‹</span>
              <span>›</span>
            </span>
          </div>

          <label
            className="intern-comparison__range-label"
            htmlFor="intern-photo-comparison"
          >
            Reveal the before or after team photo
          </label>

          <input
            id="intern-photo-comparison"
            className="intern-comparison__range"
            type="range"
            min="0"
            max="100"
            value={comparisonPosition}
            onChange={(event) =>
              setComparisonPosition(Number(event.target.value))
            }
            aria-valuetext={`${comparisonPosition}% of the after photo revealed`}
          />

          <figcaption>Before internship versus after internship.</figcaption>
        </figure>

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
