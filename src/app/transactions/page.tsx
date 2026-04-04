import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { getPublicTransactions } from "@/lib/data";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

const STATUS_COLOR: Record<string, string> = {
  SETTLED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  PENDING: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  FAILED: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

const TYPE_LABEL: Record<string, string> = {
  ENTRY_STAKE: "Stake",
  ESCROW_LOCK: "Escrow",
  PRIZE_PAYOUT: "Premio",
  BRIDGE_SYNC: "Bridge",
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.transactions;

  const { items: txs, totalCount, settledCount, settledVolume, totalPages } =
    await getPublicTransactions(currentPage, PER_PAGE);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {/* Header */}
      <section>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">{t.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">{t.subtitle}</p>
      </section>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel rounded-[1.5rem] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{t.statTotal}</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalCount}</p>
        </div>
        <div className="panel rounded-[1.5rem] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{t.statSettled}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{settledCount}</p>
        </div>
        <div className="panel rounded-[1.5rem] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{t.statVolume}</p>
          <p className="mt-1 text-2xl font-bold text-amber-300">{settledVolume.toFixed(4)} INIT</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[1.5rem] border border-white/10 bg-white/[0.02]">
        <table className="w-full min-w-[800px] text-left text-sm text-slate-300">
          <thead className="bg-white/5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">{t.colDate}</th>
              <th className="px-4 py-3">{t.colWallet}</th>
              <th className="px-4 py-3">{t.colType}</th>
              <th className="px-4 py-3">{t.colNetwork}</th>
              <th className="px-4 py-3 text-right">{t.colAmount}</th>
              <th className="px-4 py-3">{t.colStatus}</th>
              <th className="px-4 py-3">{t.colMatch}</th>
              <th className="px-4 py-3">{t.colTx}</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((tx) => (
              <tr key={tx.id} className="border-t border-white/[0.06] transition hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
                  {formatDate(tx.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const w = tx.user.wallets.find((w) => w.network === tx.network) ?? tx.user.wallets[0];
                    const addr = w?.address ?? "—";
                    const isPlaceholder = addr.startsWith("initia_") || addr.startsWith("flow_") || addr.startsWith("solana_");
                    return isPlaceholder
                      ? <span className="font-mono text-xs text-slate-600">—</span>
                      : <span className="font-mono text-xs text-slate-300" title={addr}>{addr.slice(0, 10)}…{addr.slice(-4)}</span>;
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs">
                    {TYPE_LABEL[tx.type] ?? tx.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-cyan-300/80">{tx.network}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                  {Number(tx.amount).toFixed(4)} <span className="text-xs text-slate-500">{tx.token}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLOR[tx.status] ?? "text-slate-400"}`}>
                    {tx.status}
                  </span>
                </td>
                <td className="max-w-[140px] truncate px-4 py-3 text-xs text-slate-500">
                  {tx.match?.title ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {tx.txHash ? (
                    <a
                      href={`https://scan.testnet.initia.xyz/initiation-2/txs/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-cyan-400 hover:text-cyan-200"
                    >
                      {tx.txHash.slice(0, 8)}…
                    </a>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}

            {txs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  {t.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/transactions?page=${currentPage - 1}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              ← {t.pagePrev}
            </Link>
          )}

          {pageRange(currentPage, totalPages).map((p) =>
            p === "..." ? (
              <span key={`ellipsis-${p}`} className="px-1 text-sm text-slate-600">…</span>
            ) : (
              <Link
                key={p}
                href={`/transactions?page=${p}`}
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
              href={`/transactions?page=${currentPage + 1}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              {t.pageNext} →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

/** Generate a compact page range: [1, '...', 4, 5, 6, '...', 20] */
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
