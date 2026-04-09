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
    { href: "/admin/juegos-arcade", label: "Juegos Arcade" },
    { href: "/admin/tutoriales", label: "Tutoriales" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.14),transparent_32%),rgba(2,6,23,0.92)] p-6 lg:p-8">
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:26px_26px]" />
        <div className="relative">
          <p className="eyebrow">Consola administrativa</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">PlayChess Control Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Panel aislado del cliente para gestionar usuarios, transacciones, redes, estado operativo, ingresos, planes, mesas y actividad en tiempo real.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="panel h-fit rounded-[1.75rem] p-4 bg-slate-950/75 backdrop-blur">
          <nav className="grid gap-2">
            {adminLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-200/40 hover:bg-cyan-300/10 hover:text-white"
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
