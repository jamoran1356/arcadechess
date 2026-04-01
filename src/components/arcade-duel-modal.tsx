'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ArcadeAttempt, ArcadeScenario } from "@/lib/arcade";
import { useDict } from "@/components/locale-provider";
import { MazeRunnerGame } from "@/components/arcade-games/maze-runner";
import { PingPongGame } from "@/components/arcade-games/ping-pong";
import { ReactionDuelGame } from "@/components/arcade-games/reaction-duel";

type ArcadeDuelModalProps = {
  duel: {
    id: string;
    attackerId: string;
    defenderId: string;
    attackerEnteredAt: string | null;
    defenderEnteredAt: string | null;
    attackerName: string;
    defenderName: string;
    attackerScore: number | null;
    defenderScore: number | null;
    game: {
      name: string;
      blurb: string;
      timeLimitMs: number;
      antiCheat: string;
    };
    scenario: ArcadeScenario;
  };
  currentUserId: string;
  onStateRefresh?: () => Promise<void>;
};

export function ArcadeDuelModal({ duel, currentUserId, onStateRefresh }: ArcadeDuelModalProps) {
  const dict = useDict();
  const arc = dict.arcade;
  const myScore = currentUserId === duel.attackerId ? duel.attackerScore : duel.defenderScore;
  const [phase, setPhase] = useState<"intro" | "active" | "submitted">(
    myScore !== null ? "submitted" : "intro",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [timeLeft, setTimeLeft] = useState(duel.game.timeLimitMs);
  const [memoryPreview, setMemoryPreview] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [keyIndex, setKeyIndex] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const actionsRef = useRef<Array<{ at: number; value: string }>>([]);
  const submitAttemptRef = useRef<(() => Promise<void>) | null>(null);
  const duelIdRef = useRef<string | null>(null);
  const enteringRef = useRef(false);

  const playerRole =
    currentUserId === duel.attackerId ? "attacker" : currentUserId === duel.defenderId ? "defender" : "spectator";

  const submitAttempt = useCallback(async () => {
    if (phase === "submitted" || startTimeRef.current === null) {
      return;
    }

    const payload: ArcadeAttempt = {
      startedAt: Math.round(startTimeRef.current),
      finishedAt: Math.round(performance.now()),
      actions: actionsRef.current.map((a) => ({ ...a, at: Math.round(a.at) })),
    };

    setPhase("submitted");
    startTransition(() => {
      void fetch(`/api/duels/${duel.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error ?? arc.submitError);
          }
          setMessage(data.message ?? arc.submitSuccess);
          await onStateRefresh?.();
        })
        .catch(async (error: unknown) => {
          // If the duel was already resolved (e.g. by participation polling),
          // just refresh state — don't reset to "intro" which causes a visual re-open.
          setMessage(error instanceof Error ? error.message : arc.submitError);
          try { await onStateRefresh?.(); } catch { /* best-effort */ }
        });
    });
  }, [arc.submitError, arc.submitSuccess, duel.id, onStateRefresh, phase]);

  useEffect(() => {
    const myScoreResolved = (currentUserId === duel.attackerId ? duel.attackerScore : duel.defenderScore) !== null;

    if (duelIdRef.current !== duel.id) {
      duelIdRef.current = duel.id;
      setMessage(null);
      setTimeLeft(duel.game.timeLimitMs);
      setMemoryPreview(false);
      setTargetIndex(0);
      setMemoryIndex(0);
      setKeyIndex(0);
      actionsRef.current = [];
      startTimeRef.current = null;
      setPhase(myScoreResolved ? "submitted" : "intro");
      return;
    }

    if (myScoreResolved) {
      setPhase("submitted");
    }
  }, [currentUserId, duel.attackerId, duel.attackerScore, duel.defenderScore, duel.game.timeLimitMs, duel.id]);

  useEffect(() => {
    submitAttemptRef.current = submitAttempt;
  }, [submitAttempt]);

  useEffect(() => {
    if (phase !== "active" || startTimeRef.current === null) {
      return;
    }

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current!;
      const remaining = Math.max(0, duel.game.timeLimitMs - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(interval);
        void submitAttemptRef.current?.();
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [duel.game.timeLimitMs, phase]);

  const scenarioKeyLength = duel.scenario.kind === "keys" ? (duel.scenario as { sequence: string[] }).sequence.length : 0;

  useEffect(() => {
    if (phase !== "active" || duel.scenario.kind !== "keys") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (duel.scenario.kind !== "keys") return;
      const expected = duel.scenario.sequence[keyIndex];
      if (!expected || event.key.toUpperCase() !== expected) {
        return;
      }

      const startedAt = startTimeRef.current ?? 0;
      actionsRef.current = [
        ...actionsRef.current,
        { at: Math.max(0, Math.round(event.timeStamp - startedAt)), value: expected },
      ];
      const nextIndex = keyIndex + 1;
      setKeyIndex(nextIndex);
      if (nextIndex === duel.scenario.sequence.length) {
        void submitAttemptRef.current?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [duel.scenario, scenarioKeyLength, keyIndex, phase]);

  const progressLabel = useMemo(() => {
    if (duel.scenario.kind === "targets") {
      return `${targetIndex}/${duel.scenario.targets.length}`;
    }
    if (duel.scenario.kind === "memory") {
      return `${memoryIndex}/${(duel.scenario as { sequence: string[] }).sequence.length}`;
    }
    if (duel.scenario.kind === "keys") {
      return `${keyIndex}/${(duel.scenario as { sequence: string[] }).sequence.length}`;
    }
    if (duel.scenario.kind === "maze") {
      return "🏁 Llega a la meta";
    }
    if (duel.scenario.kind === "pong") {
      return `Gana ${(duel.scenario as { winScore: number }).winScore} puntos`;
    }
    if (duel.scenario.kind === "reaction") {
      return `Reacciona rápido`;
    }
    return "";
  }, [duel.scenario, keyIndex, memoryIndex, targetIndex]);

  async function startGame() {
    if (phase === "active" || phase === "submitted" || enteringRef.current) {
      return;
    }

    enteringRef.current = true;
    setMessage(null);
    setPhase("active");
    setTargetIndex(0);
    setMemoryIndex(0);
    setKeyIndex(0);
    actionsRef.current = [];
    startTimeRef.current = performance.now();
    setTimeLeft(duel.game.timeLimitMs);
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
    }

    // Registrar participación en segundo plano
    try {
      const response = await fetch(`/api/duels/${duel.id}/enter-arcade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? arc.submitError);
      }
      await onStateRefresh?.();
    } catch (error) {
      console.error("Error registering arcade participation:", error);
      setMessage(error instanceof Error ? error.message : arc.submitError);
      // Don't reset to "intro" — the duel may already be resolved.
      // Let state sync close the modal naturally.
      try { await onStateRefresh?.(); } catch { /* best-effort */ }
      return;
    } finally {
      enteringRef.current = false;
    }

    if (duel.scenario.kind === "memory") {
      setMemoryPreview(true);
      previewTimeoutRef.current = window.setTimeout(() => {
        setMemoryPreview(false);
      }, 3000);
    }
  }

  useEffect(() => {
    if (phase !== "intro") {
      return;
    }

    const isMultiplayer = duel.attackerId !== duel.defenderId;
    if (!isMultiplayer) {
      return;
    }

    const currentEntered = playerRole === "attacker" ? Boolean(duel.attackerEnteredAt) : Boolean(duel.defenderEnteredAt);
    const otherEntered = playerRole === "attacker" ? Boolean(duel.defenderEnteredAt) : Boolean(duel.attackerEnteredAt);

    if (!currentEntered && otherEntered) {
      void startGame();
    }
  }, [
    duel.attackerEnteredAt,
    duel.attackerId,
    duel.defenderEnteredAt,
    duel.defenderId,
    phase,
    playerRole,
  ]);

  function recordTarget(event: React.MouseEvent<HTMLButtonElement>, value: string) {
    if (phase !== "active" || duel.scenario.kind !== "targets") {
      return;
    }
    const expected = duel.scenario.targets[targetIndex]?.id;
    if (value !== expected) {
      return;
    }

    const startedAt = startTimeRef.current ?? 0;
    actionsRef.current = [
      ...actionsRef.current,
      { at: Math.max(0, Math.round(event.timeStamp - startedAt)), value },
    ];
    const nextIndex = targetIndex + 1;
    setTargetIndex(nextIndex);
    if (nextIndex === duel.scenario.targets.length) {
      void submitAttemptRef.current?.();
    }
  }

  function recordMemory(event: React.MouseEvent<HTMLButtonElement>, value: string) {
    if (phase !== "active" || duel.scenario.kind !== "memory" || memoryPreview) {
      return;
    }

    const startedAt = startTimeRef.current ?? 0;
    actionsRef.current = [
      ...actionsRef.current,
      { at: Math.max(0, Math.round(event.timeStamp - startedAt)), value },
    ];
    const nextIndex = memoryIndex + 1;
    setMemoryIndex(nextIndex);
    if (duel.scenario.kind === "memory" && nextIndex === (duel.scenario as { sequence: string[] }).sequence.length) {
      void submitAttemptRef.current?.();
    }
  }

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        window.clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetch("/api/duels/arcade-participation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duelId: duel.id }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            return;
          }
          if (Number(data.processed ?? 0) > 0) {
            await onStateRefresh?.();
          }
        })
        .catch(() => {
          // no-op: el polling es best-effort
        });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [duel.id, onStateRefresh]);

  if (playerRole === "spectator") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{duel.game.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{duel.game.blurb}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-300">
              {playerRole === "attacker" ? `vs ${duel.defenderName}` : `vs ${duel.attackerName}`}
            </p>
            {phase === "active" && (
              <p className="mt-2 text-2xl font-bold text-amber-300" suppressHydrationWarning>
                {Math.max(0, Math.ceil(timeLeft / 1000))}s
              </p>
            )}
          </div>
        </div>

        {phase === "intro" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/8 bg-white/5 p-4 text-sm text-slate-200">
              <p className="mb-2 font-semibold">
                {playerRole === "attacker" ? arc.attackerRole : arc.defenderRole}
              </p>
              <p>{duel.game.antiCheat}</p>
            </div>
            <button
              onClick={() => {
                void startGame();
              }}
              disabled={isPending}
              className="w-full rounded-lg bg-amber-400 py-3 font-bold text-slate-950 transition hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50"
            >
              {arc.startBtn}
            </button>
          </div>
        )}

        {phase === "active" && (
          <div className="space-y-4">
            <p className="text-center text-sm text-slate-300">{progressLabel}</p>

            {duel.scenario.kind === "targets" ? (
              <div className="relative h-[360px] rounded-[1.5rem] border border-white/8 bg-[radial-gradient(circle_at_top,_rgba(103,232,249,0.12),_transparent_35%),#07121e]">
                {duel.scenario.targets.map((target, index) => (
                  <button
                    key={target.id}
                    onClick={(event) => recordTarget(event, target.id)}
                    className={`absolute flex items-center justify-center rounded-full border text-sm font-semibold transition ${
                      index < targetIndex
                        ? "border-emerald-300/30 bg-emerald-300/20 text-emerald-100"
                        : index === targetIndex
                          ? "border-amber-300/50 bg-amber-300/20 text-amber-100"
                          : "border-white/10 bg-white/6 text-slate-300"
                    }`}
                    style={{
                      left: `${target.x}%`,
                      top: `${target.y}%`,
                      width: `${target.size * 4}px`,
                      height: `${target.size * 4}px`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {target.id}
                  </button>
                ))}
              </div>
            ) : null}

            {duel.scenario.kind === "memory" ? (
              <div className="space-y-5">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-300">
                  {memoryPreview ? `Memoriza: ${(duel.scenario as { sequence: string[] }).sequence.join(" • ")}` : arc.memorizeHint}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["A1", "A2", "A3"],
                    ["B1", "B2", "B3"],
                    ["C1", "C2", "C3"],
                  ]
                    .flatMap((row) => row)
                    .map((cell) => (
                      <button
                        key={cell}
                        onClick={(event) => recordMemory(event, cell)}
                        className="aspect-square rounded-[1.25rem] border border-white/10 bg-slate-900 text-lg font-semibold text-white transition hover:border-cyan-300/45 hover:bg-cyan-300/10"
                      >
                        {cell}
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            {duel.scenario.kind === "keys" ? (
              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-300">
                  {arc.keysHint}: <span className="font-bold text-cyan-300">{(duel.scenario as { sequence: string[] }).sequence.slice(keyIndex, keyIndex + 3).join(" → ")}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["A", "S", "D", "J", "K", "L"].map((key) => (
                    <div
                      key={key}
                      className={`rounded-lg border-2 py-6 text-center text-2xl font-bold transition ${
                        (duel.scenario as { sequence: string[] }).sequence[keyIndex] === key
                          ? "border-cyan-300 bg-cyan-300/20 text-cyan-300"
                          : "border-slate-600 bg-slate-800 text-slate-400"
                      }`}
                    >
                      {key}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {duel.scenario.kind === "maze" ? (
              <MazeRunnerGame
                scenario={duel.scenario as import("@/components/arcade-games/maze-runner").MazeScenario}
                onAction={(value) => {
                  const startedAt = startTimeRef.current ?? 0;
                  actionsRef.current = [
                    ...actionsRef.current,
                    { at: Math.max(0, Math.round(performance.now() - startedAt)), value },
                  ];
                }}
                onComplete={() => void submitAttemptRef.current?.()}
                disabled={phase !== "active"}
              />
            ) : null}

            {duel.scenario.kind === "pong" ? (
              <PingPongGame
                scenario={duel.scenario as import("@/components/arcade-games/ping-pong").PingPongScenario}
                onAction={(value) => {
                  const startedAt = startTimeRef.current ?? 0;
                  actionsRef.current = [
                    ...actionsRef.current,
                    { at: Math.max(0, Math.round(performance.now() - startedAt)), value },
                  ];
                }}
                onComplete={() => void submitAttemptRef.current?.()}
                disabled={phase !== "active"}
              />
            ) : null}

            {duel.scenario.kind === "reaction" ? (
              <ReactionDuelGame
                scenario={duel.scenario as import("@/components/arcade-games/reaction-duel").ReactionScenario}
                onAction={(value) => {
                  const startedAt = startTimeRef.current ?? 0;
                  actionsRef.current = [
                    ...actionsRef.current,
                    { at: Math.max(0, Math.round(performance.now() - startedAt)), value },
                  ];
                }}
                onComplete={() => void submitAttemptRef.current?.()}
                disabled={phase !== "active"}
              />
            ) : null}

            {message ? <p className="mt-4 text-sm text-rose-300">{message}</p> : null}
          </div>
        )}

        {phase === "submitted" && (
          <div className="space-y-4 text-center">
            {myScore !== null && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">Tu puntuación</p>
                <p className="mt-1 text-3xl font-bold text-amber-300">{myScore}</p>
              </div>
            )}
            {(() => {
              const rivalScore = currentUserId === duel.attackerId ? duel.defenderScore : duel.attackerScore;
              if (rivalScore !== null && myScore !== null) {
                const won = myScore > rivalScore;
                const tied = myScore === rivalScore;
                return (
                  <div className={`rounded-xl border p-4 ${won ? "border-emerald-400/30 bg-emerald-400/10" : tied ? "border-amber-400/30 bg-amber-400/10" : "border-rose-400/30 bg-rose-400/10"}`}>
                    <p className="text-sm text-slate-300">
                      Rival: <span className="font-bold">{rivalScore}</span>
                    </p>
                    <p className={`mt-1 text-lg font-bold ${won ? "text-emerald-300" : tied ? "text-amber-300" : "text-rose-300"}`}>
                      {won ? "¡Ganaste el duelo!" : tied ? "Empate → Revancha" : "Perdiste el duelo"}
                    </p>
                  </div>
                );
              }
              return <p className="text-lg font-semibold text-slate-300">{arc.waitingRival}</p>;
            })()}
            {message ? <p className="text-sm text-slate-400">{message}</p> : null}
          </div>
        )}

        {isPending ? <p className="mt-4 text-sm text-slate-400">{arc.validating}</p> : null}
      </div>
    </div>
  );
}
