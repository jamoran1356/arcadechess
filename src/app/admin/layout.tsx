import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const adminLinks = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/transacciones", label: "Transacciones" },
  { href: "/admin/redes", label: "Redes" },
  { href: "/admin/estado", label: "Estado del sitio" },
  { href: "/admin/ingresos", label: "Ingresos" },
  { href: "/admin/planes", label: "Planes" },
  { href: "/admin/mesas", label: "Mesas" },
  { href: "/admin/actividad", label: "Actividad actual" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="panel rounded-[2rem] p-6 lg:p-8">
        <p className="eyebrow">Consola administrativa</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">PlayChess Control Center</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Panel aislado del cliente para gestionar usuarios, transacciones, redes, estado operativo, ingresos, planes, mesas y actividad en tiempo real.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="panel h-fit rounded-[1.75rem] p-4">
          <nav className="grid gap-2">
            {adminLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-200/40 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
