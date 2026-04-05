import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { requireUser } from "@/lib/auth";
import { arcadeLibrary } from "@/lib/arcade";
import { getLobbySnapshot } from "@/lib/data";
import { getEnabledNetworks } from "@/lib/networks";
import { getPlatformConfig } from "@/lib/platform-config";
import { MatchShareControls } from "@/components/match-share-controls";
import { CreateMatchForm } from "@/components/create-match-form";
import { LobbyClient } from "@/components/lobby-client";
import { LobbyRefresher } from "@/components/lobby-refresher";

export const dynamic = "force-dynamic";

export default async function LobbyPage({
  searchParams,
}: {
  searchParams?: Promise<{ network?: string }>;
}) {
  const session = await requireUser();
  const [{ me, matches }, enabledNetworks, platformConfig] = await Promise.all([
    getLobbySnapshot(session.id),
    getEnabledNetworks(),
    getPlatformConfig(),
  ]);
  const enabledSet = new Set(enabledNetworks);
  const params = (await searchParams) ?? {};
  const selectedNetwork = String(params.network ?? "ALL").toUpperCase();
  const filteredMatches = selectedNetwork === "ALL"
    ? matches
    : matches.filter((match) => match.network === selectedNetwork);
  const locale = await getLocale();
  const { lobby: t } = getDictionary(locale);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <LobbyRefresher />
      {/* ─── Header: titulo + boton crear ─── */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{t.activeEyebrow}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">{t.activeTitle}</h1>
          <p className="mt-2 text-sm leading-7 text-slate-400">{t.connectedDesc}</p>
        </div>

        <LobbyClient
          wallets={(me?.wallets ?? []).filter((w) => enabledSet.has(w.network)).map((w) => ({ id: w.id, network: w.network, balance: String(w.balance) }))}
          enabledNetworks={enabledNetworks}
          arcadeLibrary={arcadeLibrary.map((g) => ({ id: g.id, name: g.name, blurb: g.blurb }))}
          feeConfig={{ matchFeeBps: platformConfig.matchFeeBps }}
          labels={{
            publishEyebrow: t.publishEyebrow,
            publishTitle: t.publishTitle,
            modeVersus: t.modeVersus,
            modeSolo: t.modeSolo,
            stakeLabel: t.stakeLabel,
            clockLabel: t.clockLabel,
            clockNote: t.clockNote,
            arcadeLibrary: t.arcadeLibrary,
            arcadeHint: t.arcadeHint,
            createBtn: t.createBtn,
          }}
          buttonLabel={t.createBtn}
        />
      </section>

      {/* ─── Filtros de red ─── */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", ...enabledNetworks] as const).map((network) => (
          <Link
            key={network}
            href={network === "ALL" ? "/lobby" : `/lobby?network=${network}`}
            className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
              selectedNetwork === network
                ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 text-slate-300 hover:border-cyan-300/30"
            }`}
          >
            {network}
          </Link>
        ))}
      </div>

      {/* ─── Lista de partidas ─── */}
      {filteredMatches.length === 0 ? (
        <article className="panel rounded-[2rem] p-10 text-center">
          <h3 className="text-2xl font-bold text-white">{t.noMatchesTitle}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-400">{t.noMatchesDesc}</p>
        </article>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMatches.map((match) => (
            <article key={match.id} className="card-glow panel group rounded-[2rem] p-6 transition-transform duration-300 hover:-translate-y-1">
              {/* Badge row */}
              <div className="flex items-center gap-2">
                <span className="tag">{match.network}</span>
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  match.status === "OPEN"
                    ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    : "border border-amber-400/30 bg-amber-400/10 text-amber-300"
                }`}>
                  {match.status === "OPEN" ? "Abierta" : match.status.replaceAll("_", " ")}
                </span>
                {match.hasPendingDuel && (
                  <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300">
                    {t.pendingDuel}
                  </span>
                )}
              </div>

              {/* Title + stake */}
              <h3 className="mt-4 text-xl font-bold text-white">{match.title}</h3>
              <p className="mt-1 text-3xl font-semibold text-amber-300">
                {match.stakeAmount} <span className="text-base font-normal text-amber-300/50">{match.stakeToken}</span>
              </p>

              {/* Meta */}
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-slate-400">
                <p>{t.hostLabel}: <span className="text-slate-200">{match.host}</span></p>
                <p>{t.rivalLabel}: <span className="text-slate-200">{match.guest ?? t.available}</span></p>
                <p>{t.modeLabel}: <span className="text-slate-200">{match.isSolo ? t.soloMode : t.versusMode}</span></p>
                <p>{t.relojLabel}: <span className="text-slate-200">{Math.max(1, Math.round(match.gameClockMs / 60000))} {t.clockMin}</span></p>
              </div>

              {/* Arcade games */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {match.arcadeGamePool.length === 0 ? (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-emerald-400">
                    {locale === "es" ? "Clásica" : "Classic"}
                  </span>
                ) : (
                  match.arcadeGamePool.map((game) => (
                    <span key={game} className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-500">
                      {game.replaceAll("_", " ")}
                    </span>
                  ))
                )}
              </div>

              {/* Actions */}
              <div className="mt-5 flex items-center gap-3">
                {match.status === "OPEN" && !match.isSolo && match.host !== session.name ? (
                  <Link href={`/match/${match.id}?autoJoin=true`} className="button-primary px-5 py-2 text-sm">
                    {t.joinBtn}
                  </Link>
                ) : null}
                <Link href={`/match/${match.id}`} className="button-secondary px-4 py-2 text-sm text-white">
                  {t.viewBtn}
                </Link>
                <div className="ml-auto">
                  <MatchShareControls matchId={match.id} title={match.title} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
