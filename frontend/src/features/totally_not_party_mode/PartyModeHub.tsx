import { type MouseEvent } from "react";

import { AEGIS_CLICKER_ENABLED, PARTY_MODES } from "./partyModeConfig";
import { usePartyMode } from "./PartyModeContext";

/**
 * Main mode-selection interface.
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

  const nextLevelStart = nextLevel?.minimumXp ?? currentLevel.minimumXp;

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

  /**
   * Close only when the dark backdrop itself is clicked.
   *
   * Clicking inside the dialog does not close it.
   */
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
          <div>
            <p className="party-eyebrow">Aegis Party Protocol</p>

            <h2 id="party-hub-title">Choose an experience</h2>

            <p>
              Every mode is immediately available. Visual modes stay active
              until you exit.
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

        <section className="party-level-panel">
          <div className="party-level-panel__header">
            <div>
              <span>Level {currentLevel.level}</span>

              <strong>{currentLevel.title}</strong>
            </div>

            <span>{progress.xp} XP</span>
          </div>

          <div
            className="party-level-panel__track"
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
              ? `${
                  nextLevel.minimumXp - progress.xp
                } XP until ${nextLevel.title}`
              : "Maximum party level reached."}
          </p>
        </section>

        <section>
          <div className="party-section-heading">
            <div>
              <p className="party-eyebrow">Available Now</p>

              <h3>Themes and experiences</h3>
            </div>

            <span>Press Esc to return to normal</span>
          </div>

          <div className="party-mode-grid">
            {PARTY_MODES.map((mode) => {
              const hasVisited = progress.visitedModes.includes(mode.id);

              const isActive = activeMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  className={[
                    "party-mode-card",
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
                    <span className="party-mode-card__topline">
                      <strong>{mode.title}</strong>

                      <small>{mode.category}</small>
                    </span>

                    <span>{mode.description}</span>

                    <span className="party-mode-card__reward">
                      {hasVisited
                        ? "Visited"
                        : `First visit: +${mode.firstVisitXp} XP`}
                    </span>
                  </span>

                  <span className="party-mode-card__arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="party-games-section">
          <div className="party-section-heading">
            <div>
              <p className="party-eyebrow">Mini-games</p>

              <h3>Launch intentionally</h3>
            </div>
          </div>

          <button
            type="button"
            className="party-game-card"
            disabled={!AEGIS_CLICKER_ENABLED}
          >
            <span aria-hidden="true">🛡️</span>

            <span>
              <strong>Aegis Clicker</strong>

              <small>
                {AEGIS_CLICKER_ENABLED
                  ? "Launch game"
                  : "Optional future mini-game"}
              </small>
            </span>

            <span>{AEGIS_CLICKER_ENABLED ? "Play" : "Coming later"}</span>
          </button>

          <p className="party-games-section__note">
            Mini-games should always require a deliberate button press. Theme
            selection never starts a game automatically.
          </p>
        </section>

        <footer className="party-hub__footer">
          <div>
            <span>
              Shortcut: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>
            </span>

            <span>Hint: the terminal remembers the intern team.</span>
          </div>

          <button
            type="button"
            className="party-text-button"
            onClick={resetProgress}
          >
            Reset Party Progress
          </button>
        </footer>
      </section>
    </div>
  );
}
