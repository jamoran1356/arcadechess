import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import "./globals.css";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { LocaleProvider } from "@/components/locale-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "PlayChess Arena",
  description: "Chess with captures resolved by arcade duels and onchain stakes.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.15),_transparent_24%),linear-gradient(180deg,_#07111f_0%,_#08131b_55%,_#02060a_100%)] text-stone-100">
        <LocaleProvider locale={locale} dict={dict}>
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:54px_54px] opacity-20" />
          <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10 font-mono text-sm font-semibold text-amber-200">
                  PC
                </span>
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-200/70">
                    {dict.nav.brand}
                  </p>
                  <p className="font-display text-lg font-semibold text-white">
                    {dict.nav.brandTitle}
                  </p>
                </div>
              </Link>

              <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
                <Link href="/" className="transition hover:text-white">
                  {dict.nav.home}
                </Link>
                <Link href="/lobby" className="transition hover:text-white">
                  {dict.nav.lobby}
                </Link>
                <Link href="/dashboard" className="transition hover:text-white">
                  {dict.nav.dashboard}
                </Link>
                <Link href="/arcade-test" className="transition hover:text-white">
                  {dict.nav.arcadeTest}
                </Link>
                {session?.role === "ADMIN" ? (
                  <Link href="/admin" className="transition hover:text-white">
                    {dict.nav.admin}
                  </Link>
                ) : null}
              </nav>

              <div className="flex items-center gap-3">
                <LanguageSwitcher />
                {session ? (
                  <>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium text-white">{session.name}</p>
                      <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                        {session.role}
                      </p>
                    </div>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/35 hover:text-white"
                      >
                        {dict.nav.logout}
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/35 hover:text-white"
                    >
                      {dict.nav.login}
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                    >
                      {dict.nav.register}
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="border-t border-white/10 px-4 py-2 md:hidden">
              <nav className="mx-auto flex w-full max-w-7xl items-center gap-2 overflow-x-auto text-xs text-slate-300">
                <Link href="/" className="rounded-full border border-white/10 px-3 py-1.5 whitespace-nowrap">
                  {dict.nav.home}
                </Link>
                <Link href="/lobby" className="rounded-full border border-white/10 px-3 py-1.5 whitespace-nowrap">
                  {dict.nav.createPlay}
                </Link>
                <Link href="/dashboard" className="rounded-full border border-white/10 px-3 py-1.5 whitespace-nowrap">
                  {dict.nav.dashboard}
                </Link>
                <Link href="/arcade-test" className="rounded-full border border-white/10 px-3 py-1.5 whitespace-nowrap">
                  {dict.nav.arcadeTest}
                </Link>
                {session?.role === "ADMIN" ? (
                  <Link href="/admin" className="rounded-full border border-white/10 px-3 py-1.5 whitespace-nowrap">
                    {dict.nav.admin}
                  </Link>
                ) : null}
              </nav>
            </div>
          </header>

          <main className="relative z-10">{children}</main>
        </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
