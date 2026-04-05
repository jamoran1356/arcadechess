import Link from "next/link";
import { getAdminUsersSnapshot } from "@/lib/data";
import { AdminUsersTable } from "@/components/admin-users-table";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const { items: users, totalCount, totalPages } = await getAdminUsersSnapshot(currentPage, PER_PAGE);

  /* Serialize dates for the client component */
  const serialized = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    wallets: u.wallets.map((w) => ({ id: w.id, network: w.network, address: w.address, balance: w.balance })),
  }));

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="panel rounded-[2rem] p-6 lg:p-8">
        <p className="eyebrow">Clientes</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Gestión de usuarios</h2>
        <p className="mt-2 text-sm text-slate-400">
          {totalCount} usuario{totalCount !== 1 ? "s" : ""} registrado{totalCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      <AdminUsersTable users={serialized} />

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/admin/clientes?page=${currentPage - 1}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              ← Anterior
            </Link>
          )}

          {pageRange(currentPage, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-sm text-slate-600">…</span>
            ) : (
              <Link
                key={p}
                href={`/admin/clientes?page=${p}`}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  p === currentPage
                    ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                    : "border border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {p}
              </Link>
            ),
          )}

          {currentPage < totalPages && (
            <Link
              href={`/admin/clientes?page=${currentPage + 1}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              Siguiente →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function pageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
