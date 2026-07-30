import type { PartyLevel, PartyModeId } from "./partyModeTypes";

/**
 * XP awarded after the backend successfully creates a unique
 * upload link.
 *
 * Change this one value to rebalance the progression system.
 */
export const LINK_CREATION_XP = 25;

/**
 * Information displayed for each Party Mode.
 */
export type PartyModeDefinition = {
  id: PartyModeId;
  title: string;
  shortTitle: string;
  icon: string;
  category: "Interactive" | "Visual Theme";
  description: string;
  tagline: string;
};

/**
 * All Party Modes are immediately available.
 *
 * Progression is cosmetic and never locks functionality.
 */
export const PARTY_MODES: readonly PartyModeDefinition[] = [
  {
    id: "terminal",
    title: "Terminal Mode",
    shortTitle: "Terminal",
    icon: ">_",
    category: "Interactive",
    tagline: "Secure shell. Maximum vibes.",
    description:
      "Enter a safe, fictional Aegis command environment with navigation, command history, hidden files, and terminal themes.",
  },
  {
    id: "other-side",
    title: "The Upside Down",
    shortTitle: "Upside Down",
    icon: "◉",
    category: "Visual Theme",
    tagline: "Reality appears to be unstable.",
    description:
      "Transform the portal into a dark alternate environment with drifting spores, red interference, and optional inversion.",
  },
  {
    id: "battle-royale",
    title: "Aegis Battle Royale",
    shortTitle: "Battle Royale",
    icon: "⚡",
    category: "Visual Theme",
    tagline: "The storm has entered the portal.",
    description:
      "Apply a bright competitive game interface with storm energy, rarity colors, bold panels, and an Aegis combat HUD.",
  },
  {
    id: "kung-fu-panda",
    title: "Kung Fu Panda 2",
    shortTitle: "Kung Fu Panda 2",
    icon: "🐼",
    category: "Visual Theme",
    tagline: "Balance. Focus. Debug.",
    description:
      "Enter cinematic jade training grounds with parchment surfaces, mountain silhouettes, bamboo framing, and warm red accents.",
  },
] as const;

/**
 * Creating one link awards 25 XP.
 *
 * These thresholds correspond to:
 *
 * Level 2:  1 link
 * Level 3:  3 links
 * Level 4:  6 links
 * Level 5: 10 links
 * Level 6: 16 links
 * Level 7: 24 links
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
    minimumXp: 75,
    title: "Stack Tracer",
  },
  {
    level: 4,
    minimumXp: 150,
    title: "Shield Engineer",
  },
  {
    level: 5,
    minimumXp: 250,
    title: "Senior Vibe Architect",
  },
  {
    level: 6,
    minimumXp: 400,
    title: "Guardian of Production",
  },
  {
    level: 7,
    minimumXp: 600,
    title: "Aegis Legend",
  },
] as const;

/**
 * Returns the current cosmetic level for an XP total.
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
 * Returns the level immediately after the current level.
 */
export function getNextPartyLevel(currentLevel: PartyLevel): PartyLevel | null {
  return (
    PARTY_LEVELS.find((level) => level.level === currentLevel.level + 1) ?? null
  );
}

/**
 * Finds the configuration for one Party Mode.
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
