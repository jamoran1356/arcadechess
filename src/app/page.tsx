import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { getLandingSnapshot } from "@/lib/data";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";

export const dynamic = "force-dynamic";

function buildDailyChallenges(
  dateSeed: string,
  games: Array<{ name: string }>,
  t: { challengePrefix: string; challengeTemplates: readonly string[]; challengeRecommended: string },
) {
  const templates = t.challengeTemplates;
  const hash = Array.from(dateSeed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return [0, 1, 2].map((offset) => {
    const idx = (hash + offset * 3) % templates.length;
    const game = games[(hash + offset) % Math.max(1, games.length)]?.name ?? "Arcade Mix";
    return {
      title: `${t.challengePrefix} ${offset + 1}`,
      description: `${templates[idx]} ${t.challengeRecommended}: ${game}.`,
      reward: `${150 + offset * 75} XP`,
    };
  });
}

export default async function Home() {
  const session = await getSession();
  const { stats, openMatches, networks, arcadeLibrary } = await getLandingSnapshot();
  const dateSeed = new Date().toISOString().slice(0, 10);
  const locale = await getLocale();
  const { home: t } = getDictionary(locale);
  const dailyChallenges = buildDailyChallenges(dateSeed, arcadeLibrary, t);
  const testimonials = t.testimonials;
  const plans = t.plans;
  const tournaments = t.tournaments;
  type LandingMatch = (typeof openMatches)[number];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <section className="animate-rise relative min-h-[72vh] overflow-hidden rounded-[2rem] border border-white/10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://upload.wikimedia.org/wikipedia/commons/3/34/Chess_game_in_Heraklion%2C_Crete.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62),rgba(0,0,0,0.78))]" />

        <div className="relative z-10 mx-auto flex min-h-[72vh] max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
          <p className="eyebrow">{t.heroEyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
            {t.heroTitle}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200 sm:text-xl">
            {t.heroSubtitle}
          </p>

          <div className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={session ? "/lobby#create-match" : "/register"} className="button-primary px-7 py-3 text-center">
              {session ? t.ctaCreate : t.ctaRegister}
            </Link>
            <Link href="#how-to-play" className="button-secondary px-7 py-3 text-center text-slate-100">
              {t.ctaHowToPlay}
            </Link>
          </div>

          <div className="mt-10 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/20 bg-black/40 p-4 backdrop-blur-sm">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200/70">{t.statUsers}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.usersCount}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-black/40 p-4 backdrop-blur-sm">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200/70">{t.statTransactions}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.transactionsCount}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-black/40 p-4 backdrop-blur-sm">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200/70">{t.statLiveMatches}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.availableMatches}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-to-play" className="grid gap-6">
        <div>
          <p className="eyebrow">{t.howToEyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{t.howToTitle}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <article className="panel rounded-[1.75rem] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{t.step2Label}</p>
            <h3 className="mt-3 text-xl font-semibold text-white">{t.step2Title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t.step2Desc}</p>
            <Link href="/arcade-test" className="mt-5 inline-flex text-sm text-cyan-200 hover:text-cyan-100">{t.step2Link}</Link>
          </article>
          <article className="panel rounded-[1.75rem] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{t.step1Label}</p>
            <h3 className="mt-3 text-xl font-semibold text-white">{t.step1Title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t.step1Desc}</p>
            <Link href={session ? "/lobby#create-match" : "/register"} className="mt-5 inline-flex text-sm text-cyan-200 hover:text-cyan-100">{t.step1Link}</Link>
          </article>
          <article className="panel rounded-[1.75rem] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{t.step3Label}</p>
            <h3 className="mt-3 text-xl font-semibold text-white">{t.step3Title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t.step3Desc}</p>
            <Link href={session ? "/dashboard" : "/login"} className="mt-5 inline-flex text-sm text-cyan-200 hover:text-cyan-100">{t.step3Link}</Link>
          </article>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <article className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">{t.metaEyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{t.metaTitle}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">{t.metaDesc}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{t.phase1Label}</p>
              <p className="mt-2 text-sm text-slate-200">{t.phase1Text}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{t.phase2Label}</p>
              <p className="mt-2 text-sm text-slate-200">{t.phase2Text}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{t.phase3Label}</p>
              <p className="mt-2 text-sm text-slate-200">{t.phase3Text}</p>
            </div>
          </div>
        </article>

        <div className="panel overflow-hidden rounded-[2rem] p-3">
          <Image
            src="/chess-arcade.svg"
            alt="Duelos arcade en paralelo durante una captura de ajedrez"
            width={1200}
            height={720}
            className="h-auto w-full rounded-[1.25rem]"
          />
        </div>
      </section>

      <section className="grid gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t.liveEyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{t.liveTitle}</h2>
          </div>
          <Link href="/lobby" className="text-sm text-cyan-200 hover:text-cyan-100">
            {t.liveLink}
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {openMatches.length > 0 ? (
            openMatches.map((match: LandingMatch) => (
              <article key={match.id} className="panel rounded-[1.75rem] p-6">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-cyan-200">
                    {match.network}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    {match.status.replaceAll("_", " ")}
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-white">{match.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{match.theme}</p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                  {match.arcadeGamePool.map((game: string) => (
                    <span key={game} className="rounded-full bg-white/6 px-3 py-1">
                      {game.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{t.stakeLabel}</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-200">
                      {match.stakeAmount} {match.stakeToken}
                    </p>
                  </div>
                  <Link href={`/match/${match.id}`} className="button-secondary px-4 py-2 text-sm text-white">
                    {t.viewTable}
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <article className="panel rounded-[1.75rem] p-6 lg:col-span-3">
              <h3 className="text-2xl font-semibold text-white">{t.noMatchesTitle}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{t.noMatchesDesc}</p>
              <Link href={session ? "/lobby#create-match" : "/register"} className="button-primary mt-5 inline-flex px-5 py-2 text-sm">
                {session ? t.noMatchesCta : t.noMatchesCtaRegister}
              </Link>
            </article>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {networks.map((network) => (
          <article key={network.id} className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow">{t.networkLabel}</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">{network.name}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{network.summary}</p>
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              {network.status}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <article className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">{t.aboutEyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{t.aboutTitle}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">{t.aboutDesc}</p>
          <ul className="mt-6 grid gap-3 text-sm text-slate-200">
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">{t.rule1}</li>
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">{t.rule2}</li>
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">{t.rule3}</li>
          </ul>
        </article>
        <div className="panel overflow-hidden rounded-[2rem] p-3">
          <Image
            src="/chess-arcade.svg"
            alt="Ajedrez competitivo con duelos arcade"
            width={1200}
            height={720}
            className="h-auto w-full rounded-[1.25rem]"
          />
        </div>
      </section>

      <section className="grid gap-6">
        <div>
          <p className="eyebrow">{t.challengesEyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{t.challengesTitle}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {dailyChallenges.map((challenge) => (
            <article key={challenge.title} className="panel rounded-[1.75rem] p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{challenge.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{challenge.description}</p>
              <p className="mt-5 text-sm font-semibold text-amber-200">{t.challengeReward}: {challenge.reward}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <div>
          <p className="eyebrow">{t.tournamentsEyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{t.tournamentsTitle}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <article key={tournament.title} className="panel rounded-[1.75rem] p-6">
              <h3 className="text-2xl font-semibold text-white">{tournament.title}</h3>
              <p className="mt-3 text-sm text-slate-300">{tournament.when}</p>
              <p className="mt-2 text-sm text-slate-300">{t.tournamentFormat}: {tournament.type}</p>
              <p className="mt-2 text-sm font-semibold text-amber-200">{t.tournamentPrize}: {tournament.prize}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <div>
          <p className="eyebrow">{t.testimonialsEyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{t.testimonialsTitle}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="panel rounded-[1.75rem] p-6">
              <p className="text-sm leading-7 text-slate-200">“{testimonial.quote}”</p>
              <p className="mt-5 text-base font-semibold text-white">{testimonial.name}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/70">{testimonial.role}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <div>
          <p className="eyebrow">{t.plansEyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{t.plansTitle}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className="panel rounded-[1.75rem] p-6">
              <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
              <p className="mt-2 text-xl font-semibold text-amber-200">{plan.price}</p>
              <ul className="mt-5 grid gap-2 text-sm text-slate-300">
                {plan.bullets.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

