import { type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { LINK_CREATION_XP, PARTY_MODES } from "./partyModeConfig";
import { usePartyMode } from "./PartyModeContext";

/**
 * Main Party Mode selection interface.
 *
 * The layout intentionally stays compact so it feels like a
 * hidden application utility rather than a separate dashboard.
 */
export function PartyModeHub() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    activeMode,
    activateMode,
    closeHub,
    currentLevel,
    exitMode,
    isHubOpen,
    nextLevel,
    progress,
    resetProgress,
  } = usePartyMode();

  if (!isHubOpen) {
    return null;
  }

  const currentLevelStart = currentLevel.minimumXp;

  const nextLevelStart = nextLevel?.minimumXp ?? Math.max(progress.xp, 1);

  const progressPercent =
    nextLevel === null
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            ((progress.xp - currentLevelStart) /
              (nextLevelStart - currentLevelStart)) *
              100,
          ),
        );

  const linksUntilNextLevel = nextLevel
    ? Math.max(
        1,
        Math.ceil((nextLevel.minimumXp - progress.xp) / LINK_CREATION_XP),
      )
    : 0;

  const basePath = location.pathname.startsWith("/admin")
    ? "/admin"
    : "/support";

  /**
   * Close the hub only when the backdrop itself is selected.
   */
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      closeHub();
    }
  }

  /**
   * Opens the hidden intern tribute without carrying an active
   * visual Party Mode onto the tribute page.
   */
  function openInternTribute(): void {
    exitMode();

    navigate(`${basePath}/intern-tribute-2026`);
  }

  return (
    <div className="party-hub-backdrop" onMouseDown={handleBackdropClick}>
      <section
        className="party-hub"
        role="dialog"
        aria-modal="true"
        aria-labelledby="party-hub-title"
      >
        <header className="party-hub__header">
          <div className="party-hub__heading">
            <p className="party-eyebrow">Aegis Party Protocol</p>

            <h2 id="party-hub-title">Party Mode</h2>

            <p>Choose an experience or visit the intern archive.</p>
          </div>

          <button
            type="button"
            className="party-icon-button"
            onClick={closeHub}
            aria-label="Close Party Mode"
            autoFocus
          >
            ×
          </button>
        </header>

        <section className="party-summary">
          <div className="party-summary__rank">
            <span>{currentLevel.level}</span>

            <div>
              <small>Current rank</small>
              <strong>{currentLevel.title}</strong>
            </div>
          </div>

          <div className="party-summary__progress">
            <div className="party-summary__labels">
              <span>{progress.xp} XP</span>

              <span>
                {progress.createdLinkIds.length}{" "}
                {progress.createdLinkIds.length === 1
                  ? "link created"
                  : "links created"}
              </span>
            </div>

            <div
              className="party-summary__track"
              role="progressbar"
              aria-label="Party Mode level progress"
              aria-valuemin={currentLevel.minimumXp}
              aria-valuemax={nextLevel?.minimumXp ?? Math.max(progress.xp, 1)}
              aria-valuenow={progress.xp}
            >
              <span
                style={{
                  width: `${progressPercent}%`,
                }}
              />
            </div>

            <small>
              {nextLevel
                ? `${linksUntilNextLevel} more ${
                    linksUntilNextLevel === 1 ? "link" : "links"
                  } until ${nextLevel.title}`
                : "Maximum rank reached"}
            </small>
          </div>

          <div className="party-summary__reward">
            <small>Per link</small>
            <strong>+{LINK_CREATION_XP} XP</strong>
          </div>
        </section>

        <button
          type="button"
          className="party-tribute-link"
          onClick={openInternTribute}
        >
          <span className="party-tribute-link__icon" aria-hidden="true">
            🛡️
          </span>

          <span className="party-tribute-link__content">
            <small>Featured archive</small>

            <strong>The 2026 Intern Team</strong>

            <span>View the team behind the Secure Data Portal.</span>
          </span>

          <span className="party-tribute-link__action" aria-hidden="true">
            View tribute →
          </span>
        </button>

        <section className="party-mode-section">
          <div className="party-section-heading">
            <div>
              <p className="party-eyebrow">Experiences</p>

              <h3>Choose a transformation</h3>
            </div>
          </div>

          <div className="party-mode-grid">
            {PARTY_MODES.map((mode) => {
              const isActive = activeMode === mode.id;

              const hasVisited = progress.visitedModes.includes(mode.id);

              const status = isActive
                ? "Active"
                : hasVisited
                  ? "Visited"
                  : "Ready";

              return (
                <button
                  key={mode.id}
                  type="button"
                  className={[
                    "party-mode-card",
                    `party-mode-card--${mode.id}`,
                    isActive ? "party-mode-card--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => activateMode(mode.id)}
                >
                  <span className="party-mode-card__icon" aria-hidden="true">
                    {mode.icon}
                  </span>

                  <span className="party-mode-card__content">
                    <small>{mode.category}</small>

                    <strong>{mode.title}</strong>

                    <span>{mode.tagline}</span>
                  </span>

                  <span className="party-mode-card__end">
                    <small>{status}</small>

                    <span aria-hidden="true">→</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <footer className="party-hub__footer">
          <span>
            <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>
          </span>

          <span>Create upload links to earn XP.</span>

          <button
            type="button"
            className="party-text-button"
            onClick={resetProgress}
          >
            Reset progress
          </button>
        </footer>
      </section>
    </div>
  );
}
