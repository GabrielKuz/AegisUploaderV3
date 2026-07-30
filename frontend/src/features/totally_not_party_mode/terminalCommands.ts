import type { PartyModeId, TerminalColorTheme } from "./partyModeTypes";

/**
 * Information passed into each terminal command.
 */
export type TerminalExecutionContext = {
  cwd: string;
  role: "support" | "admin";
  basePath: "/support" | "/admin";
  commandHistory: string[];
  startedAt: number;
};

/**
 * A command can return UI output and optionally request
 * a change elsewhere in the application.
 */
export type TerminalCommandResult = {
  output?: string[];
  error?: string[];
  clear?: boolean;
  nextCwd?: string;
  navigateTo?: string;
  closeTerminal?: boolean;
  openHub?: boolean;

  /**
   * null means return to normal mode.
   */
  setMode?: PartyModeId | null;

  terminalTheme?: TerminalColorTheme;
};

/**
 * Used by basic tab completion.
 */
export const TERMINAL_COMMAND_NAMES = [
  "help",
  "clear",
  "history",
  "whoami",
  "pwd",
  "ls",
  "cd",
  "cat",
  "echo",
  "date",
  "uptime",
  "status",
  "team",
  "interns",
  "open",
  "mode",
  "modes",
  "theme",
  "sudo",
  "exit",
] as const;

/**
 * Virtual directories.
 *
 * Add or remove fake folders here.
 */
const VIRTUAL_DIRECTORIES: Record<string, string[]> = {
  "/": ["home"],
  "/home": ["aegis"],
  "/home/aegis": ["readme.txt", "modes.txt", "team.txt", "secrets"],
  "/home/aegis/secrets": ["tribute.txt"],
};

/**
 * Virtual files.
 *
 * These are safe predefined strings. Never insert real
 * filenames, tokens, case IDs, or customer information.
 */
const VIRTUAL_FILES: Record<string, string[]> = {
  "/home/aegis/readme.txt": [
    "AEGIS PARTY TERMINAL",
    "",
    "This is a sandboxed terminal interface.",
    "It does not execute operating-system commands.",
    "",
    'Run "help" to view available commands.',
  ],

  "/home/aegis/modes.txt": [
    "Available Party Modes:",
    "- terminal",
    "- other-side",
    "- battle-royale",
    "- kung-fu-panda",
  ],

  "/home/aegis/team.txt": [
    "2026 Intern Team",
    "",
    "Frontend:",
    "- Katie",
    "- Colin",
    "",
    "Backend:",
    "- Ben",
    "- Gabe",
    "- Brendan",
    "",
    "Infrastructure:",
    "- Corey",
    "",
    'There may be more at "interns".',
  ],

  "/home/aegis/secrets/tribute.txt": [
    "ACCESS CLUE:",
    "",
    'Run the command "interns".',
  ],
};

/**
 * Converts relative paths into normalized absolute paths.
 */
function resolvePath(cwd: string, requestedPath: string): string {
  const requested = requestedPath.trim() || cwd;

  if (requested === "~") {
    return "/home/aegis";
  }

  const startingPath = requested.startsWith("/")
    ? requested
    : `${cwd}/${requested}`;

  const segments = startingPath.split("/").filter(Boolean);

  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (segment === ".") {
      continue;
    }

    if (segment === "..") {
      normalizedSegments.pop();
      continue;
    }

    normalizedSegments.push(segment);
  }

  return `/${normalizedSegments.join("/")}`;
}

function formatUptime(startedAt: number): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - startedAt) / 1000),
  );

  const minutes = Math.floor(elapsedSeconds / 60);

  const seconds = elapsedSeconds % 60;

  return `${minutes}m ${seconds}s`;
}

/**
 * Executes a safe, predefined terminal command.
 */
