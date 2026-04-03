import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { arcadeLibrary } from "@/lib/arcade";

export default async function MinigamesPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.minigames;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">{t.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">{t.subtitle}</p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {arcadeLibrary.map((game) => (
          <article
            key={game.id}
            className="card-glow panel rounded-[2rem] p-6 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-lg">
                {gameIcon(game.slug)}
              </span>
              <h2 className="text-lg font-bold text-white">{game.name}</h2>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-300">{game.blurb}</p>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                <dt className="font-mono uppercase tracking-[0.18em] text-slate-500">{t.timeLabel}</dt>
                <dd className="mt-1 font-semibold text-slate-200">{(game.timeLimitMs / 1000).toFixed(0)}s</dd>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                <dt className="font-mono uppercase tracking-[0.18em] text-slate-500">{t.typeLabel}</dt>
                <dd className="mt-1 font-semibold text-slate-200">{gameCategory(game.slug)}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl border border-cyan-400/10 bg-cyan-400/5 px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">{t.antiCheatLabel}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{game.antiCheat}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="panel rounded-[2rem] p-6 lg:p-8">
        <h2 className="text-2xl font-bold text-white">{t.howTitle}</h2>
        <div className="mt-5 grid gap-4 text-sm text-slate-300 lg:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="font-semibold text-amber-300">1.</p>
            <p className="mt-1">{t.howStep1}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="font-semibold text-amber-300">2.</p>
            <p className="mt-1">{t.howStep2}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="font-semibold text-amber-300">3.</p>
            <p className="mt-1">{t.howStep3}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function gameIcon(slug: string) {
  switch (slug) {
    case "target-rush": return "🎯";
    case "memory-grid": return "🧠";
    case "key-clash": return "⌨️";
    case "maze-runner": return "🏁";
    case "ping-pong": return "🏓";
    case "reaction-duel": return "⚡";
    default: return "🎮";
  }
}

function gameCategory(slug: string) {
  switch (slug) {
    case "target-rush": return "Precisión";
    case "memory-grid": return "Memoria";
    case "key-clash": return "Velocidad";
    case "maze-runner": return "Navegación";
    case "ping-pong": return "Multijugador";
    case "reaction-duel": return "Reflejos";
    default: return "Arcade";
  }
}
