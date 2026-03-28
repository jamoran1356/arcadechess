import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const { metrics } = await getAdminSnapshot();

  return (
    <div className="grid gap-8">
      <section>
        <p className="eyebrow">Resumen</p>
        <h2 className="mt-3 text-4xl font-semibold text-white">Control operativo de la plataforma</h2>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="panel rounded-[1.75rem] p-6">
          <p className="eyebrow">Usuarios</p>
          <p className="mt-3 text-4xl font-semibold text-white">{metrics.usersCount}</p>
        </article>
        <article className="panel rounded-[1.75rem] p-6">
          <p className="eyebrow">Transacciones</p>
          <p className="mt-3 text-4xl font-semibold text-white">{metrics.transactionsCount}</p>
        </article>
        <article className="panel rounded-[1.75rem] p-6">
          <p className="eyebrow">Mesas activas</p>
          <p className="mt-3 text-4xl font-semibold text-white">{metrics.openMatchesCount}</p>
        </article>
        <article className="panel rounded-[1.75rem] p-6">
          <p className="eyebrow">Volumen settled</p>
          <p className="mt-3 text-4xl font-semibold text-amber-200">{metrics.settledVolume}</p>
        </article>
      </section>

      <section className="panel rounded-[2rem] p-6">
        <p className="eyebrow">Secciones</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/clientes" className="button-secondary px-4 py-2 text-white">Clientes</Link>
          <Link href="/admin/transacciones" className="button-secondary px-4 py-2 text-white">Transacciones</Link>
          <Link href="/admin/redes" className="button-secondary px-4 py-2 text-white">Redes</Link>
          <Link href="/admin/estado" className="button-secondary px-4 py-2 text-white">Estado del sitio</Link>
          <Link href="/admin/ingresos" className="button-secondary px-4 py-2 text-white">Ingresos</Link>
          <Link href="/admin/planes" className="button-secondary px-4 py-2 text-white">Planes</Link>
          <Link href="/admin/mesas" className="button-secondary px-4 py-2 text-white">Mesas</Link>
          <Link href="/admin/actividad" className="button-secondary px-4 py-2 text-white">Actividad actual</Link>
        </div>
      </section>
    </div>
  );
}
