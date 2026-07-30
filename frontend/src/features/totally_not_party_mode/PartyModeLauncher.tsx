import { usePartyMode } from "./PartyModeContext";

/**
 * Visible Party Mode launcher.
 *
 * It only appears when no mode or hub currently needs its
 * own controls.
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
    >
      <span className="party-launcher__icon" aria-hidden="true">
        🎉
      </span>

      <span className="party-launcher__label">Party Mode</span>

      <span className="party-launcher__level">Lv. {currentLevel.level}</span>
    </button>
  );
}
