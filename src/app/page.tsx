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
          <p className="eyebrow">Initia x Flow x Solana</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Ajedrez competitivo con duelos arcade y stakes onchain.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200 sm:text-xl">
            Cada captura se juega dos veces: en el tablero y en una arena arcade de reflejos. Si ganas el duelo, la jugada vive. Si pierdes, se desvanece.
          </p>

          <div className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={session ? "/lobby#create-match" : "/register"} className="button-primary px-7 py-3 text-center">
              {session ? "Crear partida" : "Crear cuenta y jugar"}
            </Link>
            <Link href="#como-jugar" className="button-secondary px-7 py-3 text-center text-slate-100">
              Cómo jugar
            </Link>
          </div>

          <div className="mt-10 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/20 bg-black/40 p-4 backdrop-blur-sm">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200/70">Usuarios</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.usersCount}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-black/40 p-4 backdrop-blur-sm">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200/70">Transacciones</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.transactionsCount}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-black/40 p-4 backdrop-blur-sm">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200/70">Partidas vivas</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.availableMatches}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="como-jugar" className="grid gap-6">
        <div>
          <p className="eyebrow">Guía rápida</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Empieza a jugar en 3 pasos</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <article className="panel rounded-[1.75rem] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">Paso 1</p>
            <h3 className="mt-3 text-xl font-semibold text-white">Crea o entra a una mesa</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">Ve al Lobby, publica tu partida con stake o únete a una abierta.</p>
            <Link href={session ? "/lobby#create-match" : "/register"} className="mt-5 inline-flex text-sm text-cyan-200 hover:text-cyan-100">Ir al lobby</Link>
          </article>
          <article className="panel rounded-[1.75rem] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">Paso 2</p>
            <h3 className="mt-3 text-xl font-semibold text-white">Juega en el tablero</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">Cuando intentes capturar, el sistema abrirá un duelo arcade para validar la jugada.</p>
            <Link href="/arcade-test" className="mt-5 inline-flex text-sm text-cyan-200 hover:text-cyan-100">Probar minijuegos</Link>
          </article>
          <article className="panel rounded-[1.75rem] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">Paso 3</p>
            <h3 className="mt-3 text-xl font-semibold text-white">Sigue tu progreso</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">Revisa wallets, partidas y actividad en Dashboard para mejorar tu estrategia.</p>
            <Link href={session ? "/dashboard" : "/login"} className="mt-5 inline-flex text-sm text-cyan-200 hover:text-cyan-100">Abrir dashboard</Link>
          </article>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <article className="panel rounded-[2rem] p-6 lg:p-8">
          <p className="eyebrow">Tematica</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Un metajuego entre estrategia y reflejos</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            PlayChess mezcla la profundidad del ajedrez clasico con una segunda capa competitiva: cada intento de captura abre una arena arcade sincronizada donde ambos jugadores se enfrentan por la validez de ese ataque.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">Fase 1</p>
              <p className="mt-2 text-sm text-slate-200">Planifica la jugada en el tablero</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">Fase 2</p>
              <p className="mt-2 text-sm text-slate-200">Compite en el duelo arcade</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">Fase 3</p>
              <p className="mt-2 text-sm text-slate-200">Liquida resultado onchain</p>
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
            <p className="eyebrow">Landing en vivo</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Partidas disponibles y tematica del juego</h2>
          </div>
          <Link href="/lobby" className="text-sm text-cyan-200 hover:text-cyan-100">
            Abrir lobby completo
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {openMatches.length > 0 ? (
            openMatches.map((match) => (
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
                  {match.arcadeGamePool.map((game) => (
                    <span key={game} className="rounded-full bg-white/6 px-3 py-1">
                      {game.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Stake</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-200">
                      {match.stakeAmount} {match.stakeToken}
                    </p>
                  </div>
                  <Link href={`/match/${match.id}`} className="button-secondary px-4 py-2 text-sm text-white">
                    Ver mesa
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <article className="panel rounded-[1.75rem] p-6 lg:col-span-3">
              <h3 className="text-2xl font-semibold text-white">Todavía no hay partidas activas</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">Sé el primero en abrir una mesa: define stake, red y minijuegos para iniciar el lobby.</p>
              <Link href={session ? "/lobby#create-match" : "/register"} className="button-primary mt-5 inline-flex px-5 py-2 text-sm">
                {session ? "Crear primera partida" : "Registrarme y crear"}
              </Link>
            </article>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {networks.map((network) => (
          <article key={network.id} className="panel rounded-[1.75rem] p-6">
            <p className="eyebrow">Red de pagos</p>
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
          <p className="eyebrow">Acerca de PlayChess</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">La temática: estrategia, tensión y show competitivo</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Diseñamos PlayChess como una experiencia de arena: no basta con encontrar la mejor línea del tablero, también debes ejecutar bajo presión en duelos arcade para validar capturas críticas. Eso crea un juego más narrativo, más intenso y más divertido para espectadores y jugadores.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-slate-200">
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">Reglas claras: la captura solo se confirma si el duelo arcade se gana.</li>
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">Aprendizaje real: combina cálculo posicional + reacción y memoria.</li>
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">Economía de stakes: cada decisión tiene impacto competitivo y financiero.</li>
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
          <p className="eyebrow">Retos del día</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">El sistema te propone objetivos para jugar y aprender</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {dailyChallenges.map((challenge) => (
            <article key={challenge.title} className="panel rounded-[1.75rem] p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">{challenge.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{challenge.description}</p>
              <p className="mt-5 text-sm font-semibold text-amber-200">Recompensa: {challenge.reward}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <div>
          <p className="eyebrow">Torneos</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Calendario competitivo semanal</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <article key={tournament.title} className="panel rounded-[1.75rem] p-6">
              <h3 className="text-2xl font-semibold text-white">{tournament.title}</h3>
              <p className="mt-3 text-sm text-slate-300">{tournament.when}</p>
              <p className="mt-2 text-sm text-slate-300">Formato: {tournament.type}</p>
              <p className="mt-2 text-sm font-semibold text-amber-200">Premio: {tournament.prize}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <div>
          <p className="eyebrow">Testimonios</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Lo que dice la comunidad</h2>
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
          <p className="eyebrow">Planes</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Elige cómo quieres competir</h2>
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

