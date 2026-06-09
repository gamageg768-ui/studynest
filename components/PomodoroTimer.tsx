"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

type Phase = "work" | "short" | "long";

const PHASE_LABELS: Record<Phase, string> = {
  work: "Focus time",
  short: "Short break",
  long: "Long break",
};

const PHASE_COLORS: Record<Phase, string> = {
  work: "var(--accent)",
  short: "var(--success)",
  long: "#f97316",
};

const DEFAULT_DURATIONS: Record<Phase, number> = {
  work: 25,
  short: 5,
  long: 15,
};

function getStoredDurations(): Record<Phase, number> {
  try {
    const stored = localStorage.getItem("studynest_pomodoro");
    return stored ? { ...DEFAULT_DURATIONS, ...JSON.parse(stored) } : DEFAULT_DURATIONS;
  } catch {
    return DEFAULT_DURATIONS;
  }
}

interface Props {
  notebookId?: number;
}

export default function PomodoroTimer({ notebookId }: Props) {
  const [phase, setPhase] = useState<Phase>("work");
  const [durations] = useState<Record<Phase, number>>(getStoredDurations);
  const [secondsLeft, setSecondsLeft] = useState(durations.work * 60);
  const [running, setRunning] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [minimized, setMinimized] = useState(true);
  const intervalRef = useRef<number | null>(null);
  const currentPhaseRef = useRef<Phase>("work");
  const durationsRef = useRef(durations);

  useEffect(() => { durationsRef.current = durations; }, [durations]);

  const playSound = () => {
    try {
      const audio = new Audio("/sounds/ding.mp3");
      audio.play().catch(() => {});
    } catch {}
  };

  const nextPhase = (completedPhase: Phase, count: number) => {
    if (completedPhase === "work") {
      const newCount = count + 1;
      setPomodoroCount(newCount);
      // Log study session
      api.post("/study-sessions", {
        duration_seconds: durationsRef.current.work * 60,
        notebook_id: notebookId ?? null,
      }).catch(() => {});
      const nextP: Phase = newCount % 4 === 0 ? "long" : "short";
      currentPhaseRef.current = nextP;
      setPhase(nextP);
      setSecondsLeft(durationsRef.current[nextP] * 60);
      setRunning(true);
    } else {
      currentPhaseRef.current = "work";
      setPhase("work");
      setSecondsLeft(durationsRef.current.work * 60);
      setRunning(true);
    }
    playSound();
  };

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setPomodoroCount((c) => {
            nextPhase(currentPhaseRef.current, c);
            return c;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const toggle = () => setRunning((r) => !r);
  const reset = () => {
    setRunning(false);
    setSecondsLeft(durations[phase] * 60);
  };

  const totalSeconds = durations[phase] * 60;
  const pct = secondsLeft / totalSeconds;
  const RADIUS = 42;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC * (1 - pct);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (minimized) {
    return (
      <div
        className="pomodoro-widget minimized"
        onClick={() => setMinimized(false)}
        title={`Pomodoro — ${mm}:${ss} (${PHASE_LABELS[phase]})`}
      >
        🍅
      </div>
    );
  }

  return (
    <div className="pomodoro-widget">
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }} onClick={() => setMinimized(true)}>
          —
        </button>
      </div>
      <svg className="pomodoro-svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={PHASE_COLORS[phase]}
          strokeWidth="8"
          strokeDasharray={CIRC}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s linear" }}
        />
      </svg>
      <div className="pomodoro-time">{mm}:{ss}</div>
      <div className="pomodoro-phase">{PHASE_LABELS[phase]}</div>
      <div className="pomodoro-controls">
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={toggle}>
          {running ? "Pause" : "Start"}
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={reset}>
          Reset
        </button>
      </div>
      <div className="pomodoro-count">🍅 × {pomodoroCount}</div>
    </div>
  );
}
