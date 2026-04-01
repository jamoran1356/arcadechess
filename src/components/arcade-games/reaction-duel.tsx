'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ReactionScenario = {
  kind: 'reaction';
  rounds: number;
  delays: number[];  // ms before signal per round (seeded)
};

type Props = {
  scenario: ReactionScenario;
  onAction: (value: string) => void;
  onComplete: () => void;
  disabled?: boolean;
};

type RoundState = 'waiting' | 'ready' | 'go' | 'result' | 'early';

export function ReactionDuelGame({ scenario, onAction, onComplete, disabled }: Props) {
  const [round, setRound] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>('waiting');
  const [times, setTimes] = useState<number[]>([]);
  const goTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const startRound = useCallback(() => {
    if (disabled || completedRef.current) return;
    setRoundState('ready');
    const delay = scenario.delays[round] ?? 2000;

    timerRef.current = setTimeout(() => {
      goTimeRef.current = performance.now();
      setRoundState('go');
    }, delay);
  }, [disabled, round, scenario.delays]);

  useEffect(() => {
    if (round < scenario.rounds && roundState === 'waiting') {
      const t = setTimeout(() => startRound(), 800);
      return () => clearTimeout(t);
    }
  }, [round, roundState, scenario.rounds, startRound]);

  const handleClick = useCallback(() => {
    if (disabled || completedRef.current) return;

    if (roundState === 'ready') {
      // Too early!
      if (timerRef.current) clearTimeout(timerRef.current);
      onAction(`early:${round}`);
      setRoundState('early');
      setTimes((prev) => [...prev, 9999]);
      setTimeout(() => {
        const nextRound = round + 1;
        setRound(nextRound);
        setRoundState('waiting');
        if (nextRound >= scenario.rounds && !completedRef.current) {
          completedRef.current = true;
          setTimeout(() => onComplete(), 100);
        }
      }, 1000);
      return;
    }

    if (roundState === 'go') {
      const reaction = Math.round(performance.now() - goTimeRef.current);
      onAction(`react:${reaction}`);
      setTimes((prev) => [...prev, reaction]);
      setRoundState('result');
      setTimeout(() => {
        const nextRound = round + 1;
        setRound(nextRound);
        setRoundState('waiting');
        if (nextRound >= scenario.rounds && !completedRef.current) {
          completedRef.current = true;
          setTimeout(() => onComplete(), 100);
        }
      }, 1200);
    }
  }, [disabled, onAction, onComplete, round, roundState, scenario.rounds]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClick]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const avgTime = times.length > 0
    ? Math.round(times.filter((t) => t < 9999).reduce((a, b) => a + b, 0) / Math.max(1, times.filter((t) => t < 9999).length))
    : 0;

  const bgColor =
    roundState === 'go'
      ? 'bg-emerald-500/20 border-emerald-400/50'
      : roundState === 'ready'
        ? 'bg-rose-500/10 border-rose-400/30'
        : roundState === 'early'
          ? 'bg-rose-500/20 border-rose-400/50'
          : 'bg-white/5 border-white/10';

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || roundState === 'waiting' || roundState === 'result'}
        className={`w-full rounded-[1.5rem] border-2 p-12 text-center transition ${bgColor}`}
      >
        {roundState === 'waiting' && (
          <p className="text-lg text-slate-400">Ronda {round + 1}/{scenario.rounds} — Prepárate...</p>
        )}
        {roundState === 'ready' && (
          <p className="text-xl font-bold text-rose-300">Espera la señal...</p>
        )}
        {roundState === 'go' && (
          <p className="text-3xl font-black text-emerald-300">¡AHORA!</p>
        )}
        {roundState === 'result' && (
          <p className="text-xl font-bold text-cyan-300">{times[times.length - 1]} ms</p>
        )}
        {roundState === 'early' && (
          <p className="text-xl font-bold text-rose-400">¡Muy pronto! +9999ms penalización</p>
        )}
      </button>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Ronda {Math.min(round + 1, scenario.rounds)}/{scenario.rounds}</span>
        <span className="text-slate-300">Promedio: <span className="font-semibold text-amber-300">{avgTime}ms</span></span>
      </div>

      {times.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {times.map((t, i) => (
            <span
              key={`r${i}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                t >= 9999 ? 'bg-rose-400/20 text-rose-300' : t < 300 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-slate-300'
              }`}
            >
              R{i + 1}: {t >= 9999 ? 'EARLY' : `${t}ms`}
            </span>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-slate-500">Haz clic o presiona Espacio cuando veas la señal verde</p>
    </div>
  );
}
