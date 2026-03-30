import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { joinMatchAction, startSoloMatchAction } from "@/lib/actions";
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

      <ChessMatchClient match={match} currentUserId={session?.id} />
    </div>
  );
}