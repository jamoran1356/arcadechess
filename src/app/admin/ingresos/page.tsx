import { getAdminRevenueSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminIngresosPage() {
  const revenue = await getAdminRevenueSnapshot();

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="panel rounded-[1.75rem] p-6">
          <p className="eyebrow">Settled</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-200">{revenue.settled.amount}</p>
          <p className="mt-2 text-xs text-slate-400">{revenue.settled.count} transacciones</p>
        </article>
        <article className="panel rounded-[1.75rem] p-6">
          <p className="eyebrow">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-amber-200">{revenue.pending.amount}</p>
          <p className="mt-2 text-xs text-slate-400">{revenue.pending.count} transacciones</p>
        </article>
        <article className="panel rounded-[1.75rem] p-6">
          <p className="eyebrow">Failed</p>
          <p className="mt-3 text-3xl font-semibold text-rose-200">{revenue.failed.amount}</p>
          <p className="mt-2 text-xs text-slate-400">{revenue.failed.count} transacciones</p>
        </article>
      </section>

      <section className="panel rounded-[2rem] p-6 lg:p-8">
        <p className="eyebrow">Desglose por red</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {revenue.byNetwork.map((item) => (
            <article key={item.network} className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{item.network}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{item.amount}</p>
              <p className="mt-1 text-xs text-slate-400">{item.count} operaciones</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
