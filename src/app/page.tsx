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
  const { stats, openMatches, networks, arcadeLibrary, topPlayers } = await getLandingSnapshot();
  const dateSeed = new Date().toISOString().slice(0, 10);
  const locale = await getLocale();
  const { home: t } = getDictionary(locale);
  const dailyChallenges = buildDailyChallenges(dateSeed, arcadeLibrary, t);
  const testimonials = t.testimonials;
  const plans = t.plans;
  const tournaments = t.tournaments;
  type LandingMatch = (typeof openMatches)[number];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-28 px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      {/* ── Hero ── */}
      <section className="animate-rise relative min-h-[74vh] overflow-hidden rounded-[2.5rem] border border-white/[0.06]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://upload.wikimedia.org/wikipedia/commons/3/34/Chess_game_in_Heraklion%2C_Crete.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,17,0.55)_0%,rgba(3,7,17,0.85)_60%,rgba(3,7,17,0.95)_100%)]" />

        <div className="relative z-10 mx-auto flex min-h-[74vh] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
          <p className="eyebrow animate-fade-in">{t.heroEyebrow}</p>
          <h1 className="mt-5 max-w-4xl bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-5xl font-bold leading-[1.05] tracking-tight text-transparent sm:text-6xl lg:text-7xl">
            {t.heroTitle}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300/90 sm:text-xl">
            {t.heroSubtitle}
          </p>

          <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={session ? "/lobby#create-match" : "/register"} className="button-primary px-8 py-3.5 text-center text-sm">
              {session ? t.ctaCreate : t.ctaRegister}
            </Link>
            <Link href="#how-to-play" className="button-secondary px-8 py-3.5 text-center text-sm">
              {t.ctaHowToPlay}
            </Link>
          </div>

          <div className="mt-14 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
            <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:border-cyan-400/20 hover:bg-white/[0.05]">
              <p className="eyebrow text-[10px]">{t.statUsers}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-white">{stats.usersCount}</p>
            </div>
            <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:border-cyan-400/20 hover:bg-white/[0.05]">
              <p className="eyebrow text-[10px]">{t.statTransactions}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-white">{stats.transactionsCount}</p>
            </div>
            <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:border-amber-400/20 hover:bg-white/[0.05]">
              <p className="eyebrow text-[10px]">{t.statLiveMatches}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-white">{stats.availableMatches}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How to Play ── */}
      <section id="how-to-play" className="grid gap-8">
        <div>
          <p className="eyebrow">{t.howToEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t.howToTitle}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            { label: t.step2Label, title: t.step2Title, desc: t.step2Desc, link: t.step2Link, href: "/arcade-test", accent: "from-cyan-500/20 to-transparent" },
            { label: t.step1Label, title: t.step1Title, desc: t.step1Desc, link: t.step1Link, href: session ? "/lobby#create-match" : "/register", accent: "from-amber-500/15 to-transparent" },
            { label: t.step3Label, title: t.step3Title, desc: t.step3Desc, link: t.step3Link, href: session ? "/dashboard" : "/login", accent: "from-emerald-500/15 to-transparent" },
          ].map((step) => (
            <article key={step.label} className="card-glow panel rounded-[2rem] p-7 transition-transform duration-300 hover:-translate-y-1">
              <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-br ${step.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
              <p className="eyebrow text-[10px]">{step.label}</p>
              <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">{step.desc}</p>
              <Link href={step.href} className="mt-5 inline-flex text-sm font-medium text-cyan-400 transition-colors hover:text-cyan-300">
                {step.link} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ── Meta Strategy ── */}
      <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <article className="panel card-glow rounded-[2.5rem] p-7 lg:p-9">
          <p className="eyebrow">{t.metaEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">{t.metaTitle}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-400">{t.metaDesc}</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
              <p className="eyebrow text-[10px]">{t.phase1Label}</p>
              <p className="mt-2 text-sm text-slate-300">{t.phase1Text}</p>
            </div>
            <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-4">
              <p className="eyebrow text-[10px] !text-amber-400">{t.phase2Label}</p>
              <p className="mt-2 text-sm text-slate-300">{t.phase2Text}</p>
            </div>
            <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
              <p className="eyebrow text-[10px] !text-emerald-400">{t.phase3Label}</p>
              <p className="mt-2 text-sm text-slate-300">{t.phase3Text}</p>
            </div>
          </div>
        </article>

        <div className="panel overflow-hidden rounded-[2.5rem] p-3">
          <Image
            src="/chess-arcade.svg"
            alt="Duelos arcade en paralelo durante una captura de ajedrez"
            width={1200}
            height={720}
            className="h-auto w-full rounded-[2rem]"
          />
        </div>
      </section>

      {/* ── Live Matches ── */}
      <section className="grid gap-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t.liveEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">{t.liveTitle}</h2>
          </div>
          <Link href="/lobby" className="text-sm font-medium text-cyan-400 transition-colors hover:text-cyan-300">
            {t.liveLink} →
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {openMatches.length > 0 ? (
            openMatches.map((match: LandingMatch) => (
              <article key={match.id} className="card-glow panel rounded-[2rem] p-6 transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                    {match.network}
                  </span>
                  <span className="tag">
                    {match.status.replaceAll("_", " ")}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-white">{match.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{match.theme}</p>
                <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                  {match.arcadeGamePool.map((game: string) => (
                    <span key={game} className="tag">
                      {game.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="eyebrow text-[10px]">{t.stakeLabel}</p>
                    <p className="mt-1 text-2xl font-bold text-amber-300">
                      {match.stakeAmount} <span className="text-base font-normal text-amber-300/60">{match.stakeToken}</span>
                    </p>
                  </div>
                  <Link href={`/match/${match.id}`} className="button-secondary px-5 py-2.5 text-sm">
                    {t.viewTable}
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <article className="panel rounded-[2rem] p-8 lg:col-span-3 text-center">
              <h3 className="text-2xl font-bold text-white">{t.noMatchesTitle}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">{t.noMatchesDesc}</p>
              <Link href={session ? "/lobby#create-match" : "/register"} className="button-primary mt-6 inline-flex px-6 py-3 text-sm">
                {session ? t.noMatchesCta : t.noMatchesCtaRegister}
              </Link>
            </article>
          )}
        </div>
      </section>

      {/* ── Networks ── */}
      <section className="grid gap-8 lg:grid-cols-3">
        {networks.filter((n) => n.enabled).map((network) => (
          <article key={network.id} className="card-glow panel rounded-[2rem] p-7 transition-transform duration-300 hover:-translate-y-1">
            <p className="eyebrow">{t.networkLabel}</p>
            <h3 className="mt-3 text-2xl font-bold text-white">{network.name}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">{network.summary}</p>
            {network.contractAddress && (
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="eyebrow text-[9px]">Contract</p>
                {network.explorerUrl ? (
                  <a
                    href={network.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all font-mono text-xs text-cyan-300 underline-offset-2 hover:underline"
                  >
                    {network.contractAddress}
                  </a>
                ) : (
                  <p className="mt-1 break-all font-mono text-xs text-slate-400">{network.contractAddress}</p>
                )}
              </div>
            )}
          </article>
        ))}
      </section>

      {/* ── Divider ── */}
      <div className="section-divider" />

      {/* ── About ── */}
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <article className="panel card-glow rounded-[2.5rem] p-7 lg:p-9">
          <p className="eyebrow">{t.aboutEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">{t.aboutTitle}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-400">{t.aboutDesc}</p>
          <ul className="mt-6 grid gap-3 text-sm text-slate-300">
            <li className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">✦ {t.rule1}</li>
            <li className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">✦ {t.rule2}</li>
            <li className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">✦ {t.rule3}</li>
          </ul>
        </article>
        <div className="panel overflow-hidden rounded-[2.5rem] p-3">
          <Image
            src="/chess-arcade.svg"
            alt="Ajedrez competitivo con duelos arcade"
            width={1200}
            height={720}
            className="h-auto w-full rounded-[2rem]"
          />
        </div>
      </section>

      {/* ── Daily Challenges ── */}
      <section className="grid gap-8">
        <div>
          <p className="eyebrow">{t.rankingEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t.rankingTitle}</h2>
        </div>

        {topPlayers.length === 0 ? (
          <p className="text-sm text-slate-400">{t.rankingEmpty}</p>
        ) : (
          <div className="panel overflow-hidden rounded-[2rem]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-6 py-4 font-medium">{t.rankingPosition}</th>
                  <th className="px-6 py-4 font-medium">{t.rankingPlayer}</th>
                  <th className="px-6 py-4 text-right font-medium">{t.rankingWins}</th>
                  <th className="px-6 py-4 text-right font-medium">{t.rankingMatches}</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.map((player, idx) => (
                  <tr key={player.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-3.5 font-mono text-slate-500">{idx + 1}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-amber-400/20 text-xs font-bold text-white">
                          {player.name?.charAt(0) ?? "?"}
                        </div>
                        <span className="font-medium text-white">{player.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-amber-300">{player.wins}</td>
                    <td className="px-6 py-3.5 text-right text-slate-400">{player.matches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Daily Challenges ── */}
      <section className="grid gap-8">
        <div>
          <p className="eyebrow">{t.challengesEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">{t.challengesTitle}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {dailyChallenges.map((challenge) => (
            <article key={challenge.title} className="card-glow panel rounded-[2rem] p-7 transition-transform duration-300 hover:-translate-y-1">
              <p className="eyebrow text-[10px]">{challenge.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">{challenge.description}</p>
              <div className="mt-5 flex items-center gap-2">
                <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1 text-sm font-semibold text-amber-300">{challenge.reward}</span>
                <span className="text-xs text-slate-500">{t.challengeReward}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="section-divider" />

      {/* ── Tournaments ── */}
      <section className="grid gap-8">
        <div>
          <p className="eyebrow">{t.tournamentsEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">{t.tournamentsTitle}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <article key={tournament.title} className="card-glow panel rounded-[2rem] p-7 transition-transform duration-300 hover:-translate-y-1">
              <h3 className="text-xl font-bold text-white">{tournament.title}</h3>
              <p className="mt-3 text-sm text-slate-400">{tournament.when}</p>
              <p className="mt-2 text-sm text-slate-400">{t.tournamentFormat}: <span className="text-slate-200">{tournament.type}</span></p>
              <div className="mt-4 rounded-lg border border-amber-400/10 bg-amber-400/[0.04] px-3 py-2">
                <p className="text-sm font-semibold text-amber-300">{t.tournamentPrize}: {tournament.prize}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="grid gap-8">
        <div>
          <p className="eyebrow">{t.testimonialsEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">{t.testimonialsTitle}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="panel rounded-[2rem] p-7 transition-transform duration-300 hover:-translate-y-1">
              <p className="text-sm leading-7 text-slate-300 italic">&ldquo;{testimonial.quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-amber-400/20 text-sm font-bold text-white">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                  <p className="eyebrow text-[9px]">{testimonial.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      
    </div>
  );
}

