import { usePartyMode } from "./PartyModeContext";

export function PartyModeButton() {
  const { activeMode, currentLevel, isHubOpen, openHub } = usePartyMode();

  if (isHubOpen) {
    return null;
  }

  return (
    <button
      type="button"
      className="party-mode-launcher"
      onClick={openHub}
      aria-label="Open Party Mode"
      title="Open Party Mode — Alt + Shift + P"
    >
      <span className="party-mode-launcher__icon" aria-hidden="true">
        🎉
      </span>

      <span className="party-mode-launcher__text">Party Mode</span>

      <span className="party-mode-launcher__level">
        Lv. {currentLevel.level}
      </span>

      {activeMode && (
        <span
          className="party-mode-launcher__active-dot"
          aria-label="A Party Mode experience is active"
        />
      )}
    </button>
  );
}
