import {
    createContext,
    useContext,
    useLayoutEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    isDarkMode: boolean;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
};

type ThemeProviderProps = {
    children: ReactNode;
};

const THEME_STORAGE_KEY = "aegis-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(
    undefined,
);

function getInitialTheme(): Theme {
    if (typeof window === "undefined") {
        return "light";
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useLayoutEffect(() => {
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

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error("useTheme must be used inside a ThemeProvider.");
    }

    return context;
}