import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getLandingSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  const { stats, openMatches, networks, arcadeLibrary } = await getLandingSnapshot();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div className="animate-rise space-y-8">
          <div className="space-y-4">
            <p className="eyebrow">Initia x Flow x Solana</p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
              Ajedrez competitivo donde cada captura se gana en una arena arcade.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Publica partidas con stake, entra al lobby en vivo y resuelve cada ataque en minijuegos sincronizados y anti trampas.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={session ? "/lobby" : "/register"} className="button-primary px-6 py-3 text-center">
              {session ? "Entrar al lobby" : "Comenzar ahora"}
            </Link>
            <Link href="/dashboard" className="button-secondary px-6 py-3 text-center text-slate-100">
              Ver dashboard
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel rounded-3xl p-5">
              <p className="eyebrow">Usuarios</p>
              <p className="stat-value mt-3">{stats.usersCount}</p>
            </div>
            <div className="panel rounded-3xl p-5">
              <p className="eyebrow">Transacciones</p>
              <p className="stat-value mt-3">{stats.transactionsCount}</p>
            </div>
            <div className="panel rounded-3xl p-5">
              <p className="eyebrow">Partidas vivas</p>
              <p className="stat-value mt-3">{stats.availableMatches}</p>
            </div>
          </div>
        </div>

        <div className="panel animate-rise rounded-[2rem] p-6 lg:p-8">
          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(253,230,138,0.16),rgba(103,232,249,0.08))] p-5">
              <p className="eyebrow">Sistema de captura</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">La pieza no conquista sola.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                Si una pieza entra a una casilla ocupada, se congela el tablero y se abre una batalla arcade. Solo si el atacante gana, la captura se aplica en el FEN.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {arcadeLibrary.map((game) => (
                <article key={game.id} className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{game.name}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{game.blurb}</p>
                  <p className="mt-4 text-xs text-slate-400">{game.antiCheat}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Landing en vivo</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Partidas disponibles y tematica del juego</h2>
          </div>
          <Link href="/lobby" className="text-sm text-cyan-200 hover:text-cyan-100">
            Abrir lobby completo
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {openMatches.map((match) => (
            <article key={match.id} className="panel rounded-[1.75rem] p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-cyan-200">
                  {match.network}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {match.status.replaceAll("_", " ")}
                </span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-white">{match.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{match.theme}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                {match.arcadeGamePool.map((game) => (
                  <span key={game} className="rounded-full bg-white/6 px-3 py-1">
                    {game.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Stake</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-200">
                    {match.stakeAmount} {match.stakeToken}
                  </p>
                </div>
                <Link href={`/match/${match.id}`} className="button-secondary px-4 py-2 text-sm text-white">
                  Ver mesa
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {networks.map((network) => (
          <article key={network.id} className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow">Red de pagos</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">{network.name}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{network.summary}</p>
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              {network.status}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

