import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import "./globals.css";

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
  description: "Ajedrez con capturas resueltas por duelos arcade y stakes onchain.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html
      lang="es"
      className={`${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.15),_transparent_24%),linear-gradient(180deg,_#07111f_0%,_#08131b_55%,_#02060a_100%)] text-stone-100">
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
                    Arcade Chess Engine
                  </p>
                  <p className="font-display text-lg font-semibold text-white">
                    PlayChess Arena
                  </p>
                </div>
              </Link>

              <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
                <Link href="/lobby" className="transition hover:text-white">
                  Lobby
                </Link>
                <Link href="/dashboard" className="transition hover:text-white">
                  Dashboard
                </Link>
                <Link href="/arcade-test" className="transition hover:text-white">
                  Arcade Test
                </Link>
                {session?.role === "ADMIN" ? (
                  <Link href="/admin" className="transition hover:text-white">
                    Admin
                  </Link>
                ) : null}
              </nav>

              <div className="flex items-center gap-3">
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
                        Salir
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/35 hover:text-white"
                    >
                      Ingresar
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                    >
                      Crear cuenta
                    </Link>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="relative z-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
