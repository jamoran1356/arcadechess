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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo + Brand */}
        <Link href="/" className="group flex items-center gap-3 rounded-full pr-3 transition hover:bg-white/5">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-lg transition group-hover:border-cyan-400/30 group-hover:shadow-cyan-900/20">
            <Image
              src="/assets/images/logo.webp"
              alt="PlayChess Arena"
              width={90}
              height={90}
              className="h-9 w-9 object-contain"
              priority
            />
          </div>
          <div className="hidden sm:block">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-200/60">
              {dict.nav.brand}
            </p>
            <p className="font-display text-base font-semibold leading-tight text-white">
              {dict.nav.brandTitle}
            </p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(link.href)
                  ? "text-white bg-white/8"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-gradient-to-r from-amber-300 to-cyan-300" />
              )}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <InterwovenKitConnectButton />
          <LanguageSwitcher />

          {session ? (
            <div className="hidden items-center gap-2 sm:flex">
              {/* User avatar */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-cyan-400/20 border border-white/10 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium leading-tight text-white">{session.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/60">
                  {session.role}
                </p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="ml-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  {dict.nav.logout}
                </button>
              </form>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
              >
                {dict.nav.login}
              </Link>
              <Link
                href="/register"
                className="button-primary px-4 py-1.5 text-sm"
              >
                {dict.nav.register}
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="relative z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:border-white/25 md:hidden"
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

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 md:hidden ${
          mobileOpen ? "visible" : "invisible"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />

        {/* Panel */}
        <div
          className={`absolute right-0 top-0 h-full w-72 border-l border-white/10 bg-[linear-gradient(180deg,rgba(6,13,22,0.98),rgba(9,17,29,0.96))] p-6 pt-20 shadow-2xl transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive(link.href)
                    ? "bg-white/8 text-white border-l-2 border-cyan-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t border-white/10 pt-6">
            {session ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-cyan-400/20 border border-white/10 text-sm font-bold text-white">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{session.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/60">
                      {session.role}
                    </p>
                  </div>
                </div>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
                  >
                    {dict.nav.logout}
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
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
