import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  getNextPartyLevel,
  getPartyLevel,
  LINK_CREATION_XP,
} from "./partyModeConfig";
import {
  PartyModeContext,
  type PartyModeContextValue,
} from "./PartyModeContext";
import { PartyModeEffects } from "./PartyModeEffects";
import { PartyModeHub } from "./PartyModeHub";
import { TerminalMode } from "./TerminalMode";

import type { PartyModeId, PartyProgress } from "./partyModeTypes";

import "./PartyMode.css";

const PARTY_PROGRESS_STORAGE_KEY = "aegis-party-progress";

const PARTY_BODY_CLASSES = [
  "party-mode-active",
  "party-theme--terminal",
  "party-theme--other-side",
  "party-theme--battle-royale",
  "party-theme--kung-fu-panda",
  "party-view--inverted",
] as const;

const VALID_PARTY_MODES: readonly PartyModeId[] = [
  "terminal",
  "other-side",
  "battle-royale",
  "kung-fu-panda",
];

const EMPTY_PROGRESS: PartyProgress = {
  xp: 0,
  visitedModes: [],
  createdLinkIds: [],
};

type PartyModeProviderProps = {
  children: ReactNode;
};

/**
 * Confirms that an unknown value is a valid Party Mode ID.
 */
function isPartyModeId(value: unknown): value is PartyModeId {
  return (
    typeof value === "string" &&
    VALID_PARTY_MODES.includes(value as PartyModeId)
  );
}

/**
 * Safely reads cosmetic Party Mode progress.
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

    const visitedModes = Array.isArray(parsedValue.visitedModes)
      ? parsedValue.visitedModes.filter(isPartyModeId)
      : [];

    const createdLinkIds = Array.isArray(parsedValue.createdLinkIds)
      ? parsedValue.createdLinkIds.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : [];

    /*
     * Recalculate XP from successful link IDs instead of
     * trusting a potentially stale stored number.
     */
    return {
      xp: createdLinkIds.length * LINK_CREATION_XP,
      visitedModes,
      createdLinkIds,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

/**
 * Removes every class controlled by Party Mode.
 */
function removePartyBodyClasses(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.remove(...PARTY_BODY_CLASSES);
}

export function PartyModeProvider({ children }: PartyModeProviderProps) {
  const initialProgress = useMemo(() => readStoredProgress(), []);

  const [activeMode, setActiveMode] = useState<PartyModeId | null>(null);

  const [isHubOpen, setIsHubOpen] = useState(false);

  const [isOtherSideInverted, setIsOtherSideInverted] = useState(false);

  const [progress, setProgress] = useState<PartyProgress>(initialProgress);

  /*
   * A ref allows synchronous duplicate protection when two
   * callbacks attempt to record the same link before React
   * completes another render.
   */
  const progressRef = useRef<PartyProgress>(initialProgress);

  /**
   * Enabled unless explicitly disabled.
   *
   * Set VITE_ENABLE_PARTY_MODE=false to remove Party Mode.
   */
  const isPartyModeEnabled = import.meta.env.VITE_ENABLE_PARTY_MODE !== "false";

  const currentLevel = useMemo(() => getPartyLevel(progress.xp), [progress.xp]);

  const nextLevel = useMemo(
    () => getNextPartyLevel(currentLevel),
    [currentLevel],
  );

  const commitProgress = useCallback(
    (update: (current: PartyProgress) => PartyProgress): PartyProgress => {
      const nextProgress = update(progressRef.current);

      progressRef.current = nextProgress;
      setProgress(nextProgress);

      return nextProgress;
    },
    [],
  );

  const openHub = useCallback(() => {
    setIsHubOpen(true);
  }, []);

  const closeHub = useCallback(() => {
    setIsHubOpen(false);
  }, []);

  /**
   * Activating a mode records it as visited but does not
   * award XP.
   *
   * XP is earned through successful link creation.
   */
  const activateMode = useCallback(
    (mode: PartyModeId) => {
      setActiveMode(mode);
      setIsHubOpen(false);

      /*
       * The Other Side now begins upright.
       */
      setIsOtherSideInverted(false);

      commitProgress((currentProgress) => {
        if (currentProgress.visitedModes.includes(mode)) {
          return currentProgress;
        }

        return {
          ...currentProgress,
          visitedModes: [...currentProgress.visitedModes, mode],
        };
      });
    },
    [commitProgress],
  );

  const exitMode = useCallback(() => {
    setActiveMode(null);
    setIsHubOpen(false);
    setIsOtherSideInverted(false);
  }, []);

  const toggleOtherSideInversion = useCallback(() => {
    setIsOtherSideInverted((currentValue) => !currentValue);
  }, []);

  /**
   * Awards XP for one unique backend-created upload link.
   */
  const recordCreatedLink = useCallback(
    (linkId: string): number => {
      const normalizedLinkId = linkId.trim();

      if (!normalizedLinkId) {
        return 0;
      }

      if (progressRef.current.createdLinkIds.includes(normalizedLinkId)) {
        return 0;
      }

      commitProgress((currentProgress) => {
        const createdLinkIds = [
          ...currentProgress.createdLinkIds,
          normalizedLinkId,
        ];

        return {
          ...currentProgress,
          createdLinkIds,
          xp: createdLinkIds.length * LINK_CREATION_XP,
        };
      });

      return LINK_CREATION_XP;
    },
    [commitProgress],
  );

  const resetProgress = useCallback(() => {
    const resetValue: PartyProgress = {
      xp: 0,
      visitedModes: [],
      createdLinkIds: [],
    };

    progressRef.current = resetValue;
    setProgress(resetValue);

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PARTY_PROGRESS_STORAGE_KEY);
    }
  }, []);

  /**
   * Saves harmless cosmetic progress.
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
   * Applies the active mode to document.body.
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
   * Keyboard shortcuts:
   *
   * Alt + Shift + P: open Party Hub
   * Escape: close hub or exit active mode
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
   * Always clean global classes after sign-out or route
   * changes that unmount the provider.
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
      recordCreatedLink,
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
      recordCreatedLink,
      resetProgress,
      toggleOtherSideInversion,
    ],
  );

  if (!isPartyModeEnabled) {
    return children;
  }

  return (
    <PartyModeContext.Provider value={contextValue}>
      {children}

      {typeof document !== "undefined" &&
        createPortal(
          <>
            <PartyModeHub />
            <PartyModeEffects />
            <TerminalMode />
          </>,
          document.body,
        )}
    </PartyModeContext.Provider>
  );
}
