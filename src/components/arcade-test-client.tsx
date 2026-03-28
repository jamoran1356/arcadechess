'use client';

import { useMemo, useState } from "react";
import { ArcadeGameType } from "@prisma/client";
import { buildArcadeScenario } from "@/lib/arcade";

type AttemptAction = { at: number; value: string };

export function ArcadeTestClient() {
  const [gameType, setGameType] = useState<ArcadeGameType>(ArcadeGameType.TARGET_RUSH);
  const [seed, setSeed] = useState("arcade-test-seed");
  const [actionsRaw, setActionsRaw] = useState("120:1\n300:2\n520:3");
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(13000);
  const [result, setResult] = useState<{ valid: boolean; score: number; reason: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const scenario = useMemo(() => buildArcadeScenario(gameType, seed), [gameType, seed]);

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

  async function submitAttempt() {
    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/arcade/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType,
          seed,
          attempt: {
            startedAt,
            finishedAt,
            actions: parseActions(actionsRaw),
          },
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
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Error desconocido.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
      <section className="panel rounded-[2rem] p-6 lg:p-8">
        <p className="eyebrow">Configurar prueba</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-300">
            Minijuego
            <select value={gameType} onChange={(event) => setGameType(event.target.value as ArcadeGameType)} className="input">
              {Object.values(ArcadeGameType).map((value) => (
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
        </div>

        <button type="button" onClick={submitAttempt} disabled={pending} className="button-primary mt-4 px-5 py-3 text-sm disabled:opacity-60">
          {pending ? "Evaluando..." : "Probar arcade"}
        </button>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
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
        <pre className="mt-4 overflow-auto rounded-xl border border-white/10 bg-slate-950/85 p-4 text-xs text-slate-200">
          {JSON.stringify(scenario, null, 2)}
        </pre>
      </section>
    </div>
  );
}
