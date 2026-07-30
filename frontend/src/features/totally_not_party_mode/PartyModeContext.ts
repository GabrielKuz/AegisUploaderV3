import { createContext, useContext } from "react";

import type { PartyLevel, PartyModeId, PartyProgress } from "./partyModeTypes";

export type PartyModeContextValue = {
  activeMode: PartyModeId | null;
  isHubOpen: boolean;
  isOtherSideInverted: boolean;

  progress: PartyProgress;
  currentLevel: PartyLevel;
  nextLevel: PartyLevel | null;

  openHub: () => void;
  closeHub: () => void;
  activateMode: (mode: PartyModeId) => void;
  exitMode: () => void;
  toggleOtherSideInversion: () => void;
  resetProgress: () => void;

  /**
   * Records a successfully created upload link.
   *
   * Returns the amount of XP awarded. A duplicate UUID
   * returns zero.
   */
  recordCreatedLink: (linkId: string) => number;
};

export const PartyModeContext = createContext<PartyModeContextValue | null>(
  null,
);

/**
 * Use inside components that must be wrapped by
 * PartyModeProvider.
 */
export function usePartyMode(): PartyModeContextValue {
  const context = useContext(PartyModeContext);

  if (!context) {
    throw new Error("usePartyMode must be used inside PartyModeProvider.");
  }

  return context;
}

/**
 * Use inside shared components that can also render outside
 * PartyModeProvider, such as ThemeToggle and CreateLinkForm.
 */
export function useOptionalPartyMode(): PartyModeContextValue | null {
  return useContext(PartyModeContext);
}
