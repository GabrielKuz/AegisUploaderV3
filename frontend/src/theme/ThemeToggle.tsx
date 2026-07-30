import { useOptionalPartyMode } from "../features/totally_not_party_mode/PartyModeContext";
import { useTheme } from "./ThemeContext";

import "./ThemeToggle.css";

export function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  const partyMode = useOptionalPartyMode();

  const isThemeLocked = partyMode?.activeMode != null;

  const nextTheme = isDarkMode ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      disabled={isThemeLocked}
      title={
        isThemeLocked
          ? "The application theme is controlled by the active Party Mode."
          : `Switch to ${nextTheme} mode`
      }
      aria-label={
        isThemeLocked
          ? "Theme locked while Party Mode is active"
          : `Switch to ${nextTheme} mode`
      }
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isThemeLocked ? "✦" : isDarkMode ? "☀" : "☾"}
      </span>

      <span className="theme-toggle-label">
        {isThemeLocked
          ? "Theme Locked"
          : isDarkMode
            ? "Light Mode"
            : "Dark Mode"}
      </span>
    </button>
  );
}
