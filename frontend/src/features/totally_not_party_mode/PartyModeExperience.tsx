import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { usePartyMode } from "./PartyModeContext";

type ModeFrameProps = {
  title: string;
  eyebrow: string;
  className?: string;
  children: ReactNode;
};

function ModeFrame({
  children,
  className = "",
  eyebrow,
  title,
}: ModeFrameProps) {
  const { currentLevel, openHub, stopMode, xp } = usePartyMode();

  return (
    <div className={`party-experience ${className}`}>
      <header className="party-experience__toolbar">
        <div>
          <span>{eyebrow}</span>
          <strong>{title}</strong>
        </div>

        <div className="party-experience__toolbar-actions">
          <span className="party-experience__xp">
            Lv. {currentLevel.level} · {xp} XP
          </span>

          <button type="button" onClick={openHub}>
            Modes
          </button>

          <button
            type="button"
            className="party-experience__exit"
            onClick={stopMode}
          >
            Exit Party Mode
          </button>
        </div>
      </header>

      <main className="party-experience__content">{children}</main>
    </div>
  );
}

function TerminalMode() {
  const { addXp, stopMode } = usePartyMode();

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([
    "AEGIS PARTY TERMINAL v1.0",
    "Secure connection established.",
    'Type "help" to view available commands.',
  ]);

  const awardedCommandsRef = useRef(new Set<string>());

  function awardCommandOnce(command: string, amount: number): void {
    if (awardedCommandsRef.current.has(command)) {
      return;
    }

    awardedCommandsRef.current.add(command);
    addXp(amount);
  }

  function submitCommand(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const command = input.trim().toLowerCase();

    if (!command) {
      return;
    }

    if (command === "clear") {
      setHistory([]);
      setInput("");
      return;
    }

    if (command === "exit") {
      stopMode();
      return;
    }

    let response: string;

    switch (command) {
      case "help":
        response = "Commands: help, status, team, shield, party, clear, exit";
        awardCommandOnce(command, 5);
        break;

      case "status":
        response = "SYSTEM: SECURE | UPLOADS: UNTOUCHED | VIBES: OPTIMAL";
        awardCommandOnce(command, 5);
        break;

      case "team":
        response =
          "2026 INTERN TEAM DETECTED: FRONTEND + BACKEND + INFRASTRUCTURE";
        awardCommandOnce(command, 20);
        break;

      case "shield":
        response = "AEGIS SHIELD INTEGRITY: 100% | PARTY RESISTANCE: 0%";
        awardCommandOnce(command, 10);
        break;

      case "party":
        response = "PARTY PROTOCOL CONFIRMED. PRODUCTION REMAINS SECURE.";
        awardCommandOnce(command, 10);
        break;

      default:
        response = `COMMAND NOT FOUND: ${command}`;
        break;
    }

    setHistory((currentHistory) => [
      ...currentHistory,
      `> ${command}`,
      response,
    ]);

    setInput("");
  }

  return (
    <ModeFrame
      eyebrow="Protocol 01"
      title="Terminal Mode"
      className="terminal-mode"
    >
      <section className="terminal-window">
        <div className="terminal-window__lights">
          <span />
          <span />
          <span />
        </div>

        <div className="terminal-window__history" aria-live="polite">
          {history.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>

        <form className="terminal-window__form" onSubmit={submitCommand}>
          <label htmlFor="party-terminal-input">aegis@party:~$</label>

          <input
            id="party-terminal-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
            autoFocus
          />
        </form>
      </section>
    </ModeFrame>
  );
}

function AegisClickerMode() {
  const { addXp } = usePartyMode();

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);

  const lastClickTimeRef = useRef(0);
  const awardedMilestoneRef = useRef(0);

  function handleShieldClick(): void {
    const currentTime = Date.now();

    const nextCombo =
      currentTime - lastClickTimeRef.current <= 650
        ? Math.min(combo + 1, 10)
        : 1;

    const nextScore = score + nextCombo;
    const nextMilestone = Math.floor(nextScore / 50);

    lastClickTimeRef.current = currentTime;

    setCombo(nextCombo);
    setScore(nextScore);

    if (nextMilestone > awardedMilestoneRef.current) {
      awardedMilestoneRef.current = nextMilestone;
      addXp(10);
    }
  }

  return (
    <ModeFrame
      eyebrow="Protocol 02"
      title="Aegis Clicker"
      className="aegis-clicker-mode"
    >
      <section className="clicker-game">
        <p className="clicker-game__instructions">
          Click rapidly to build your combo. Every 50 Protection Points awards
          10 XP.
        </p>

        <button
          type="button"
          className="clicker-shield"
          onClick={handleShieldClick}
          aria-label="Click the Aegis shield"
        >
          <span aria-hidden="true">🛡️</span>
        </button>

        <div className="clicker-game__score">
          <div>
            <span>Protection Points</span>
            <strong>{score}</strong>
          </div>

          <div>
            <span>Combo</span>
            <strong>×{combo}</strong>
          </div>
        </div>
      </section>
    </ModeFrame>
  );
}

