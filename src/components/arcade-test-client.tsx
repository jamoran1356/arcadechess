'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { buildArcadeScenario, getArcadeDefinition } from "@/lib/arcade";

type AttemptAction = { at: number; value: string };
type PlayPhase = "idle" | "preview" | "running" | "submitted";
type ArcadeGameType = Parameters<typeof buildArcadeScenario>[0];

const GAME_TYPES: ArcadeGameType[] = ["TARGET_RUSH", "MEMORY_GRID", "KEY_CLASH"];
const KEY_POOL = ["A", "S", "D", "J", "K", "L"];

function Sprite({ id, className }: { id: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className={className}>
      <use href={`/arcade-sprites.svg#${id}`} />
    </svg>
  );
}

export function ArcadeTestClient() {
  const [gameType, setGameType] = useState<ArcadeGameType>("TARGET_RUSH");
  const [seed, setSeed] = useState("arcade-test-seed");
  const [actionsRaw, setActionsRaw] = useState("120:1\n300:2\n520:3");
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(13000);
  const [result, setResult] = useState<{ valid: boolean; score: number; reason: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [playPhase, setPlayPhase] = useState<PlayPhase>("idle");
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [keyIndex, setKeyIndex] = useState(0);
  const [hudMessage, setHudMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"arcade" | "technical">("arcade");
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);

  const scenario = useMemo(() => buildArcadeScenario(gameType, seed), [gameType, seed]);
  const definition = useMemo(() => getArcadeDefinition(gameType), [gameType]);

  const startedAtRef = useRef<number | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const autoSubmitRef = useRef<number | null>(null);
  const actionsRef = useRef<AttemptAction[]>([]);

  useEffect(() => {
    setPlayPhase("idle");
    setTargetIndex(0);
    setMemoryIndex(0);
    setKeyIndex(0);
    setHudMessage(null);
    setTimeLeftMs(definition.timeLimitMs);
    setCombo(0);
    setBestCombo(0);
    actionsRef.current = [];
  }, [definition.timeLimitMs, gameType, seed]);

  useEffect(() => {
    if (playPhase !== "running" || startedAtRef.current === null) {
      return;
    }

    const interval = window.setInterval(() => {
      if (startedAtRef.current === null) {
        return;
      }
      const elapsed = performance.now() - startedAtRef.current;
      const remaining = Math.max(0, definition.timeLimitMs - elapsed);
      setTimeLeftMs(remaining);
      if (remaining === 0) {
        window.clearInterval(interval);
        void submitArcadeAttempt({
          startedAt: startedAtRef.current,
          finishedAt: performance.now(),
          actions: actionsRef.current,
        });
      }
    }, 80);

    return () => window.clearInterval(interval);
  }, [definition.timeLimitMs, playPhase]);

  useEffect(() => {
    if (playPhase !== "running" || scenario.kind !== "keys") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const expected = scenario.sequence[keyIndex];
      const pressed = event.key.toUpperCase();
      if (!expected || startedAtRef.current === null) {
        return;
      }

      if (pressed !== expected) {
        if (KEY_POOL.includes(pressed)) {
          setHudMessage(`Tecla incorrecta: ${pressed}. Esperada: ${expected}.`);
          setCombo(0);
        }
        return;
      }

      actionsRef.current = [
        ...actionsRef.current,
        { at: Math.max(0, Math.round(performance.now() - startedAtRef.current)), value: expected },
      ];
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setBestCombo((prev) => Math.max(prev, nextCombo));
      setHudMessage(nextCombo >= 4 ? `Combo x${nextCombo}` : null);
      const nextIndex = keyIndex + 1;
      setKeyIndex(nextIndex);

      if (nextIndex === scenario.sequence.length) {
        void submitArcadeAttempt({
          startedAt: startedAtRef.current,
          finishedAt: performance.now(),
          actions: actionsRef.current,
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, keyIndex, playPhase, scenario]);

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        window.clearTimeout(previewTimeoutRef.current);
      }
      if (autoSubmitRef.current) {
        window.clearTimeout(autoSubmitRef.current);
      }
    };
  }, []);

  function parseActions(raw: string): AttemptAction[] {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [atRaw, valueRaw] = line.split(":");
        return {
          at: Number(atRaw ?? "0"),
          value: String(valueRaw ?? "").trim(),
        };
      })
      .filter((action) => Number.isFinite(action.at) && action.value.length > 0);
  }

  async function submitArcadeAttempt(attempt: { startedAt: number; finishedAt: number; actions: AttemptAction[] }) {
    setPending(true);
    setError(null);
    setResult(null);
    setPlayPhase("submitted");

    try {
      const response = await fetch("/api/arcade/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType,
          seed,
          attempt,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo evaluar el intento.");
      }

      setResult({
        valid: Boolean(data.valid),
        score: Number(data.score ?? 0),
        reason: data.reason ?? null,
      });
      setHudMessage(Boolean(data.valid) ? "Intento valido. Buen ritmo." : "Intento invalido. Revisa el orden.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Error desconocido.");
      setPlayPhase("idle");
    } finally {
      setPending(false);
    }
  }

  async function submitTechnicalAttempt() {
    await submitArcadeAttempt({
      startedAt,
      finishedAt,
      actions: parseActions(actionsRaw),
    });
  }

  function beginArcadeRun() {
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
    }

    if (autoSubmitRef.current) {
      window.clearTimeout(autoSubmitRef.current);
    }

    actionsRef.current = [];
    startedAtRef.current = performance.now();
    setResult(null);
    setError(null);
    setHudMessage(null);
    setTargetIndex(0);
    setMemoryIndex(0);
    setKeyIndex(0);
    setCombo(0);
    setTimeLeftMs(definition.timeLimitMs);

    if (scenario.kind === "memory") {
      setPlayPhase("preview");
      previewTimeoutRef.current = window.setTimeout(() => {
        setPlayPhase("running");
      }, 2200);
      return;
    }

    setPlayPhase("running");
  }

  function hitTarget(targetId: string) {
    if (scenario.kind !== "targets" || playPhase !== "running" || startedAtRef.current === null) {
      return;
    }

    const expected = scenario.targets[targetIndex]?.id;
    if (targetId !== expected) {
      setHudMessage("Ese no era. Sigue el orden numerico.");
      setCombo(0);
      return;
    }

    actionsRef.current = [
      ...actionsRef.current,
      { at: Math.max(0, Math.round(performance.now() - startedAtRef.current)), value: targetId },
    ];

    const nextIndex = targetIndex + 1;
    setTargetIndex(nextIndex);
    const nextCombo = combo + 1;
    setCombo(nextCombo);
    setBestCombo((prev) => Math.max(prev, nextCombo));
    setHudMessage(nextCombo >= 3 ? `Combo x${nextCombo}` : null);

    if (nextIndex === scenario.targets.length) {
      void submitArcadeAttempt({
        startedAt: startedAtRef.current,
        finishedAt: performance.now(),
        actions: actionsRef.current,
      });
    }
  }

  function hitMemory(cell: string) {
    if (scenario.kind !== "memory" || playPhase !== "running" || startedAtRef.current === null) {
      return;
    }

    actionsRef.current = [
      ...actionsRef.current,
      { at: Math.max(0, Math.round(performance.now() - startedAtRef.current)), value: cell },
    ];

    const expected = scenario.sequence[memoryIndex];
    const nextIndex = memoryIndex + 1;
    setMemoryIndex(nextIndex);

    if (cell !== expected) {
      setHudMessage(`Fallaste: esperabas ${expected}.`);
      setCombo(0);
    } else {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setBestCombo((prev) => Math.max(prev, nextCombo));
      setHudMessage(nextCombo >= 3 ? `Combo x${nextCombo}` : null);
    }

    if (nextIndex === scenario.sequence.length) {
      void submitArcadeAttempt({
        startedAt: startedAtRef.current,
        finishedAt: performance.now(),
        actions: actionsRef.current,
      });
    }
  }

  const progress =
    scenario.kind === "targets"
      ? `${targetIndex}/${scenario.targets.length}`
      : scenario.kind === "memory"
        ? `${memoryIndex}/${scenario.sequence.length}`
        : `${keyIndex}/${scenario.sequence.length}`;
        const liveScore = combo * 120 + (scenario.kind === "targets" ? targetIndex * 80 : scenario.kind === "memory" ? memoryIndex * 100 : keyIndex * 70);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
      <section className="panel rounded-[2rem] p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Arcade Lab</p>
          <div className="inline-flex rounded-xl border border-white/10 bg-slate-900/70 p-1 text-xs text-slate-300">
            <button
              type="button"
              onClick={() => setMode("arcade")}
              className={`rounded-lg px-3 py-2 transition ${
                mode === "arcade" ? "bg-cyan-300/20 text-cyan-200" : "hover:bg-white/10"
              }`}
            >
              Jugar
            </button>
            <button
              type="button"
              onClick={() => setMode("technical")}
              className={`rounded-lg px-3 py-2 transition ${
                mode === "technical" ? "bg-cyan-300/20 text-cyan-200" : "hover:bg-white/10"
              }`}
            >
              Modo tecnico
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-300">
            Minijuego
            <select value={gameType} onChange={(event) => setGameType(event.target.value as ArcadeGameType)} className="input">
              {GAME_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Seed
            <input value={seed} onChange={(event) => setSeed(event.target.value)} className="input" />
          </label>
        </div>

        {mode === "arcade" ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-slate-400">Modo</p>
                <p className="font-semibold text-white">{definition.name}</p>
              </div>
              <div>
                <p className="text-slate-400">Progreso</p>
                <p className="font-semibold text-cyan-200">{progress}</p>
              </div>
              <div>
                <p className="text-slate-400">Tiempo</p>
                <p className="font-semibold text-amber-200">{Math.ceil(timeLeftMs / 1000)}s</p>
              </div>
              <div>
                <p className="text-slate-400">Combo</p>
                <p className="font-semibold text-fuchsia-200">x{bestCombo}</p>
              </div>
              <div>
                <p className="text-slate-400">Score run</p>
                <p className="font-semibold text-emerald-200">{liveScore}</p>
              </div>
            </div>

            {(playPhase === "idle" || playPhase === "submitted") && (
              <button type="button" onClick={beginArcadeRun} disabled={pending} className="button-primary px-5 py-3 text-sm">
                {pending ? "Evaluando..." : "Iniciar run arcade"}
              </button>
            )}

            {scenario.kind === "targets" ? (
              <div className="relative h-[340px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_40%_20%,rgba(34,211,238,0.22),transparent_45%),linear-gradient(160deg,#061426,#071327)]">
                <div className="arcade-grid-overlay" />
                {scenario.targets.map((target, index) => {
                  const done = index < targetIndex;
                  const active = index === targetIndex;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => hitTarget(target.id)}
                      disabled={playPhase !== "running" || done}
                      className={`absolute arcade-target-button flex items-center justify-center rounded-full border text-sm font-bold transition ${
                        done
                          ? "border-emerald-300/35 bg-emerald-300/25 text-emerald-100"
                          : active
                            ? "border-amber-300/70 bg-amber-300/25 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.35)]"
                            : "border-white/15 bg-white/5 text-slate-300"
                      }`}
                      style={{
                        left: `${target.x}%`,
                        top: `${target.y}%`,
                        width: `${target.size * 4}px`,
                        height: `${target.size * 4}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <Sprite id={done ? "target-done" : active ? "target-live" : "target-idle"} className="arcade-sprite h-8 w-8" />
                      <span className="arcade-target-id">{target.id}</span>
                    </button>
                  );
                })}
                <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-cyan-200">
                  <Sprite id="reticle" className="arcade-sprite h-5 w-5" />
                  Pilot
                </div>
              </div>
            ) : null}

            {scenario.kind === "memory" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  {playPhase === "preview"
                    ? `Memoriza: ${scenario.sequence.join(" • ")}`
                    : "Repite la secuencia tocando las celdas."}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"].map((cell) => {
                    const isExpected = playPhase === "running" && scenario.sequence[memoryIndex] === cell;
                    return (
                      <button
                        key={cell}
                        type="button"
                        onClick={() => hitMemory(cell)}
                        disabled={playPhase !== "running"}
                        className={`aspect-square rounded-[1rem] border text-lg font-semibold transition ${
                          isExpected
                            ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                            : "border-white/10 bg-slate-900 text-white hover:border-cyan-300/45 hover:bg-cyan-300/10"
                        }`}
                      >
                        <span className="mb-2 inline-flex justify-center">
                          <Sprite id={isExpected ? "memory-live" : "memory-idle"} className="arcade-sprite h-8 w-8" />
                        </span>
                        <span className="block text-sm">{cell}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {scenario.kind === "keys" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  Escribe en orden: <span className="font-bold text-cyan-200">{scenario.sequence.slice(keyIndex, keyIndex + 5).join(" → ")}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {KEY_POOL.map((key) => (
                    <div
                      key={key}
                      className={`rounded-lg border py-3 text-center text-xl font-bold ${
                        scenario.sequence[keyIndex] === key
                          ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-100"
                          : "border-white/15 bg-slate-900 text-slate-400"
                      }`}
                    >
                      <div className="mb-1 flex justify-center">
                        <Sprite id={scenario.sequence[keyIndex] === key ? "key-live" : "key-idle"} className="arcade-sprite h-6 w-6" />
                      </div>
                      {key}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              startedAt
              <input type="number" value={startedAt} onChange={(event) => setStartedAt(Number(event.target.value))} className="input" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              finishedAt
              <input type="number" value={finishedAt} onChange={(event) => setFinishedAt(Number(event.target.value))} className="input" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300 sm:col-span-2">
              Actions (at:value por linea)
              <textarea value={actionsRaw} onChange={(event) => setActionsRaw(event.target.value)} className="input min-h-32" />
            </label>
            <button type="button" onClick={submitTechnicalAttempt} disabled={pending} className="button-primary mt-2 px-5 py-3 text-sm disabled:opacity-60 sm:col-span-2">
              {pending ? "Evaluando..." : "Probar intento tecnico"}
            </button>
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {hudMessage ? <p className="mt-4 text-sm text-cyan-200">{hudMessage}</p> : null}
        {result ? (
          <article className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <p>Valido: <span className="font-semibold text-white">{result.valid ? "Si" : "No"}</span></p>
            <p className="mt-1">Score: <span className="font-semibold text-amber-200">{result.score}</span></p>
            {result.reason ? <p className="mt-1 text-slate-300">Motivo: {result.reason}</p> : null}
          </article>
        ) : null}
      </section>

      <section className="panel rounded-[2rem] p-6 lg:p-8">
        <p className="eyebrow">Escenario generado</p>
        <p className="mt-3 text-sm text-slate-400">{definition.blurb}</p>
        <pre className="mt-4 overflow-auto rounded-xl border border-white/10 bg-slate-950/85 p-4 text-xs text-slate-200">
          {JSON.stringify(scenario, null, 2)}
        </pre>
      </section>
    </div>
  );
}
