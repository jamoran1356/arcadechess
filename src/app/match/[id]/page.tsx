import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { joinMatchAction, placeMatchBetAction, startSoloMatchAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import { getMatchSnapshot } from "@/lib/data";
import { ChessMatchClient } from "@/components/chess-match-client";

export const dynamic = "force-dynamic";

type MatchPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const session = await getSession();
  const match = await getMatchSnapshot(id, session?.id);
  const locale = await getLocale();
  const { match: t } = getDictionary(locale);

  if (!match) {
    notFound();
  }

  const canJoin = Boolean(
    session &&
      match.status === "OPEN" &&
      !match.isSolo &&
      session.id !== match.host.id &&
      !match.guest,
  );

  const canStartSolo = Boolean(
    session &&
      match.status === "OPEN" &&
      match.isSolo &&
      !match.guest,
  );

  const canBet = Boolean(
    session &&
      match.viewerRole === "spectator" &&
      match.guest &&
      match.betting.isOpen &&
      !match.betting.viewerBet,
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-semibold text-white">{match.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{match.theme}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-200/70">
            {match.isSolo ? t.modeSolo : t.modeVersus}
          </p>
        </div>

        {canJoin ? (
          <form action={joinMatchAction}>
            <input type="hidden" name="matchId" value={match.id} />
            <button type="submit" className="button-primary px-6 py-3 text-sm">
              {t.joinBtn}
            </button>
          </form>
        ) : canStartSolo ? (
          <form action={startSoloMatchAction}>
            <input type="hidden" name="matchId" value={match.id} />
            <button type="submit" className="button-primary px-6 py-3 text-sm">
              {t.startSoloBtn}
            </button>
          </form>
        ) : null}
      </section>

      {match.guest ? (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="panel rounded-[2rem] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="eyebrow">{t.betEyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{t.betTitle}</h2>
              </div>
              <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
                {t.betPoolLabel}: {match.betting.totalPool} {match.stakeToken}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{match.host.name}</p>
                <p className="mt-2 text-lg font-semibold text-white">{match.betting.hostPool} {match.stakeToken}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{t.betUsersLabel}</p>
                <p className="mt-2 text-lg font-semibold text-white">{match.betting.totalBettors}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{match.guest.name}</p>
                <p className="mt-2 text-lg font-semibold text-white">{match.betting.guestPool} {match.stakeToken}</p>
              </div>
            </div>

            <div className="mt-5 flex max-h-56 flex-col gap-2 overflow-auto">
              {match.bets.length > 0 ? (
                match.bets.map((bet) => (
                  <div key={bet.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <div>
                      <p className="font-medium text-white">{bet.userName}</p>
                      <p className="text-slate-400">
                        {t.betOnLabel} {bet.predictedWinnerId === match.host.id ? match.host.name : match.guest?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-200">{bet.amount} {match.stakeToken}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{bet.status}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">{t.betEmpty}</p>
              )}
            </div>
          </div>

          <aside className="panel rounded-[2rem] p-6">
            <p className="eyebrow">{t.betActionEyebrow}</p>
            {match.betting.viewerBet ? (
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>{t.betPlaced}</p>
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                  {t.betOnLabel} {match.betting.viewerBet.predictedWinnerId === match.host.id ? match.host.name : match.guest.name} • {match.betting.viewerBet.amount} {match.stakeToken}
                </p>
              </div>
            ) : canBet ? (
              <form action={placeMatchBetAction} className="mt-4 space-y-4">
                <input type="hidden" name="matchId" value={match.id} />
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">{t.betPickLabel}</span>
                  <select name="predictedWinnerId" className="input w-full" defaultValue={match.host.id}>
                    <option value={match.host.id}>{match.host.name}</option>
                    <option value={match.guest.id}>{match.guest.name}</option>
                  </select>
                </label>
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">{t.betAmountLabel}</span>
                  <input name="amount" type="number" min="0.01" step="0.01" className="input w-full" placeholder={`10 ${match.stakeToken}`} required />
                </label>
                <button type="submit" className="button-primary w-full px-5 py-3 text-sm">
                  {t.betSubmitBtn}
                </button>
                <p className="text-xs leading-6 text-slate-400">{t.betHint}</p>
              </form>
            ) : (
              <p className="mt-4 text-sm leading-7 text-slate-300">{t.betClosed}</p>
            )}
          </aside>
        </section>
      ) : null}

      <ChessMatchClient match={match} currentUserId={session?.id} />
    </div>
  );
}