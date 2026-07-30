import { getPartyModeDefinition } from "./partyModeConfig";
import { usePartyMode } from "./PartyModeContext";

const OTHER_SIDE_PARTICLES = [
  ["4%", "-1s", "14s"],
  ["11%", "-9s", "18s"],
  ["19%", "-4s", "13s"],
  ["27%", "-12s", "20s"],
  ["36%", "-2s", "16s"],
  ["45%", "-8s", "19s"],
  ["53%", "-5s", "14s"],
  ["62%", "-11s", "21s"],
  ["71%", "-3s", "15s"],
  ["79%", "-10s", "18s"],
  ["87%", "-6s", "16s"],
  ["95%", "-13s", "22s"],
] as const;

const PANDA_LEAVES = [
  ["16%", "-4s", "19s"],
  ["39%", "-12s", "23s"],
  ["67%", "-7s", "21s"],
  ["88%", "-16s", "25s"],
] as const;

/**
 * Visual backgrounds and active-mode controls.
 *
 * Decorative layers are aria-hidden. Interactive controls
 * remain outside that hidden subtree.
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
    <>
      <div
        className={`party-effects party-effects--${activeMode}`}
        aria-hidden="true"
      >
        {activeMode === "other-side" && (
          <>
            <div className="other-side-atmosphere" />
            <div className="other-side-veins" />
            <div className="other-side-vignette" />
            <div className="other-side-interference" />

            <div className="other-side-particles">
              {OTHER_SIDE_PARTICLES.map(([left, delay, duration], index) => (
                <span
                  key={index}
                  style={{
                    left,
                    animationDelay: delay,
                    animationDuration: duration,
                  }}
                />
              ))}
            </div>
          </>
        )}

        {activeMode === "battle-royale" && (
          <>
            <div className="royale-sky" />
            <div className="royale-grid" />
            <div className="royale-storm royale-storm--outer" />
            <div className="royale-storm royale-storm--inner" />
            <div className="royale-energy royale-energy--one" />
            <div className="royale-energy royale-energy--two" />
          </>
        )}

        {activeMode === "kung-fu-panda" && (
          <>
            <div className="panda-sky" />
            <div className="panda-sun" />

            <div className="panda-mountain panda-mountain--far" />
            <div className="panda-mountain panda-mountain--near" />

            <div className="panda-bamboo panda-bamboo--left">
              <span />
              <span />
              <span />
            </div>

            <div className="panda-bamboo panda-bamboo--right">
              <span />
              <span />
            </div>

            <div className="panda-leaves">
              {PANDA_LEAVES.map(([left, delay, duration], index) => (
                <span
                  key={index}
                  style={{
                    left,
                    animationDelay: delay,
                    animationDuration: duration,
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div
        className={`party-mode-banner party-mode-banner--${activeMode}`}
        aria-hidden="true"
      >
        <span className="party-mode-banner__icon">{definition.icon}</span>

        <div>
          <small>{definition.category}</small>

          <strong>{definition.title}</strong>

          <span>{definition.tagline}</span>
        </div>
      </div>

      <aside
        className={`party-mode-controls party-mode-controls--${activeMode}`}
        aria-label="Party Mode controls"
      >
        <div className="party-mode-controls__identity">
          <span aria-hidden="true">{definition.icon}</span>

          <div>
            <small>Active experience</small>
            <strong>{definition.shortTitle}</strong>
          </div>
        </div>

        <div className="party-mode-controls__buttons">
          {activeMode === "other-side" && (
            <button type="button" onClick={toggleOtherSideInversion}>
              {isOtherSideInverted ? "Restore Reality" : "Invert Reality"}
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
            Exit
          </button>
        </div>
      </aside>
    </>
  );
}
