"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { InterwovenKitConnectButton } from "./interwovenkit-connect-button";
import { LanguageSwitcher } from "./language-switcher";
import { useDict } from "./locale-provider";

type NavSession = { name: string; role: string } | null;

type NavbarProps = {
  session: NavSession;
  logoutAction: () => Promise<void>;
};

export function Navbar({ session, logoutAction }: NavbarProps) {
  const pathname = usePathname();
  const dict = useDict();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const links = [
    { href: "/", label: dict.nav.home },
    { href: "/lobby", label: dict.nav.lobby },
    { href: "/dashboard", label: dict.nav.dashboard },
    { href: "/arcade-test", label: dict.nav.arcadeTest },
    ...(session?.role === "ADMIN" ? [{ href: "/admin", label: dict.nav.admin }] : []),
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const initials = session?.name
    ? session.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : null;

  return (
    <header className="sticky top-0 z-40">
      {/* Top accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

      <div className="border-b border-white/[0.06] bg-[rgba(3,7,17,0.7)] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo + Brand */}
          <Link href="/" className="group flex items-center gap-3 rounded-xl pr-3 transition-all hover:bg-white/[0.03]">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-amber-500/10 shadow-lg transition-all group-hover:border-cyan-400/30 group-hover:shadow-cyan-900/30">
              <Image
                src="/assets/images/logo.webp"
                alt="PlayChess Arena"
                width={90}
                height={90}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
            <div className="hidden sm:block">
              <p className="eyebrow text-[9px]">
                {dict.nav.brand}
              </p>
              <p className="font-display text-sm font-bold leading-tight tracking-tight text-white">
                {dict.nav.brandTitle}
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`group relative rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all duration-200 ${
                  isActive(link.href)
                    ? "text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {isActive(link.href) && (
                  <span className="absolute inset-0 rounded-lg bg-white/[0.07]" />
                )}
                <span className="relative">{link.label}</span>
                {isActive(link.href) && (
                  <span className="absolute inset-x-2 -bottom-[13px] h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-amber-400" />
                )}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <InterwovenKitConnectButton />
            <LanguageSwitcher />

            {session ? (
              <div className="hidden items-center gap-3 sm:flex">
                <div className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] py-1.5 pl-1.5 pr-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/25 to-cyan-400/25 text-[11px] font-bold text-white shadow-inner">
                    {initials}
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-medium leading-none text-white">{session.name}</p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/50">
                      {session.role}
                    </p>
                  </div>
                </div>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition-all hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
                  >
                    {dict.nav.logout}
                  </button>
                </form>
              </div>
            ) : (
              <div className="hidden items-center gap-2.5 sm:flex">
                <Link
                  href="/login"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-slate-300 transition-all hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
                >
                  {dict.nav.login}
                </Link>
                <Link
                  href="/register"
                  className="button-primary px-4 py-1.5 text-[13px]"
                >
                  {dict.nav.register}
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="relative z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white transition-all hover:border-white/15 hover:bg-white/[0.08] md:hidden"
              aria-label="Menu"
            >
              <div className="flex w-4 flex-col items-center gap-[5px]">
                <span className={`block h-[2px] w-full rounded-full bg-current transition-all duration-300 ${mobileOpen ? "translate-y-[7px] rotate-45" : ""}`} />
                <span className={`block h-[2px] w-full rounded-full bg-current transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`} />
                <span className={`block h-[2px] w-full rounded-full bg-current transition-all duration-300 ${mobileOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 md:hidden ${
          mobileOpen ? "visible" : "invisible"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />

        <div
          className={`absolute right-0 top-0 h-full w-72 border-l border-white/[0.06] bg-[linear-gradient(180deg,rgba(3,7,17,0.98),rgba(6,12,22,0.96))] p-6 pt-20 shadow-[−24px_0_80px_rgba(0,0,0,0.6)] transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive(link.href)
                    ? "bg-white/[0.06] text-white border-l-2 border-cyan-400"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t border-white/[0.06] pt-6">
            {session ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-cyan-400/20 border border-white/10 text-sm font-bold text-white">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{session.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/50">
                      {session.role}
                    </p>
                  </div>
                </div>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 transition-all hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
                  >
                    {dict.nav.logout}
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-center text-sm text-slate-300 transition-all hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
                >
                  {dict.nav.login}
                </Link>
                <Link
                  href="/register"
                  className="button-primary px-4 py-2.5 text-center text-sm"
                >
                  {dict.nav.register}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
