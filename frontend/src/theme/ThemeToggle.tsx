
import { useTheme } from "./ThemeContext";
import "./ThemeToggle.css";

export function ThemeToggle() {
    const { isDarkMode, toggleTheme } = useTheme();

    const nextTheme = isDarkMode ? "light" : "dark";

    return (
        <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${nextTheme} mode`}
            aria-pressed={isDarkMode}
            title={`Switch to ${nextTheme} mode`}
        >

            <span className="theme-toggle-icon" aria-hidden="true">
                {isDarkMode ? "☀" : "☾"}
            </span>

            <span className="theme-toggle-label">
                {isDarkMode ? "Light mode" : "Dark mode"}
            </span>
        </button>
    );
}