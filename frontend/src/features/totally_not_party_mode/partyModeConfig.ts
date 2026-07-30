import type { PartyLevel, PartyModeId } from "./partyModeTypes";

/**
 * Information displayed on each Party Hub card.
 */
export type PartyModeDefinition = {
  id: PartyModeId;
  title: string;
  shortTitle: string;
  icon: string;
  category: "Interactive" | "Visual Theme";
  description: string;
  firstVisitXp: number;
};

/**
 * All modes are immediately available.
 *
 * Changing the order here changes their order in the Party Hub.
 */
export const PARTY_MODES: readonly PartyModeDefinition[] = [
  {
    id: "terminal",
    title: "Terminal Mode",
    shortTitle: "Terminal",
    icon: ">_",
    category: "Interactive",
    description:
      "Open a functional Aegis command terminal with navigation, command history, themes, and hidden files.",
    firstVisitXp: 20,
  },
  {
    id: "other-side",
    title: "The Other Side",
    shortTitle: "Other Side",
    icon: "◉",
    category: "Visual Theme",
    description:
      "Send the application into a dark alternate reality with spores, distortion, and inverted views.",
    firstVisitXp: 15,
  },
  {
    id: "battle-royale",
    title: "Aegis Battle Royale",
    shortTitle: "Battle Royale",
    icon: "⚡",
    category: "Visual Theme",
    description:
      "Transform the application with a colorful storm, competitive HUD, rarity styling, and victory energy.",
    firstVisitXp: 15,
  },
  {
    id: "bamboo-guardian",
    title: "Bamboo Guardian",
    shortTitle: "Bamboo Guardian",
    icon: "🐼",
    category: "Visual Theme",
    description:
      "Enter a warm panda martial-arts world with parchment panels, bamboo, jade accents, and floating leaves.",
    firstVisitXp: 15,
  },
] as const;

/**
 * Cosmetic level system.
 *
 * Modes are never locked behind these levels.
 */
export const PARTY_LEVELS: readonly PartyLevel[] = [
  {
    level: 1,
    minimumXp: 0,
    title: "Summer Intern",
  },
  {
    level: 2,
    minimumXp: 25,
    title: "Junior Debugger",
  },
  {
    level: 3,
    minimumXp: 50,
    title: "Stack Tracer",
  },
  {
    level: 4,
    minimumXp: 90,
    title: "Shield Engineer",
  },
  {
    level: 5,
    minimumXp: 140,
    title: "Senior Vibe Architect",
  },
  {
    level: 6,
    minimumXp: 200,
    title: "Guardian of Production",
  },
  {
    level: 7,
    minimumXp: 275,
    title: "Aegis Legend",
  },
] as const;

/**
 * Keep this false until the clicker component is ready.
 *
 * The Party Hub will display it as a future mini-game without
 * accidentally launching an unfinished experience.
 */
export const AEGIS_CLICKER_ENABLED = false;

/**
 * Returns the user's current cosmetic level.
 */
export function getPartyLevel(xp: number): PartyLevel {
  for (let index = PARTY_LEVELS.length - 1; index >= 0; index -= 1) {
    const level = PARTY_LEVELS[index];

    if (xp >= level.minimumXp) {
      return level;
    }
  }

  return PARTY_LEVELS[0];
}

/**
 * Returns the level after the current level.
 *
 * Returns null after the maximum level is reached.
 */
export function getNextPartyLevel(currentLevel: PartyLevel): PartyLevel | null {
  return (
    PARTY_LEVELS.find((level) => level.level === currentLevel.level + 1) ?? null
  );
}

/**
 * Finds configuration for one mode.
 */
export function getPartyModeDefinition(
  modeId: PartyModeId,
): PartyModeDefinition {
  const definition = PARTY_MODES.find((mode) => mode.id === modeId);

  if (!definition) {
    throw new Error(`Unknown Party Mode: ${modeId}`);
  }

  return definition;
}
