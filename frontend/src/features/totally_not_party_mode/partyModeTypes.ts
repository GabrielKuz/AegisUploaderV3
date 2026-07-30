/**
 * Every supported Party Mode.
 *
 * Keep these values synchronized with partyModeConfig.ts,
 * PartyModeProvider.tsx, terminalCommands.ts, and
 * PartyModeEffects.tsx.
 */
export type PartyModeId =
  | "terminal"
  | "other-side"
  | "battle-royale"
  | "kung-fu-panda";

/**
 * Cosmetic Party Mode progression.
 *
 * Progress is stored only in sessionStorage. Nothing is sent
 * to the backend.
 *
 * createdLinkIds prevents the same successful API response
 * from awarding XP more than once.
 */
export type PartyProgress = {
  xp: number;
  visitedModes: PartyModeId[];
  createdLinkIds: string[];
};

/**
 * A cosmetic Party Mode level.
 * Levels never restrict application functionality.
 */
export type PartyLevel = {
  level: number;
  minimumXp: number;
  title: string;
};

// Color palettes available inside Terminal Mode.
export type TerminalColorTheme = "green" | "amber" | "blue";
