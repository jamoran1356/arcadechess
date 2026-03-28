import { deletePlanAction, upsertPlanAction } from "@/lib/actions";
import { getAdminPlansSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPlanesPage() {
  const plans = await getAdminPlansSnapshot();

  return (
    <div className="grid gap-6">
      <section className="panel rounded-[2rem] p-6 lg:p-8">
        <p className="eyebrow">Crear plan</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Planes y suscripciones</h2>
        <form action={upsertPlanAction} className="mt-6 grid gap-3 sm:grid-cols-2">
          <input name="name" placeholder="Nombre" className="input" required />
          <input name="token" placeholder="Token" defaultValue="INIT" className="input" required />
          <input name="price" type="number" min="0" step="0.01" placeholder="Precio" className="input" required />
          <label className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">
            <input type="checkbox" name="isActive" value="true" defaultChecked />
            Plan activo
          </label>
          <textarea name="description" placeholder="Descripcion" className="input min-h-24 sm:col-span-2" required />
          <textarea name="features" placeholder="Una feature por linea" className="input min-h-24 sm:col-span-2" />
          <button type="submit" className="button-primary px-5 py-3 text-sm sm:col-span-2">
            Guardar plan
          </button>
        </form>
      </section>

      <section className="panel rounded-[2rem] p-6 lg:p-8">
        <p className="eyebrow">CRUD planes</p>
        <div className="mt-5 grid gap-4">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                  <p className="mt-1 text-sm text-slate-300">{plan.description}</p>
                </div>
                <form action={deletePlanAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <button type="submit" className="rounded-lg border border-rose-300/30 px-3 py-2 text-xs text-rose-200 hover:border-rose-200/50">
                    Eliminar
                  </button>
                </form>
              </div>
              <p className="mt-3 text-sm text-slate-300">Precio: {plan.price.toString()} {plan.token}</p>
              <p className="mt-2 text-xs text-slate-400">Estado: {plan.isActive ? "Activo" : "Inactivo"}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
