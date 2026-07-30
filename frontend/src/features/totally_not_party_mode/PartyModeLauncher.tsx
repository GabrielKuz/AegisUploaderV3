import { usePartyMode } from "./PartyModeContext";

/**
 * Main Party Mode entry point.
 */
export function PartyModeLauncher() {
  const { activeMode, currentLevel, isHubOpen, openHub } = usePartyMode();

  if (isHubOpen || activeMode) {
    return null;
  }

  return (
    <button
      type="button"
      className="party-launcher"
      onClick={openHub}
      title="Open Party Mode — Alt + Shift + P"
      aria-label={`Open Party Mode. Current level: ${currentLevel.level}, ${currentLevel.title}`}
    >
      <span className="party-launcher__icon" aria-hidden="true">
        ✦
      </span>

      <span className="party-launcher__text">
        <strong>Party Mode</strong>
        <small>{currentLevel.title}</small>
      </span>

      <span className="party-launcher__level">LV {currentLevel.level}</span>
    </button>
  );
}
