import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  executeTerminalCommand,
  TERMINAL_COMMAND_NAMES,
} from "./terminalCommands";
import { usePartyMode } from "./PartyModeContext";

import type { TerminalColorTheme } from "./partyModeTypes";

type TerminalLineKind = "system" | "input" | "output" | "error";

type TerminalLine = {
  id: number;
  kind: TerminalLineKind;
  text: string;
};

/**
 * Functional, sandboxed terminal.
 *
 * This terminal never executes real operating-system,
 * JavaScript, backend, or database commands.
 */
export function TerminalMode() {
  const { activeMode, activateMode, exitMode, openHub } = usePartyMode();

  const navigate = useNavigate();
  const location = useLocation();

  const inputRef = useRef<HTMLInputElement>(null);

  const historyEndRef = useRef<HTMLDivElement>(null);

  const nextLineIdRef = useRef(1);
  const startedAtRef = useRef(Date.now());

  const [input, setInput] = useState("");

  const [cwd, setCwd] = useState("/home/aegis");

  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  const [historyCursor, setHistoryCursor] = useState<number | null>(null);

  const [terminalTheme, setTerminalTheme] =
    useState<TerminalColorTheme>("green");

  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 0,
      kind: "system",
      text: "AEGIS PARTY TERMINAL v1.0",
    },
    {
      id: -1,
      kind: "system",
      text: "Sandboxed command environment initialized.",
    },
    {
      id: -2,
      kind: "system",
      text: 'Run "help" to view available commands.',
    },
  ]);

  const role = location.pathname.startsWith("/admin") ? "admin" : "support";

  const basePath = role === "admin" ? "/admin" : "/support";

  const prompt = useMemo(() => `${role}@aegis:${cwd}$`, [cwd, role]);

  /**
   * Scroll to the newest terminal output.
   */
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [lines]);

  /**
   * Focus the command line whenever Terminal Mode opens.
   */
  useEffect(() => {
    if (activeMode === "terminal") {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [activeMode]);

  if (activeMode !== "terminal") {
    return null;
  }

  function createLine(kind: TerminalLineKind, text: string): TerminalLine {
    const line: TerminalLine = {
      id: nextLineIdRef.current,
      kind,
      text,
    };

    nextLineIdRef.current += 1;

    return line;
  }

  function appendLines(kind: TerminalLineKind, values: string[]): void {
    setLines((currentLines) => [
      ...currentLines,
      ...values.map((value) => createLine(kind, value)),
    ]);
  }

  function executeCommand(rawCommand: string): void {
    const normalizedCommand = rawCommand.trim();

    if (!normalizedCommand) {
      return;
    }

    // appendLines expects an array of strings.
    appendLines("input", [normalizedCommand]);

    const nextHistory = [...commandHistory, normalizedCommand];

    setCommandHistory(nextHistory);
    setHistoryCursor(null);

    const result = executeTerminalCommand(normalizedCommand, {
      cwd,
      role,
      basePath,
      commandHistory: nextHistory,
      startedAt: startedAtRef.current,
    });

    if (result.clear) {
      setLines([]);
    }

    if (result.output) {
      appendLines("output", result.output);
    }

    if (result.error) {
      appendLines("error", result.error);
    }

    if (result.nextCwd) {
      setCwd(result.nextCwd);
    }

    if (result.terminalTheme) {
      setTerminalTheme(result.terminalTheme);
    }

    if (result.navigateTo) {
      navigate(result.navigateTo);
    }

    if (result.openHub) {
      openHub();
    }

    if (Object.prototype.hasOwnProperty.call(result, "setMode")) {
      if (result.setMode === null) {
        exitMode();
      } else if (result.setMode) {
        activateMode(result.setMode);
      }
    }

    if (result.closeTerminal) {
      exitMode();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    executeCommand(input);
    setInput("");
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    /**
     * Ctrl + L is a common terminal shortcut for clear.
     */
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setLines([]);
      return;
    }

    /**
     * Browse backward through command history.
     */
    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (commandHistory.length === 0) {
        return;
      }

      const nextCursor =
        historyCursor === null
          ? commandHistory.length - 1
          : Math.max(0, historyCursor - 1);

      setHistoryCursor(nextCursor);
      setInput(commandHistory[nextCursor] ?? "");

      return;
    }

    /**
     * Browse forward through command history.
     */
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (historyCursor === null) {
        return;
      }

      const nextCursor = historyCursor + 1;

      if (nextCursor >= commandHistory.length) {
        setHistoryCursor(null);
        setInput("");
      } else {
        setHistoryCursor(nextCursor);
        setInput(commandHistory[nextCursor] ?? "");
      }

      return;
    }

    /**
     * Basic command completion.
     *
     * This only completes the first command word.
     */
    if (event.key === "Tab") {
      event.preventDefault();

      const trimmedInput = input.trimStart();

      if (!trimmedInput || trimmedInput.includes(" ")) {
        return;
      }

      const matches = TERMINAL_COMMAND_NAMES.filter((command) =>
        command.startsWith(trimmedInput.toLowerCase()),
      );

      if (matches.length === 1) {
        setInput(matches[0]);
      } else if (matches.length > 1) {
        appendLines("output", [matches.join("  ")]);
      }
    }
  }

  return (
    <section
      className={["party-terminal", `party-terminal--${terminalTheme}`].join(
        " ",
      )}
      aria-label="Aegis Party Terminal"
      onMouseDown={() => inputRef.current?.focus()}
    >
      <header className="party-terminal__toolbar">
        <div className="party-terminal__lights">
          <span />
          <span />
          <span />
        </div>

        <div>
          <strong>AEGIS PARTY TERMINAL</strong>

          <span>Safe virtual environment</span>
        </div>

        <div className="party-terminal__actions">
          <button type="button" onClick={openHub}>
            Modes
          </button>

          <button type="button" onClick={exitMode}>
            Exit Terminal
          </button>
        </div>
      </header>

      <div className="party-terminal__history" aria-live="polite">
        {lines.map((line) => (
          <p
            key={line.id}
            className={`party-terminal__line party-terminal__line--${line.kind}`}
          >
            {line.kind === "input" && <span>{prompt} </span>}

            {line.text || "\u00A0"}
          </p>
        ))}

        <div ref={historyEndRef} />
      </div>

      <form className="party-terminal__form" onSubmit={handleSubmit}>
        <label htmlFor="party-terminal-input">{prompt}</label>

        <input
          ref={inputRef}
          id="party-terminal-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleInputKeyDown}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Terminal command"
        />
      </form>
    </section>
  );
}
