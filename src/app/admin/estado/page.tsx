import { getAdminSiteStatusSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminEstadoPage() {
  const status = await getAdminSiteStatusSnapshot();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article className="panel rounded-[1.75rem] p-6">
        <p className="eyebrow">Mesas abiertas</p>
        <p className="mt-3 text-4xl font-semibold text-white">{status.openMatches}</p>
      </article>
      <article className="panel rounded-[1.75rem] p-6">
        <p className="eyebrow">Mesas en juego</p>
        <p className="mt-3 text-4xl font-semibold text-white">{status.inProgressMatches}</p>
      </article>
      <article className="panel rounded-[1.75rem] p-6">
        <p className="eyebrow">Arcade pendiente</p>
        <p className="mt-3 text-4xl font-semibold text-amber-200">{status.pendingArcade}</p>
      </article>
      <article className="panel rounded-[1.75rem] p-6">
        <p className="eyebrow">Usuarios registrados</p>
        <p className="mt-3 text-4xl font-semibold text-white">{status.users}</p>
      </article>
      <article className="panel rounded-[1.75rem] p-6">
        <p className="eyebrow">Transacciones</p>
        <p className="mt-3 text-4xl font-semibold text-white">{status.transactions}</p>
      </article>
      <article className="panel rounded-[1.75rem] p-6">
        <p className="eyebrow">Generado</p>
        <p className="mt-3 text-sm font-medium text-slate-200">{new Date(status.generatedAt).toLocaleString("es-ES")}</p>
      </article>
    </div>
  );
}
