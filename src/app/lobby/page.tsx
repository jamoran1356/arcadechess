import Link from "next/link";
import { ArcadeGameType, TransactionNetwork } from "@prisma/client";
import { createMatchAction, joinMatchAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { arcadeLibrary } from "@/lib/arcade";
import { getLobbySnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  const session = await requireUser();
  const { me, matches } = await getLobbySnapshot(session.id);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">Publicar partida</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Crea una mesa con apuesta y biblioteca arcade.</h1>
          <form action={createMatchAction} className="mt-8 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input type="radio" name="isSolo" value="false" defaultChecked />
                Partida versus (publica)
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input type="radio" name="isSolo" value="true" />
                Partida individual (solo)
              </label>
            </div>
            <input name="title" className="input" placeholder="Nombre de la partida" required />
            <textarea name="theme" className="input min-h-28" placeholder="Describe la tematica visual y narrativa del match" required />
            <div className="grid gap-4 sm:grid-cols-3">
              <input name="stakeAmount" type="number" min="0" step="0.01" className="input" placeholder="Stake" required />
              <input name="stakeToken" className="input" defaultValue="INIT" />
              <select name="network" className="input" defaultValue={TransactionNetwork.INITIA}>
                {Object.values(TransactionNetwork).map((network) => (
                  <option key={network} value={network}>
                    {network}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Biblioteca arcade</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {arcadeLibrary.map((game) => (
                  <label key={game.id} className="rounded-[1.25rem] border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-200">
                    <input type="checkbox" name="arcadeGamePool" value={game.id as ArcadeGameType} defaultChecked={game.id !== ArcadeGameType.KEY_CLASH} className="mr-2" />
                    {game.name}
                    <p className="mt-2 text-xs leading-6 text-slate-400">{game.blurb}</p>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="button-primary mt-2 px-6 py-3 text-sm">
              Crear mesa con escrow
            </button>
          </form>
        </div>

        <div className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">Jugador conectado</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{me?.name}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Puedes crear mesas publicas o entrar como rival. Si una casilla ocupada es atacada, ambos jugadores reciben el mismo minijuego y el servidor valida el resultado.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/arcade-test" className="button-secondary px-4 py-2 text-white">
              Probar arcade
            </Link>
            {session.role === "ADMIN" ? (
              <Link href="/admin" className="button-secondary px-4 py-2 text-white">
                Ir a admin
              </Link>
            ) : null}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {me?.wallets.map((wallet) => (
              <article key={wallet.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{wallet.network}</p>
                <p className="mt-2 text-xl font-semibold text-white">{wallet.balance}</p>
                <p className="mt-2 text-xs text-slate-400 break-all">{wallet.address}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <p className="eyebrow">Lobby activo</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Partidas disponibles</h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <article key={match.id} className="panel rounded-[1.75rem] p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-cyan-200">
                  {match.network}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {match.status.replaceAll("_", " ")}
                </span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-white">{match.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{match.theme}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                {match.arcadeGamePool.map((game) => (
                  <span key={game} className="rounded-full bg-white/6 px-3 py-1">
                    {game.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
              <div className="mt-6 text-sm text-slate-300">
                Host: <span className="text-white">{match.host}</span>
                <br />
                Rival: <span className="text-white">{match.guest ?? "Disponible"}</span>
                <br />
                Modalidad: <span className="text-white">{match.isSolo ? "Solo" : "Versus"}</span>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href={`/match/${match.id}`} className="button-secondary px-4 py-2 text-sm text-white">
                  Ver mesa
                </Link>
                {match.status === "OPEN" && !match.isSolo && match.host !== session.name ? (
                  <form action={joinMatchAction}>
                    <input type="hidden" name="matchId" value={match.id} />
                    <button type="submit" className="button-primary px-4 py-2 text-sm">
                      Unirme
                    </button>
                  </form>
                ) : null}
                {match.hasPendingDuel ? <span className="text-xs text-amber-200">Captura en duelo</span> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
