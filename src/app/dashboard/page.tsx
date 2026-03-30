import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireUser();
  const user = await getDashboardSnapshot(session.id);

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
        <section className="panel rounded-[2rem] p-8 text-center">
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">No pudimos cargar tu perfil</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Tu sesión existe pero no encontramos los datos del usuario en base de datos. Vuelve a iniciar sesión o crea una cuenta nueva.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/login" className="button-primary px-6 py-3 text-center">Iniciar sesión</Link>
            <Link href="/register" className="button-secondary px-6 py-3 text-center text-slate-100">Crear cuenta</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">Perfil</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">{user.name}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">{user.email}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {user.wallets.length > 0 ? (
              user.wallets.map((wallet) => (
                <article key={wallet.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{wallet.network}</p>
                  <p className="mt-2 text-xl font-semibold text-white">{wallet.balance}</p>
                  <p className="mt-2 break-all text-xs text-slate-400">{wallet.address}</p>
                </article>
              ))
            ) : (
              <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 sm:col-span-3">
                <p className="text-sm text-slate-300">Aún no tienes wallets registradas. Crea una partida o entra al lobby para inicializar tus billeteras demo.</p>
              </article>
            )}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">Resumen</p>
          <div className="mt-5 grid gap-4">
            <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Rating</p>
              <p className="mt-2 text-4xl font-semibold text-amber-200">{user.rating}</p>
            </article>
            <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Transacciones</p>
              <p className="mt-2 text-4xl font-semibold text-white">{user.transactions.length}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Tus mesas</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Partidas creadas</h2>
            </div>
            <Link href="/lobby" className="text-sm text-cyan-200 hover:text-cyan-100">
              Crear otra
            </Link>
          </div>
          <div className="mt-6 grid gap-4">
            {user.hostedMatches.length > 0 ? (
              user.hostedMatches.map((match) => (
                <Link key={match.id} href={`/match/${match.id}`} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:border-white/20">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-white">{match.title}</h3>
                    <span className="text-xs text-slate-400">{match.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{match.theme}</p>
                </Link>
              ))
            ) : (
              <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-300">Todavía no has creado partidas. Ve al lobby y lanza tu primera mesa con stake.</p>
              </article>
            )}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6">
          <p className="eyebrow">Actividad financiera</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Ledger reciente</h2>
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Red</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {user.transactions.length > 0 ? (
                  user.transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-white/10">
                      <td className="px-4 py-3">{transaction.type.replaceAll("_", " ")}</td>
                      <td className="px-4 py-3">{transaction.amount.toString()}</td>
                      <td className="px-4 py-3">{transaction.network}</td>
                      <td className="px-4 py-3">{transaction.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/10">
                    <td className="px-4 py-6 text-slate-400" colSpan={4}>No hay transacciones todavía. Cuando crees o entres en partidas aparecerán aquí.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