export function executeTerminalCommand(
  rawCommand: string,
  context: TerminalExecutionContext,
): TerminalCommandResult {
  const trimmedCommand = rawCommand.trim();

  if (!trimmedCommand) {
    return {};
  }

  /**
   * Basic token parsing.
   *
   * This intentionally remains simple. It does not attempt
   * to support pipes, redirection, or shell execution.
   */
  const tokens = trimmedCommand.split(/\s+/);
  const command = tokens[0]?.toLowerCase() ?? "";
  const args = tokens.slice(1);

  switch (command) {
    case "help":
      return {
        output: [
          "Available commands:",
          "",
          "help                 Show this command list",
          "clear                Clear the terminal",
          "history              Show command history",
          "whoami               Show the current role",
          "pwd                  Show the virtual directory",
          "ls [path]            List a virtual directory",
          "cd [path]            Change virtual directory",
          "cat <file>           Read a virtual file",
          "echo <text>          Print text",
          "date                 Show local date and time",
          "uptime               Show terminal session time",
          "status               Show safe system status",
          "team                 Show the intern team",
          "interns              Open the secret tribute",
          "open <page>          Navigate inside the app",
          "mode <name>          Change Party Mode",
          "modes                Open the Party Hub",
          "theme <color>        green, amber, or blue",
          "sudo party           Enable maximum vibes",
          "exit                 Close Terminal Mode",
          "",
          "Use ↑ and ↓ to browse command history.",
          "Use Tab for basic command completion.",
          "Use Ctrl + L to clear the screen.",
        ],
      };

    case "clear":
      return {
        clear: true,
      };

    case "history":
      return {
        output:
          context.commandHistory.length > 0
            ? context.commandHistory.map(
                (entry, index) => `${index + 1}  ${entry}`,
              )
            : ["No commands in history."],
      };

    case "whoami":
      return {
        output: [`${context.role}@aegis`],
      };

    case "pwd":
      return {
        output: [context.cwd],
      };

    case "ls": {
      const requestedPath = args[0] ?? context.cwd;

      const resolvedPath = resolvePath(context.cwd, requestedPath);

      const directoryEntries = VIRTUAL_DIRECTORIES[resolvedPath];

      if (directoryEntries) {
        return {
          output: [directoryEntries.join("  ")],
        };
      }

      if (VIRTUAL_FILES[resolvedPath]) {
        const fileName = resolvedPath.split("/").pop() ?? resolvedPath;

        return {
          output: [fileName],
        };
      }

      return {
        error: [
          `ls: cannot access '${requestedPath}': no such file or directory`,
        ],
      };
    }

    case "cd": {
      const requestedPath = args[0] ?? "~";

      const resolvedPath = resolvePath(context.cwd, requestedPath);

      if (!VIRTUAL_DIRECTORIES[resolvedPath]) {
        return {
          error: [`cd: ${requestedPath}: no such directory`],
        };
      }

      return {
        nextCwd: resolvedPath,
      };
    }

    case "cat": {
      const requestedPath = args[0];

      if (!requestedPath) {
        return {
          error: ["cat: missing file operand"],
        };
      }

      const resolvedPath = resolvePath(context.cwd, requestedPath);

      const fileContents = VIRTUAL_FILES[resolvedPath];

      if (!fileContents) {
        return {
          error: [`cat: ${requestedPath}: no such virtual file`],
        };
      }

      return {
        output: fileContents,
      };
    }

    case "echo":
      return {
        output: [args.join(" ")],
      };

    case "date":
      return {
        output: [new Date().toLocaleString()],
      };

    case "uptime":
      return {
        output: [`Terminal uptime: ${formatUptime(context.startedAt)}`],
      };

    case "status":
      return {
        output: [
          "AEGIS SYSTEM STATUS",
          "Authentication: SECURE",
          "Uploads: UNTOUCHED",
          "Customer data: NOT ACCESSED",
          "Party protocol: ACTIVE",
          "Production vibes: OPTIMAL",
        ],
      };

    case "team":
      return {
        output: [
          "2026 Intern Team detected.",
          "",
          "Frontend: Katie and Colin",
          "Backend: Ben, Gabe, and Brendan",
          "Infrastructure: Corey",
          "",
          'For the full tribute, run "interns".',
        ],
      };

    case "interns":
      return {
        output: ["Opening classified intern archive..."],
        navigateTo: `${context.basePath}/intern-tribute-2026`,
        closeTerminal: true,
      };

    case "open": {
      const destination = args[0]?.toLowerCase();

      const destinations: Record<string, string> = {
        home: context.basePath,
        links: `${context.basePath}/links`,
        create: `${context.basePath}/links/new`,
        tribute: `${context.basePath}/intern-tribute-2026`,
      };

      if (!destination) {
        return {
          output: [
            "Available destinations:",
            "open home",
            "open links",
            "open create",
            "open tribute",
          ],
        };
      }

      const destinationPath = destinations[destination];

      if (!destinationPath) {
        return {
          error: [`open: unknown destination '${destination}'`],
        };
      }

      return {
        output: [`Opening ${destination}...`],
        navigateTo: destinationPath,
        closeTerminal: true,
      };
    }

    case "mode": {
      const requestedMode = args[0]?.toLowerCase();

      if (!requestedMode) {
        return {
          output: [
            "Available modes:",
            "mode terminal",
            "mode other",
            "mode royale",
            "mode panda",
            "mode normal",
          ],
        };
      }

      if (requestedMode === "normal") {
        return {
          setMode: null,
        };
      }

      const modeAliases: Record<string, PartyModeId> = {
        terminal: "terminal",
        other: "other-side",
        "other-side": "other-side",
        royale: "battle-royale",
        "battle-royale": "battle-royale",
        panda: "kung-fu-panda",
        "kung-fu-panda": "kung-fu-panda",
      };

      const matchingMode = modeAliases[requestedMode];

      if (matchingMode) {
        return {
          setMode: matchingMode,
        };
      }

      return {
        error: [`mode: unknown mode '${requestedMode}'`],
      };
    }

    case "modes":
      return {
        openHub: true,
      };

    case "theme": {
      const requestedTheme = args[0]?.toLowerCase();

      if (
        requestedTheme === "green" ||
        requestedTheme === "amber" ||
        requestedTheme === "blue"
      ) {
        return {
          terminalTheme: requestedTheme,
          output: [`Terminal color changed to ${requestedTheme}.`],
        };
      }

      return {
        error: ["theme: choose green, amber, or blue"],
      };
    }

    case "sudo":
      if (args.join(" ").toLowerCase() === "party") {
        return {
          output: [
            "[sudo] authorization accepted",
            "Maximum celebration privileges enabled.",
            "Production remains secure.",
          ],
        };
      }

      return {
        error: ["sudo: permission denied", "Hint: try sudo party"],
      };

    case "exit":
      return {
        closeTerminal: true,
      };

    default:
      return {
        error: [
          `${command}: command not found`,
          'Run "help" to view available commands.',
        ],
      };
  }
}
