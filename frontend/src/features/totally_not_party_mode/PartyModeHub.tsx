import { type MouseEvent } from "react";

import {
  AEGIS_CLICKER_ENABLED,
  LINK_CREATION_XP,
  PARTY_MODES,
} from "./partyModeConfig";
import { usePartyMode } from "./PartyModeContext";

/**
 * Main Party Mode control center.
 */
export function PartyModeHub() {
  const {
    activeMode,
    activateMode,
    closeHub,
    currentLevel,
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

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      closeHub();
    }
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

            <h2 id="party-hub-title">Experience control center</h2>

            <p>
              Select a visual transformation or open the secure fictional
              terminal.
            </p>
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

        <section className="party-progress-panel">
          <div className="party-progress-panel__identity">
            <span className="party-progress-panel__level">
              {currentLevel.level}
            </span>

            <div>
              <small>Current rank</small>
              <strong>{currentLevel.title}</strong>
            </div>
          </div>

          <div className="party-progress-panel__progress">
            <div className="party-progress-panel__labels">
              <span>{progress.xp} XP</span>

              <span>
                {progress.createdLinkIds.length}{" "}
                {progress.createdLinkIds.length === 1 ? "link" : "links"}{" "}
                created
              </span>
            </div>

            <div
              className="party-progress-panel__track"
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

            <p>
              {nextLevel
                ? `${linksUntilNextLevel} more ${
                    linksUntilNextLevel === 1 ? "link" : "links"
                  } until ${nextLevel.title}.`
                : "Maximum Party Mode rank achieved."}
            </p>
          </div>

          <div className="party-progress-panel__reward">
            <small>Link reward</small>
            <strong>+{LINK_CREATION_XP} XP</strong>
          </div>
        </section>

        <section className="party-mode-section">
          <div className="party-section-heading">
            <div>
              <p className="party-eyebrow">Experiences</p>

              <h3>Choose a transformation</h3>
            </div>

            <span>All modes are immediately available</span>
          </div>

          <div className="party-mode-grid">
            {PARTY_MODES.map((mode) => {
              const isActive = activeMode === mode.id;

              const hasVisited = progress.visitedModes.includes(mode.id);

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
                  <span className="party-mode-card__preview" aria-hidden="true">
                    <span className="party-mode-card__icon">{mode.icon}</span>
                  </span>

                  <span className="party-mode-card__body">
                    <span className="party-mode-card__meta">
                      <small>{mode.category}</small>

                      <small>
                        {isActive ? "Active" : hasVisited ? "Visited" : "Ready"}
                      </small>
                    </span>

                    <strong>{mode.title}</strong>

                    <span className="party-mode-card__tagline">
                      {mode.tagline}
                    </span>

                    <span className="party-mode-card__description">
                      {mode.description}
                    </span>

                    <span className="party-mode-card__launch">
                      {isActive ? "Resume experience" : "Launch experience"}
                      <span aria-hidden="true">→</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="party-games-section">
          <div>
            <p className="party-eyebrow">Experimental</p>

            <h3>Mini-game laboratory</h3>
          </div>

          <button
            type="button"
            className="party-game-card"
            disabled={!AEGIS_CLICKER_ENABLED}
          >
            <span className="party-game-card__icon" aria-hidden="true">
              🛡️
            </span>

            <span>
              <strong>Aegis Clicker</strong>

              <small>
                {AEGIS_CLICKER_ENABLED
                  ? "Ready to launch"
                  : "Currently under construction"}
              </small>
            </span>

            <span>{AEGIS_CLICKER_ENABLED ? "Play" : "Coming later"}</span>
          </button>
        </section>

        <footer className="party-hub__footer">
          <div>
            <span>
              Shortcut: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>
            </span>

            <span>Create secure upload links to earn Party Mode XP.</span>
          </div>

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
