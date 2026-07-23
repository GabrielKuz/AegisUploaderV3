import { useTheme } from "./ThemeContext";
import "./ThemeToggle.css";

export function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  const nextTheme = isDarkMode ? "light" : "dark";
  const label = `Switch to ${nextTheme} mode`;

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDarkMode}
      title={label}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDarkMode ? "☀" : "☾"}
      </span>

      <span className="theme-toggle-label">
        {isDarkMode ? "Light Mode" : "Dark Mode"}
      </span>
    </button>
  );
}
