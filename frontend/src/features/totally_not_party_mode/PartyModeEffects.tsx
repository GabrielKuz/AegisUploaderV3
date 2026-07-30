import { getPartyModeDefinition } from "./partyModeConfig";
import { usePartyMode } from "./PartyModeContext";

/**
 * Static particles avoid generating different random values
 * on every React render.
 */
const OTHER_SIDE_PARTICLES = [
  {
    left: "4%",
    delay: "-1s",
    duration: "12s",
  },
  {
    left: "11%",
    delay: "-7s",
    duration: "15s",
  },
  {
    left: "18%",
    delay: "-3s",
    duration: "11s",
  },
  {
    left: "27%",
    delay: "-9s",
    duration: "17s",
  },
  {
    left: "36%",
    delay: "-2s",
    duration: "13s",
  },
  {
    left: "44%",
    delay: "-6s",
    duration: "18s",
  },
  {
    left: "52%",
    delay: "-4s",
    duration: "12s",
  },
  {
    left: "61%",
    delay: "-10s",
    duration: "16s",
  },
  {
    left: "69%",
    delay: "-5s",
    duration: "14s",
  },
  {
    left: "77%",
    delay: "-8s",
    duration: "19s",
  },
  {
    left: "85%",
    delay: "-2s",
    duration: "13s",
  },
  {
    left: "93%",
    delay: "-6s",
    duration: "16s",
  },
] as const;

/**
 * Decorative leaves for Bamboo Guardian.
 *
 * These positions are intentionally predefined so React
 * does not generate new random positions after every render.
 */
const BAMBOO_LEAVES = [
  {
    left: "12%",
    delay: "-2s",
    duration: "14s",
    size: "12px",
  },
  {
    left: "28%",
    delay: "-8s",
    duration: "18s",
    size: "9px",
  },
  {
    left: "46%",
    delay: "-5s",
    duration: "16s",
    size: "13px",
  },
  {
    left: "63%",
    delay: "-11s",
    duration: "20s",
    size: "10px",
  },
  {
    left: "79%",
    delay: "-4s",
    duration: "17s",
    size: "12px",
  },
  {
    left: "91%",
    delay: "-9s",
    duration: "19s",
    size: "8px",
  },
] as const;

/**
 * Visual overlays for non-terminal modes.
 *
 * The overlay layer uses pointer-events: none, while the
 * control panel restores pointer-events so its buttons work.
 */
export function PartyModeEffects() {
  const {
    activeMode,
    exitMode,
    isOtherSideInverted,
    openHub,
    toggleOtherSideInversion,
  } = usePartyMode();

  if (!activeMode || activeMode === "terminal") {
    return null;
  }

  const definition = getPartyModeDefinition(activeMode);

  return (
    <div
      className={`party-effects party-effects--${activeMode}`}
      aria-hidden="true"
    >
      {activeMode === "other-side" && (
        <>
          <div className="other-side-vignette" />
          <div className="other-side-lightning" />

          <div className="other-side-particles">
            {OTHER_SIDE_PARTICLES.map((particle, index) => (
              <span
                key={index}
                style={{
                  left: particle.left,
                  animationDelay: particle.delay,
                  animationDuration: particle.duration,
                }}
              />
            ))}
          </div>

          <div className="other-side-message">
            <span>OTHER SIDE CONNECTION</span>
            <strong>The shield is holding.</strong>
          </div>
        </>
      )}

      {activeMode === "battle-royale" && (
        <>
          <div className="royale-sky" />
          <div className="royale-storm-ring" />

          <div className="royale-hud">
            <span>AEGIS ROYALE</span>

            <strong>PARTY STORM ACTIVE</strong>

            <small>Visual theme only</small>
          </div>

          <div className="royale-rarity-bar">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </>
      )}

      {activeMode === "kung-fu-panda" && (
        <>
          <div className="bamboo-column bamboo-column--left" />
          <div className="bamboo-column bamboo-column--right" />

          <div className="bamboo-leaves">
            {BAMBOO_LEAVES.map((leaf, index) => (
              <span
                key={index}
                style={{
                  left: leaf.left,
                  animationDelay: leaf.delay,
                }}
              >
                🍃
              </span>
            ))}
          </div>

          <div className="kung-fu-panda-badge">
            <span aria-hidden="true">🐼</span>

            <div>
              <strong>Kung Fu Panda</strong>

              <small>Balance. Focus. Debug.</small>
            </div>
          </div>
        </>
      )}

      {/*
       * This control bar remains outside #root through a
       * React portal, so it stays upright and clickable even
       * when The Other Side rotates the application.
       */}
      <aside
        className="party-mode-controls"
        aria-label="Party Mode controls"
        aria-hidden="false"
      >
        <div>
          <span>{definition.icon}</span>

          <div>
            <small>Active mode</small>
            <strong>{definition.shortTitle}</strong>
          </div>
        </div>

        <div className="party-mode-controls__buttons">
          {activeMode === "other-side" && (
            <button type="button" onClick={toggleOtherSideInversion}>
              {isOtherSideInverted ? "Restore Orientation" : "Invert Views"}
            </button>
          )}

          <button type="button" onClick={openHub}>
            Change Mode
          </button>

          <button
            type="button"
            className="party-mode-controls__exit"
            onClick={exitMode}
          >
            Exit Party Mode
          </button>
        </div>
      </aside>
    </div>
  );
}
