import { createContext, useContext } from "react";

import type { PartyLevel, PartyModeId, PartyProgress } from "./partyModeTypes";

/**
 * Everything provided by PartyModeProvider.
 */
export type PartyModeContextValue = {
  /**
   * Currently active visual or interactive mode.
   *
   * null means the regular application is active.
   */
  activeMode: PartyModeId | null;

  /**
   * Whether the Party Hub modal is visible.
   */
  isHubOpen: boolean;

  /**
   * Whether the normal application is physically inverted
   * during The Other Side.
   */
  isOtherSideInverted: boolean;

  /**
   * Session-based cosmetic progression.
   */
  progress: PartyProgress;
  currentLevel: PartyLevel;
  nextLevel: PartyLevel | null;

  /**
   * Opens and closes the mode-selection hub.
   */
  openHub: () => void;
  closeHub: () => void;

  /**
   * Activates a mode and closes the hub.
   */
  activateMode: (mode: PartyModeId) => void;

  /**
   * Returns the application to its normal appearance.
   */
  exitMode: () => void;

  /**
   * Flips the normal application while The Other Side
   * remains active.
   */
  toggleOtherSideInversion: () => void;

  /**
   * Resets cosmetic XP and first-visit tracking.
   */
  resetProgress: () => void;
};

export const PartyModeContext = createContext<PartyModeContextValue | null>(
  null,
);

/**
 * Use this hook from any component inside PartyModeProvider.
 */
export function usePartyMode(): PartyModeContextValue {
  const context = useContext(PartyModeContext);

  if (!context) {
    throw new Error("usePartyMode must be used inside PartyModeProvider.");
  }

  return context;
}
