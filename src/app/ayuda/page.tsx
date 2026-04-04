import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";

export default async function HelpPage() {
  const locale = await getLocale();
  const { help: t } = getDictionary(locale);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
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

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/lobby"
          className="panel flex flex-col items-center gap-2 rounded-[1.5rem] p-5 text-center transition hover:border-cyan-400/20"
        >
          <span className="text-2xl">♟️</span>
          <span className="text-sm font-semibold text-white">Lobby</span>
          <span className="text-xs text-slate-400">
            {locale === "es" ? "Crea o únete a una partida" : "Create or join a match"}
          </span>
        </Link>
        <Link
          href="/transactions"
          className="panel flex flex-col items-center gap-2 rounded-[1.5rem] p-5 text-center transition hover:border-cyan-400/20"
        >
          <span className="text-2xl">📋</span>
          <span className="text-sm font-semibold text-white">
            {locale === "es" ? "Transacciones" : "Transactions"}
          </span>
          <span className="text-xs text-slate-400">
            {locale === "es" ? "Verifica operaciones onchain" : "Verify onchain operations"}
          </span>
        </Link>
        <a
          href="https://faucet.testnet.initia.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="panel flex flex-col items-center gap-2 rounded-[1.5rem] p-5 text-center transition hover:border-amber-400/20"
        >
          <span className="text-2xl">🪙</span>
          <span className="text-sm font-semibold text-white">
            {locale === "es" ? "Faucet Testnet" : "Testnet Faucet"}
          </span>
          <span className="text-xs text-slate-400">
            {locale === "es" ? "Obtén tokens INIT gratis" : "Get free INIT tokens"}
          </span>
        </a>
      </div>

      {/* FAQ Accordion */}
      <section className="flex flex-col gap-3">
        {t.faq.map((item, i) => (
          <details
            key={i}
            className="group rounded-[1.5rem] border border-white/10 bg-white/[0.02] transition-colors open:border-cyan-400/20 open:bg-cyan-400/[0.02]"
          >
            <summary className="flex cursor-pointer items-center justify-between px-6 py-5 text-sm font-semibold text-white transition group-open:text-cyan-200">
              <span>{item.q}</span>
              <span className="ml-4 shrink-0 text-slate-500 transition group-open:rotate-45 group-open:text-cyan-300">
                +
              </span>
            </summary>
            <div className="px-6 pb-5 text-sm leading-7 text-slate-300 whitespace-pre-line">
              {item.a}
            </div>
          </details>
        ))}
      </section>

      {/* CTA */}
      <section className="panel rounded-[2rem] p-8 text-center">
        <h2 className="text-xl font-bold text-white">
          {locale === "es"
            ? "¿Listo para jugar?"
            : "Ready to play?"}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {locale === "es"
            ? "No necesitas blockchain para empezar. Crea una partida clásica gratuita y aprende jugando."
            : "You don't need blockchain to get started. Create a free classic match and learn by playing."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/lobby"
            className="button-primary px-6 py-3 text-sm"
          >
            {locale === "es" ? "Ir al Lobby" : "Go to Lobby"}
          </Link>
          <Link
            href="/register"
            className="button-secondary px-6 py-3 text-sm text-white"
          >
            {locale === "es" ? "Crear cuenta" : "Sign up"}
          </Link>
        </div>
      </section>
    </div>
  );
}
