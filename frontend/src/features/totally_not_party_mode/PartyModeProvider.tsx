import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  getNextPartyLevel,
  getPartyLevel,
  getPartyModeDefinition,
} from "./partyModeConfig";
import {
  PartyModeContext,
  type PartyModeContextValue,
} from "./PartyModeContext";
import { PartyModeEffects } from "./PartyModeEffects";
import { PartyModeHub } from "./PartyModeHub";
import { PartyModeLauncher } from "./PartyModeLauncher";
import { TerminalMode } from "./TerminalMode";

import type { PartyModeId, PartyProgress } from "./partyModeTypes";

import "./PartyMode.css";

/**
 * sessionStorage key.
 *
 * Progress survives refreshes in the same tab but is not
 * stored permanently or sent to the backend.
 */
const PARTY_PROGRESS_STORAGE_KEY = "aegis-party-progress";

/**
 * Every body class controlled by Party Mode.
 *
 * Keeping them together makes cleanup easier and safer.
 */
const PARTY_BODY_CLASSES = [
  "party-mode-active",
  "party-theme--terminal",
  "party-theme--other-side",
  "party-theme--battle-royale",
  "party-theme--kung-fu-panda",
  "party-view--inverted",
] as const;

const EMPTY_PROGRESS: PartyProgress = {
  xp: 0,
  visitedModes: [],
};

type PartyModeProviderProps = {
  children: ReactNode;
};

/**
 * Safely reads Party Mode progression from sessionStorage.
 */
function readStoredProgress(): PartyProgress {
  if (typeof window === "undefined") {
    return EMPTY_PROGRESS;
  }

  try {
    const storedValue = window.sessionStorage.getItem(
      PARTY_PROGRESS_STORAGE_KEY,
    );

    if (!storedValue) {
      return EMPTY_PROGRESS;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<PartyProgress>;

    const xp =
      typeof parsedValue.xp === "number" &&
      Number.isFinite(parsedValue.xp) &&
      parsedValue.xp >= 0
        ? Math.floor(parsedValue.xp)
        : 0;

    const visitedModes = Array.isArray(parsedValue.visitedModes)
      ? parsedValue.visitedModes.filter(
          (mode): mode is PartyModeId =>
            mode === "terminal" ||
            mode === "other-side" ||
            mode === "battle-royale" ||
            mode === "kung-fu-panda",
        )
      : [];

    return {
      xp,
      visitedModes,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

/**
 * Removes all global Party Mode classes.
 */
function removePartyBodyClasses(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.remove(...PARTY_BODY_CLASSES);
}

export function PartyModeProvider({ children }: PartyModeProviderProps) {
  const [activeMode, setActiveMode] = useState<PartyModeId | null>(null);

  const [isHubOpen, setIsHubOpen] = useState(false);

  const [isOtherSideInverted, setIsOtherSideInverted] = useState(false);

  const [progress, setProgress] = useState<PartyProgress>(readStoredProgress);

  /**
   * Party Mode must be intentionally enabled in the environment.
   *
   * Add VITE_ENABLE_PARTY_MODE=true to the production
   * frontend environment.
   */
  const isPartyModeEnabled = true;

  const currentLevel = useMemo(() => getPartyLevel(progress.xp), [progress.xp]);

  const nextLevel = useMemo(
    () => getNextPartyLevel(currentLevel),
    [currentLevel],
  );

  const openHub = useCallback(() => {
    setIsHubOpen(true);
  }, []);

  const closeHub = useCallback(() => {
    setIsHubOpen(false);
  }, []);

  /**
   * Activates a mode.
   *
   * The user receives XP only the first time that mode is
   * opened during the current browser session.
   */
  const activateMode = useCallback((mode: PartyModeId) => {
    setActiveMode(mode);
    setIsHubOpen(false);

    /**
     * The Other Side starts upside down.
     *
     * Change this to false if you want users to manually
     * select inversion after entering the mode.
     */
    setIsOtherSideInverted(mode === "other-side");

    setProgress((currentProgress) => {
      if (currentProgress.visitedModes.includes(mode)) {
        return currentProgress;
      }

      const definition = getPartyModeDefinition(mode);

      return {
        xp: currentProgress.xp + definition.firstVisitXp,
        visitedModes: [...currentProgress.visitedModes, mode],
      };
    });
  }, []);

  const exitMode = useCallback(() => {
    setActiveMode(null);
    setIsOtherSideInverted(false);
  }, []);

  const toggleOtherSideInversion = useCallback(() => {
    setIsOtherSideInverted((currentValue) => !currentValue);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(EMPTY_PROGRESS);

    window.sessionStorage.removeItem(PARTY_PROGRESS_STORAGE_KEY);
  }, []);

  /**
   * Save harmless progression data.
   */
  useEffect(() => {
    if (!isPartyModeEnabled) {
      return;
    }

    window.sessionStorage.setItem(
      PARTY_PROGRESS_STORAGE_KEY,
      JSON.stringify(progress),
    );
  }, [isPartyModeEnabled, progress]);

  /**
   * Apply the current visual mode to document.body.
   */
  useEffect(() => {
    removePartyBodyClasses();

    if (!activeMode) {
      return;
    }

    document.body.classList.add(
      "party-mode-active",
      `party-theme--${activeMode}`,
    );

    if (activeMode === "other-side" && isOtherSideInverted) {
      document.body.classList.add("party-view--inverted");
    }

    return removePartyBodyClasses;
  }, [activeMode, isOtherSideInverted]);

  /**
   * Alt + Shift + P opens the Party Hub.
   *
   * Escape closes the hub first, then exits the current mode.
   */
  useEffect(() => {
    if (!isPartyModeEnabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      const isPartyShortcut =
        event.altKey && event.shiftKey && event.key.toLowerCase() === "p";

      if (isPartyShortcut) {
        event.preventDefault();
        openHub();
        return;
      }

      if (event.key !== "Escape") {
        return;
      }

      if (isHubOpen) {
        closeHub();
        return;
      }

      if (activeMode) {
        exitMode();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMode, closeHub, exitMode, isHubOpen, isPartyModeEnabled, openHub]);

  /**
   * Always remove global classes if the provider unmounts,
   * such as after sign-out.
   */
  useEffect(() => {
    return removePartyBodyClasses;
  }, []);

  const contextValue = useMemo<PartyModeContextValue>(
    () => ({
      activeMode,
      isHubOpen,
      isOtherSideInverted,
      progress,
      currentLevel,
      nextLevel,
      openHub,
      closeHub,
      activateMode,
      exitMode,
      toggleOtherSideInversion,
      resetProgress,
    }),
    [
      activeMode,
      activateMode,
      closeHub,
      currentLevel,
      exitMode,
      isHubOpen,
      isOtherSideInverted,
      nextLevel,
      openHub,
      progress,
      resetProgress,
      toggleOtherSideInversion,
    ],
  );

  /**
   * When disabled, Party Mode contributes nothing to the UI.
   */
  if (!isPartyModeEnabled) {
    return children;
  }

  return (
    <PartyModeContext.Provider value={contextValue}>
      {children}

      {typeof document !== "undefined" &&
        createPortal(
          <>
            <PartyModeLauncher />
            <PartyModeHub />
            <PartyModeEffects />
            <TerminalMode />
          </>,
          document.body,
        )}
    </PartyModeContext.Provider>
  );
}
