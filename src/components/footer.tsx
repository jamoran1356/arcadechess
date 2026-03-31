"use client";

import Link from "next/link";
import { useDict } from "./locale-provider";

export function Footer() {
  const dict = useDict();

  return (
    <footer className="relative z-10 border-t border-white/8 bg-slate-950/60 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-4 py-10 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <p className="font-display text-sm font-semibold text-white">PlayChess Arena</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
            {dict.nav.brand}
          </p>
        </div>

        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <Link href="/" className="transition hover:text-slate-300">{dict.nav.home}</Link>
          <Link href="/lobby" className="transition hover:text-slate-300">{dict.nav.lobby}</Link>
          <Link href="/dashboard" className="transition hover:text-slate-300">{dict.nav.dashboard}</Link>
          <Link href="/arcade-test" className="transition hover:text-slate-300">{dict.nav.arcadeTest}</Link>
        </nav>

        <p className="font-mono text-[10px] tracking-wider text-slate-600">
          &copy; {new Date().getFullYear()} PlayChess
        </p>
      </div>
    </footer>
  );
}
