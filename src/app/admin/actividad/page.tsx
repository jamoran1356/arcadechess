import { getAdminActivitySnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminActividadPage() {
  const activity = await getAdminActivitySnapshot();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="panel rounded-[2rem] p-6">
        <p className="eyebrow">Partidas recientes</p>
        <div className="mt-4 grid gap-3">
          {activity.recentMatches.map((match) => (
            <article key={match.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <p className="font-medium text-white">{match.title}</p>
              <p className="mt-1 text-xs text-slate-400">{match.host.name} vs {match.guest?.name ?? "Pendiente"}</p>
              <p className="mt-1 text-xs text-slate-400">{match.status}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel rounded-[2rem] p-6">
        <p className="eyebrow">Duelos arcade</p>
        <div className="mt-4 grid gap-3">
          {activity.recentDuels.map((duel) => (
            <article key={duel.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <p className="font-medium text-white">{duel.gameType.replaceAll("_", " ")}</p>
              <p className="mt-1 text-xs text-slate-400">{duel.attacker.name} vs {duel.defender.name}</p>
              <p className="mt-1 text-xs text-slate-400">Ganador: {duel.winner?.name ?? "Pendiente"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel rounded-[2rem] p-6">
        <p className="eyebrow">Transacciones recientes</p>
        <div className="mt-4 grid gap-3">
          {activity.recentTransactions.map((transaction) => (
            <article key={transaction.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <p className="font-medium text-white">{transaction.user.name}</p>
              <p className="mt-1 text-xs text-slate-400">{transaction.type.replaceAll("_", " ")} - {transaction.network}</p>
              <p className="mt-1 text-xs text-slate-400">{transaction.amount.toString()} {transaction.token} / {transaction.status}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
