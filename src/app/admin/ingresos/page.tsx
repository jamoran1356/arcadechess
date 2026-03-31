import { upsertPlatformConfigAction } from "@/lib/actions";
import { getAdminRevenueSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminIngresosPage() {
  const revenue = await getAdminRevenueSnapshot();

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="panel rounded-[1.75rem] border-emerald-400/20 bg-emerald-400/10 p-6">
          <p className="eyebrow">Settled</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-200">{revenue.settled.amount}</p>
          <p className="mt-2 text-xs text-slate-400">{revenue.settled.count} transacciones</p>
        </article>
        <article className="panel rounded-[1.75rem] border-amber-400/20 bg-amber-400/10 p-6">
          <p className="eyebrow">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-amber-200">{revenue.pending.amount}</p>
          <p className="mt-2 text-xs text-slate-400">{revenue.pending.count} transacciones</p>
        </article>
        <article className="panel rounded-[1.75rem] border-rose-400/20 bg-rose-400/10 p-6">
          <p className="eyebrow">Failed</p>
          <p className="mt-3 text-3xl font-semibold text-rose-200">{revenue.failed.amount}</p>
          <p className="mt-2 text-xs text-slate-400">{revenue.failed.count} transacciones</p>
        </article>
        <article className="panel rounded-[1.75rem] border-cyan-400/20 bg-cyan-400/10 p-6">
          <p className="eyebrow">Match fees</p>
          <p className="mt-3 text-3xl font-semibold text-cyan-100">{revenue.feeCapture.matchFees}</p>
          <p className="mt-2 text-xs text-slate-400">captured from entry fees</p>
        </article>
        <article className="panel rounded-[1.75rem] border-fuchsia-400/20 bg-fuchsia-400/10 p-6">
          <p className="eyebrow">Bet fees</p>
          <p className="mt-3 text-3xl font-semibold text-fuchsia-100">{revenue.feeCapture.betFees}</p>
          <p className="mt-2 text-xs text-slate-400">captured from winning bet settlements</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">Economic policy</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Admin-editable fees</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Aquí defines la captura de valor de la plataforma. El fee de entrada se aplica como mínimo por jugador al crear la partida y el fee de apuestas se descuenta sobre las ganancias distribuidas a los ganadores.
          </p>

          <form action={upsertPlatformConfigAction} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              <span>Match fee (bps)</span>
              <input name="matchFeeBps" type="number" min="0" max="10000" defaultValue={revenue.config.matchFeeBps} className="input" required />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              <span>Bet fee (bps)</span>
              <input name="betFeeBps" type="number" min="0" max="10000" defaultValue={revenue.config.betFeeBps} className="input" required />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              <span>Arcade fee fixed</span>
              <input name="arcadeFeeFixed" type="number" min="0" step="0.000001" defaultValue={revenue.config.arcadeFeeFixed} className="input" required />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              <span>Minimum entry fee</span>
              <input name="minEntryFee" type="number" min="0" step="0.000001" defaultValue={revenue.config.minEntryFee} className="input" required />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 sm:col-span-2">
              <input type="checkbox" name="isActive" value="true" defaultChecked={revenue.config.isActive} />
              Platform fee policy active
            </label>
            <label className="grid gap-2 text-sm text-slate-300 sm:col-span-2">
              <span>Notes</span>
              <textarea name="notes" defaultValue={revenue.config.notes} className="input min-h-28" placeholder="Describe the economics policy for operators and future audits." />
            </label>
            <button type="submit" className="button-primary px-5 py-3 text-sm sm:col-span-2">
              Guardar configuracion de fees
            </button>
          </form>
        </section>

        <section className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">Value capture</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Platform retention summary</h2>
          <div className="mt-6 grid gap-4">
            <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Current match fee</p>
              <p className="mt-2 text-4xl font-semibold text-cyan-100">{revenue.config.matchFeeBps} bps</p>
            </article>
            <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Current bet fee</p>
              <p className="mt-2 text-4xl font-semibold text-fuchsia-100">{revenue.config.betFeeBps} bps</p>
            </article>
            <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Captured total</p>
              <p className="mt-2 text-4xl font-semibold text-amber-200">{revenue.feeCapture.total}</p>
              <p className="mt-2 text-xs text-slate-400">entry fee retention + bet fee retention</p>
            </article>
          </div>
        </section>
      </section>

      <section className="panel rounded-[2rem] p-6 lg:p-8">
        <p className="eyebrow">Desglose por red</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {revenue.byNetwork.map((item: { network: string; amount: string; count: number }) => (
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
