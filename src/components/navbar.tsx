"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { useDict } from "./locale-provider";
import { useInterwovenKit } from "@initia/interwovenkit-react";

type NavSession = { name: string; role: string } | null;

type NavbarProps = {
  session: NavSession;
  logoutAction: () => Promise<void>;
};

export function Navbar({ session, logoutAction }: NavbarProps) {
  const pathname = usePathname();
  const dict = useDict();
  const { disconnect: disconnectWallet, isConnected, openConnect, openWallet, initiaAddress } = useInterwovenKit();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setHelpOpen(false);
    setUserOpen(false);
  }, [pathname]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const links = [
    { href: "/", label: dict.nav.home },
    { href: "/lobby", label: dict.nav.lobby },
    ...(session ? [
      { href: "/dashboard", label: dict.nav.dashboard },
    ] : []),
    { href: "/ranking", label: dict.nav.ranking },
    { href: "/transactions", label: dict.nav.transactions },
    ...(session?.role === "ADMIN" ? [{ href: "/admin", label: dict.nav.admin }] : []),
  ];

  const helpLinks = [
    { href: "/ayuda", label: dict.nav.faq },
    { href: "/tutoriales", label: dict.nav.tutorials },
    { href: "/minigames", label: dict.nav.minigames },
    { href: "/ayuda#contacto", label: dict.nav.contactSupport },
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const initials = session?.name
    ? session.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : null;

  function handleLogout() {
    try { disconnectWallet(); } catch {}
    logoutAction();
  }

  return (
    <header className="sticky top-0 z-40">
      {/* ── Primary bar: logo + nav links + auth ── */}
      <div className="border-b border-white/[0.06] bg-[rgba(26,18,11,0.85)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04]">
              <Image
                src="/assets/images/logo.webp"
                alt="PlayChess Arena"
                width={90}
                height={90}
                className="h-7 w-7 object-contain"
                priority
              />
            </div>
            <div className="hidden sm:block">
              <p className="font-display text-sm font-bold leading-tight tracking-tight text-white">
                {dict.nav.brandTitle}
              </p>
            </div>
          </Link>

          {/* Center nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-white/[0.08] text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Help dropdown */}
            <div ref={helpRef} className="relative">
              <button
                type="button"
                onClick={() => setHelpOpen(!helpOpen)}
                className={`flex items-center gap-1 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  pathname.startsWith("/ayuda")
                    ? "bg-white/[0.08] text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {dict.nav.help}
                <svg className={`h-3.5 w-3.5 transition-transform ${helpOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {helpOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 rounded-xl border border-white/[0.08] bg-[rgba(26,18,11,0.97)] backdrop-blur-xl py-1.5 shadow-2xl">
                  {helpLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setHelpOpen(false)}
                      className="block px-4 py-2.5 text-[13px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Right: auth + wallet */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />

            {session ? (
              <div ref={userRef} className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setUserOpen(!userOpen)}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 transition hover:border-white/15"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/15 text-[10px] font-bold text-cyan-200">
                    {initials}
                  </div>
                  <span className="text-[13px] font-medium text-slate-300">{session.name}</span>
                  {session.role !== "USER" && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-300/50">{session.role}</span>
                  )}
                  <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform ${userOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {userOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-white/[0.08] bg-[rgba(26,18,11,0.97)] backdrop-blur-xl py-1.5 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => { isConnected ? openWallet() : openConnect(); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h5.25A2.25 2.25 0 0121 6v6zm-3 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm-12.75 0H3" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 6v12a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-6" /></svg>
                      {isConnected ? dict.nav.manageWallet : dict.nav.connectWallet}
                    </button>
                    {isConnected && initiaAddress && (
                      <p className="truncate px-4 py-1 text-[10px] font-mono text-cyan-400/60">{initiaAddress}</p>
                    )}
                    <div className="my-1 border-t border-white/[0.06]" />
                    <button
                      type="button"
                      onClick={() => {
                        setUserOpen(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-red-400 transition-colors hover:bg-white/[0.06] hover:text-red-300"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      {dict.nav.logout}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/login"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-slate-300 transition hover:border-white/15 hover:text-white"
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
              className="relative z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white transition hover:bg-white/[0.08] md:hidden"
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
          className={`absolute right-0 top-0 h-full w-72 border-l border-white/[0.06] bg-[rgba(26,18,11,0.98)] p-6 pt-20 shadow-[−24px_0_80px_rgba(0,0,0,0.6)] transition-transform duration-300 ${
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

            {/* Help section in mobile */}
            <p className="mt-3 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{dict.nav.help}</p>
            {helpLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-3 pl-6 text-sm font-medium transition-all ${
                  pathname === link.href
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] border border-white/10 text-sm font-bold text-white">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{session.name}</p>
                    {session.role !== "USER" && (
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/50">
                        {session.role}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { isConnected ? openWallet() : openConnect(); }}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 transition-all hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
                >
                  {isConnected ? dict.nav.manageWallet : dict.nav.connectWallet}
                </button>
                {isConnected && initiaAddress && (
                  <p className="truncate text-center text-[10px] font-mono text-cyan-400/60">{initiaAddress}</p>
                )}
                <button
                  type="button"
                  onClick={() => handleLogout()}
                  className="w-full rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                >
                  {dict.nav.logout}
                </button>
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
