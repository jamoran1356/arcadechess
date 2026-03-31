import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { ArcadeGameType, TransactionNetwork } from "@prisma/client";
import { createMatchAction, joinMatchAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { arcadeLibrary } from "@/lib/arcade";
import { getLobbySnapshot } from "@/lib/data";
import { MatchShareControls } from "@/components/match-share-controls";

export const dynamic = "force-dynamic";

export default async function LobbyPage({
  searchParams,
}: {
  searchParams?: Promise<{ network?: string }>;
}) {
  const session = await requireUser();
  const { me, matches } = await getLobbySnapshot(session.id);
  const params = (await searchParams) ?? {};
  const selectedNetwork = String(params.network ?? "ALL").toUpperCase();
  const filteredMatches = selectedNetwork === "ALL"
    ? matches
    : matches.filter((match) => match.network === selectedNetwork);
  const locale = await getLocale();
  const { lobby: t } = getDictionary(locale);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="panel rounded-[1.75rem] p-5">
        <div className="mt-3 grid gap-3 text-sm text-slate-300 lg:grid-cols-3">
        <p className="eyebrow">{t.howEyebrow}</p>
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">{t.howStep1}</p>
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">{t.howStep2}</p>
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">{t.howStep3}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div id="create-match" className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">{t.publishEyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">{t.publishTitle}</h1>
          <form action={createMatchAction} className="mt-8 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input type="radio" name="isSolo" value="false" defaultChecked />
                {t.modeVersus}
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input type="radio" name="isSolo" value="true" />
                {t.modeSolo}
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <input name="stakeAmount" type="number" min="0" step="0.01" className="input" placeholder={t.stakeLabel} required />
              <input name="entryFee" type="number" min="0" step="0.01" className="input" placeholder={t.feeLabel} defaultValue="0" required />
              <input name="stakeToken" className="input" defaultValue="INIT" />
              <select name="network" className="input" defaultValue={TransactionNetwork.INITIA}>
                {Object.values(TransactionNetwork).map((network) => (
                  <option key={network} value={network}>
                    {network}
                  </option>
                ))}
              </select>
            </div>

            {me?.wallets && me.wallets.length > 0 ? (
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                {me.wallets.map((w) => (
                  <span key={w.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1">
                    {w.network}: <span className="font-semibold text-slate-200">{Number(w.balance).toFixed(2)}</span>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                {t.clockLabel}
                <input
                  name="gameClockMinutes"
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  className="input"
                  defaultValue="5"
                  required
                />
              </label>
              <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {t.clockNote}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{t.arcadeLibrary}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {arcadeLibrary.map((game) => (
                  <label key={game.id} className="rounded-[1.25rem] border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-200">
                    <input type="checkbox" name="arcadeGamePool" value={game.id as ArcadeGameType} defaultChecked={game.id !== ArcadeGameType.KEY_CLASH} className="mr-2" />
                    {game.name}
                    <p className="mt-2 text-xs leading-6 text-slate-400">{game.blurb}</p>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="button-primary mt-2 px-6 py-3 text-sm">
              {t.createBtn}
            </button>
          </form>
        </div>

        <div className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">{t.connectedEyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{me?.name}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {t.connectedDesc}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/arcade-test" className="button-secondary px-4 py-2 text-white">
              {t.testArcade}
            </Link>
            {session.role === "ADMIN" ? (
              <Link href="/admin" className="button-secondary px-4 py-2 text-white">
                {t.goAdmin}
              </Link>
            ) : null}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {me?.wallets.map((wallet) => (
              <article key={wallet.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{wallet.network}</p>
                <p className="mt-2 text-xl font-semibold text-white">{wallet.balance}</p>
                <p className="mt-2 text-xs text-slate-400 break-all">{wallet.address}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <p className="eyebrow">{t.activeEyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{t.activeTitle}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["ALL", ...Object.values(TransactionNetwork)] as const).map((network) => (
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
        </div>

        {filteredMatches.length === 0 ? (
          <article className="panel rounded-[1.75rem] p-6">
            <h3 className="text-2xl font-semibold text-white">{t.noMatchesTitle}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t.noMatchesDesc}</p>
            <a href="#create-match" className="button-primary mt-5 inline-flex px-5 py-2 text-sm">{t.noMatchesCta}</a>
          </article>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {filteredMatches.map((match) => (
              <article key={match.id} className="panel rounded-[1.75rem] p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-cyan-200">
                    {match.network}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    {match.status.replaceAll("_", " ")}
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-white">{match.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{match.theme}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                  {match.arcadeGamePool.map((game) => (
                    <span key={game} className="rounded-full bg-white/6 px-3 py-1">
                      {game.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
                <div className="mt-6 text-sm text-slate-300">
                  {t.hostLabel}: <span className="text-white">{match.host}</span>
                  <br />
                  {t.rivalLabel}: <span className="text-white">{match.guest ?? t.available}</span>
                  <br />
                  {t.modeLabel}: <span className="text-white">{match.isSolo ? t.soloMode : t.versusMode}</span>
                  <br />
                  {t.stakeFeeLabel}: <span className="text-white">{match.stakeAmount} / {match.entryFee} {match.stakeToken}</span>
                  <br />
                  {t.relojLabel}: <span className="text-white">{Math.max(1, Math.round(match.gameClockMs / 60000))} {t.clockMin}</span>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link href={`/match/${match.id}`} className="button-secondary px-4 py-2 text-sm text-white">
                    {t.viewBtn}
                  </Link>
                  {match.status === "OPEN" && !match.isSolo && match.host !== session.name ? (
                    <form action={joinMatchAction}>
                      <input type="hidden" name="matchId" value={match.id} />
                      <button type="submit" className="button-primary px-4 py-2 text-sm">
                        {t.joinBtn}
                      </button>
                    </form>
                  ) : null}
                  {match.hasPendingDuel ? <span className="text-xs text-amber-200">{t.pendingDuel}</span> : null}
                </div>
                <div className="mt-4">
                  <MatchShareControls matchId={match.id} title={match.title} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
