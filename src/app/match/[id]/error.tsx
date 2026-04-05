'use client';

export default function MatchError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/20 bg-rose-400/10">
        <span className="text-2xl">⚠</span>
      </div>
      <h2 className="text-xl font-semibold text-white">Algo salió mal</h2>
      <p className="text-sm text-slate-300">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="button-primary px-6 py-2.5 text-sm"
      >
        Reintentar
      </button>
    </div>
  );
}
