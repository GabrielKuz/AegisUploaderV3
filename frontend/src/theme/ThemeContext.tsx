import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    isDarkMode: boolean;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
};

type ThemeProviderProps = {
    children: ReactNode;
};

const THEME_STORAGE_KEY = "aegis-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(
    undefined,
);

/**
 * Gets the user's saved preference.
 *
 * When no saved preference exists, the operating-system preference
 * is used instead.
 */
function getInitialTheme(): Theme {
    if (typeof window === "undefined") {
        return "light";
    }

    const savedTheme = window.localStorage.getItem(
        THEME_STORAGE_KEY,
    );

    if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
    }

    const prefersDarkMode = window.matchMedia(
        "(prefers-color-scheme: dark)",
    ).matches;

    return prefersDarkMode ? "dark" : "light";
}

export function ThemeProvider({
    children,
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    /**
     * Apply the selected theme to the root HTML element and save it
     * so the choice remains after the browser is refreshed.
     */
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;

        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme]);

    const value = useMemo<ThemeContextValue>(
        () => ({
            theme,
            isDarkMode: theme === "dark",
            setTheme,
            toggleTheme: () => {
                setTheme((currentTheme) =>
                    currentTheme === "dark" ? "light" : "dark",
                );
            },
        }),
        [theme],
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * Provides access to the application's current theme.
 */
export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error(
            "useTheme must be used inside a ThemeProvider.",
        );
    }

    return context;
}
