'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ArcadeAttempt, ArcadeScenario } from "@/lib/arcade";

type ArcadeDuelModalProps = {
  duel: {
    id: string;
    attackerId: string;
    defenderId: string;
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
};

export function ArcadeDuelModal({ duel, currentUserId }: ArcadeDuelModalProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "active" | "submitted">(
    duel.attackerScore !== null || duel.defenderScore !== null ? "submitted" : "intro",
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

  const playerRole =
    currentUserId === duel.attackerId ? "attacker" : currentUserId === duel.defenderId ? "defender" : "spectator";

  const submitAttempt = useCallback(async () => {
    if (phase === "submitted" || startTimeRef.current === null) {
      return;
    }

    const payload: ArcadeAttempt = {
      startedAt: startTimeRef.current,
      finishedAt: performance.now(),
      actions: actionsRef.current,
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
            throw new Error(data.error ?? "No se pudo enviar el resultado.");
          }
          setMessage(data.message ?? "Resultado enviado.");
          router.refresh();
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "No se pudo enviar el resultado.");
          setPhase("intro");
        });
    });
  }, [phase, duel.id, router]);

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
    return "";
  }, [duel.scenario, keyIndex, memoryIndex, targetIndex]);

  function startGame() {
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
    fetch(`/api/duels/${duel.id}/enter-arcade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch((error) => {
      console.error("Error registering arcade participation:", error);
    });

    if (duel.scenario.kind === "memory") {
      setMemoryPreview(true);
      previewTimeoutRef.current = window.setTimeout(() => {
        setMemoryPreview(false);
      }, 3000);
    }
  }

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
    if (phase === "submitted") {
      return;
    }

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
            router.refresh();
          }
        })
        .catch(() => {
          // no-op: el polling es best-effort
        });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [duel.id, phase, router]);

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
                {playerRole === "attacker"
                  ? "Ataques: Completa el juego para avanzar tu pieza."
                  : "Defensa: Gana este juego para bloquear el ataque."}
              </p>
              <p>{duel.game.antiCheat}</p>
            </div>
            <button
              onClick={startGame}
              disabled={isPending}
              className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 py-3 font-bold text-slate-950 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
            >
              Comenzar
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
                  {memoryPreview ? `Memoriza: ${(duel.scenario as { sequence: string[] }).sequence.join(" • ")}` : "Repite la secuencia tocando la cuadrícula."}
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
                  Presiona las teclas en orden: <span className="font-bold text-cyan-300">{(duel.scenario as { sequence: string[] }).sequence.slice(keyIndex, keyIndex + 3).join(" → ")}</span>
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

            {message ? <p className="mt-4 text-sm text-rose-300">{message}</p> : null}
          </div>
        )}

        {phase === "submitted" && (
          <div className="space-y-4 text-center">
            <p className="text-lg font-semibold text-slate-300">Esperando al rival...</p>
            {message ? <p className="text-sm text-slate-400">{message}</p> : null}
          </div>
        )}

        {isPending ? <p className="mt-4 text-sm text-slate-400">Validando intento y resolviendo tablero...</p> : null}
      </div>
    </div>
  );
}