function PandaWarriorMode() {
  const { addXp } = usePartyMode();

  const [trainingResult, setTrainingResult] = useState<string | null>(null);

  const hasCompletedTrainingRef = useRef(false);

  function completeTraining(result: string): void {
    setTrainingResult(result);

    if (hasCompletedTrainingRef.current) {
      return;
    }

    hasCompletedTrainingRef.current = true;
    addXp(20);
  }

  return (
    <ModeFrame
      eyebrow="Protocol 03"
      title="Panda Warrior"
      className="panda-warrior-mode"
    >
      <section className="panda-training">
        <div className="panda-training__panda" aria-hidden="true">
          🐼
        </div>

        <p className="party-mode-eyebrow">The Bamboo Training Grounds</p>

        <h2>Choose your training discipline</h2>

        <p>
          This is an original martial-arts-inspired theme. It does not use movie
          characters, quotes, or artwork.
        </p>

        <div className="panda-training__choices">
          <button
            type="button"
            onClick={() =>
              completeTraining(
                "Focus achieved. Your debugging perception increased.",
              )
            }
          >
            Focus
          </button>

          <button
            type="button"
            onClick={() =>
              completeTraining(
                "Balance achieved. Your frontend and backend are aligned.",
              )
            }
          >
            Balance
          </button>

          <button
            type="button"
            onClick={() =>
              completeTraining("Courage achieved. You are ready to deploy.")
            }
          >
            Courage
          </button>
        </div>

        {trainingResult && (
          <p className="panda-training__result" aria-live="polite">
            {trainingResult}
          </p>
        )}
      </section>
    </ModeFrame>
  );
}

type Threat = {
  id: number;
  x: number;
  y: number;
};

function AegisBattleRoyaleMode() {
  const { addXp } = usePartyMode();

  const [timeRemaining, setTimeRemaining] = useState(30);
  const [score, setScore] = useState(0);
  const [threats, setThreats] = useState<Threat[]>([]);

  const nextThreatIdRef = useRef(1);
  const hasAwardedResultRef = useRef(false);

  const isRunning = timeRemaining > 0;

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const countdownTimer = window.setTimeout(() => {
      setTimeRemaining((currentTime) => Math.max(0, currentTime - 1));
    }, 1_000);

    return () => {
      window.clearTimeout(countdownTimer);
    };
  }, [timeRemaining, isRunning]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const spawnTimer = window.setInterval(() => {
      const newThreat: Threat = {
        id: nextThreatIdRef.current,
        x: 8 + Math.random() * 84,
        y: 10 + Math.random() * 76,
      };

      nextThreatIdRef.current += 1;

      setThreats((currentThreats) => [...currentThreats.slice(-7), newThreat]);
    }, 750);

    return () => {
      window.clearInterval(spawnTimer);
    };
  }, [isRunning]);

  useEffect(() => {
    if (timeRemaining !== 0 || hasAwardedResultRef.current) {
      return;
    }

    hasAwardedResultRef.current = true;
    setThreats([]);

    if (score >= 20) {
      addXp(40);
    } else if (score >= 10) {
      addXp(25);
    } else {
      addXp(10);
    }
  }, [addXp, score, timeRemaining]);

  function destroyThreat(threatId: number): void {
    if (!isRunning) {
      return;
    }

    setThreats((currentThreats) =>
      currentThreats.filter((threat) => threat.id !== threatId),
    );

    setScore((currentScore) => currentScore + 1);
  }

  return (
    <ModeFrame
      eyebrow="Protocol 04"
      title="Aegis Battle Royale"
      className="battle-royale-mode"
    >
      <section className="battle-game">
        <header className="battle-game__status">
          <div>
            <span>Time</span>
            <strong>{timeRemaining}s</strong>
          </div>

          <div>
            <span>Threats Destroyed</span>
            <strong>{score}</strong>
          </div>
        </header>

        <div className="battle-game__field">
          <div className="battle-game__core" aria-label="Aegis Core">
            🛡️
          </div>

          {threats.map((threat) => (
            <button
              key={threat.id}
              type="button"
              className="battle-game__threat"
              style={{
                left: `${threat.x}%`,
                top: `${threat.y}%`,
              }}
              onClick={() => destroyThreat(threat.id)}
              aria-label="Destroy incoming threat"
            >
              ⚠
            </button>
          ))}

          {!isRunning && (
            <div className="battle-game__result">
              <strong>Round complete</strong>
              <span>You destroyed {score} incoming threats.</span>
            </div>
          )}
        </div>
      </section>
    </ModeFrame>
  );
}

function UpsideDownMode() {
  return (
    <ModeFrame
      eyebrow="Protocol 05"
      title="Upside Down Mode"
      className="upside-down-mode"
    >
      <section className="upside-down-message">
        <span aria-hidden="true">🙃</span>

        <h2>Reality has been inverted.</h2>

        <p>
          The application is upside down, but this control panel remains upright
          so you can safely exit.
        </p>

        <p>
          Press <kbd>Esc</kbd> at any time.
        </p>
      </section>
    </ModeFrame>
  );
}

export function PartyModeExperience() {
  const { activeMode } = usePartyMode();

  switch (activeMode) {
    case "terminal":
      return <TerminalMode />;

    case "aegis-clicker":
      return <AegisClickerMode />;

    case "panda-warrior":
      return <PandaWarriorMode />;

    case "battle-royale":
      return <AegisBattleRoyaleMode />;

    case "upside-down":
      return <UpsideDownMode />;

    default:
      return null;
  }
}
