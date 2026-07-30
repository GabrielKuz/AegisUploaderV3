/**
 * Every supported Party Mode.
 *
 * Add new modes here before using them anywhere else.
 */
export type PartyModeId =
  | "terminal"
  | "other-side"
  | "battle-royale"
  | "kung-fu-panda";

/**
 * Cosmetic Party Mode progression.
 *
 * This remains in sessionStorage and is never sent to the backend.
 */
export type PartyProgress = {
  xp: number;
  visitedModes: PartyModeId[];
};

/**
 * A level shown in the Party Hub.
 *
 * Levels do not lock modes. All modes are immediately available.
 */
export type PartyLevel = {
  level: number;
  minimumXp: number;
  title: string;
};

/**
 * Color options supported by the terminal.
 */
export type TerminalColorTheme = "green" | "amber" | "blue";
