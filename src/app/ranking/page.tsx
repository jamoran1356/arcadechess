import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { getRanking } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const locale = await getLocale();
  const { rankingPage: t } = getDictionary(locale);
  const { players, total } = await getRanking(page, PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {/* Header */}
      <section>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
          {t.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          {t.subtitle}
        </p>
      </section>

      {players.length === 0 ? (
        <div className="panel flex items-center justify-center rounded-2xl p-10">
          <p className="text-sm text-slate-500">{t.empty}</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="panel overflow-hidden rounded-2xl border border-white/[0.06]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 w-14 text-center">{t.position}</th>
                  <th className="px-4 py-3">{t.player}</th>
                  <th className="px-4 py-3 text-right">{t.wins}</th>
                  <th className="px-4 py-3 text-right">{t.matches}</th>
                  <th className="px-4 py-3 text-right">{t.earnings}</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => {
                  const pos = (page - 1) * PER_PAGE + i + 1;
                  const initials = p.name
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-white/[0.04] transition hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            pos === 1
                              ? "bg-yellow-400/15 text-yellow-300"
                              : pos === 2
                              ? "bg-slate-300/15 text-slate-300"
                              : pos === 3
                              ? "bg-amber-600/15 text-amber-500"
                              : "text-slate-500"
                          }`}
                        >
                          {pos}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/10 text-[10px] font-bold text-cyan-300">
                            {initials}
                          </div>
                          <span className="font-medium text-white">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-cyan-300">
                        {p.wins}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {p.matches}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400">
                        {p.earnings}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              {page > 1 ? (
                <Link
                  href={`/ranking?page=${page - 1}`}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-white/15 hover:text-white"
                >
                  {t.prev}
                </Link>
              ) : (
                <span className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-2 text-sm text-slate-600 cursor-not-allowed">
                  {t.prev}
                </span>
              )}

              <span className="text-sm text-slate-400">
                {t.page} {page} {t.of} {totalPages}
              </span>

              {page < totalPages ? (
                <Link
                  href={`/ranking?page=${page + 1}`}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-white/15 hover:text-white"
                >
                  {t.next}
                </Link>
              ) : (
                <span className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-2 text-sm text-slate-600 cursor-not-allowed">
                  {t.next}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
