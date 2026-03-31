import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const { metrics } = await getAdminSnapshot();

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <p className="eyebrow">Resumen</p>
        <h2 className="text-4xl font-semibold tracking-tight text-white">Control operativo de la plataforma</h2>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="panel rounded-[1.75rem] border-cyan-400/20 bg-cyan-400/10 p-6">
          <p className="eyebrow">Usuarios</p>
          <p className="mt-3 text-4xl font-semibold text-white">{metrics.usersCount}</p>
        </article>
        <article className="panel rounded-[1.75rem] border-emerald-400/20 bg-emerald-400/10 p-6">
          <p className="eyebrow">Transacciones</p>
          <p className="mt-3 text-4xl font-semibold text-white">{metrics.transactionsCount}</p>
        </article>
        <article className="panel rounded-[1.75rem] border-amber-400/20 bg-amber-400/10 p-6">
          <p className="eyebrow">Mesas activas</p>
          <p className="mt-3 text-4xl font-semibold text-white">{metrics.openMatchesCount}</p>
        </article>
        <article className="panel rounded-[1.75rem] border-fuchsia-400/20 bg-fuchsia-400/10 p-6">
          <p className="eyebrow">Volumen settled</p>
          <p className="mt-3 text-4xl font-semibold text-amber-200">{metrics.settledVolume}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">Economics</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Value capture and operations</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Manage fees, transaction flow, treasury capture and real-time platform behavior from a single control surface.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/admin/ingresos" className="button-primary px-4 py-2 text-white">Fees y revenue</Link>
            <Link href="/admin/transacciones" className="button-secondary px-4 py-2 text-white">Transacciones</Link>
            <Link href="/admin/mesas" className="button-secondary px-4 py-2 text-white">Mesas</Link>
          </div>
        </article>

        <article className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">Secciones</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <Link href="/admin/clientes" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:border-cyan-200/40 hover:bg-cyan-300/10">Clientes</Link>
            <Link href="/admin/redes" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:border-cyan-200/40 hover:bg-cyan-300/10">Redes</Link>
            <Link href="/admin/estado" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:border-cyan-200/40 hover:bg-cyan-300/10">Estado del sitio</Link>
            <Link href="/admin/planes" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:border-cyan-200/40 hover:bg-cyan-300/10">Planes</Link>
            <Link href="/admin/actividad" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:border-cyan-200/40 hover:bg-cyan-300/10">Actividad actual</Link>
            <Link href="/admin/juegos-arcade" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:border-cyan-200/40 hover:bg-cyan-300/10">Juegos Arcade</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
