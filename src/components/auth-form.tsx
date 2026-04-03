'use client';

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { loginAction, registerAction, walletAuthAction } from "@/lib/actions";
import { useDict } from "@/components/locale-provider";

type AuthFormProps = {
  mode: "login" | "register";
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useDict();

  return (
    <button type="submit" disabled={pending} className="button-primary w-full px-6 py-3 text-sm disabled:opacity-70">
      {pending ? t.auth.processing : label}
    </button>
  );
}

/* ── Initia network logo (inline SVG) ── */
function InitiaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#1A1B2E" />
      <path
        d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6Zm0 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm2.5 12.5h-5a.75.75 0 0 1 0-1.5h1.75v-6h-1.25a.75.75 0 0 1 0-1.5H16a.75.75 0 0 1 .75.75V20h1.75a.75.75 0 0 1 0 1.5Z"
        fill="url(#initia_g)"
      />
      <defs>
        <linearGradient id="initia_g" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Wallet login section ── */
function WalletSection() {
  const { isConnected, openConnect, initiaAddress } = useInterwovenKit();
  const [walletPending, startWalletTransition] = useTransition();
  const [walletError, setWalletError] = useState<string | null>(null);
  const router = useRouter();
  const t = useDict();
  const a = t.auth;

  function handleWalletAuth() {
    if (!initiaAddress) return;
    setWalletError(null);

    startWalletTransition(async () => {
      const result = await walletAuthAction(initiaAddress);
      if ("error" in result) {
        setWalletError(result.error);
        return;
      }
      router.push(result.needsProfile ? "/complete-profile" : "/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <InitiaLogo className="h-8 w-8 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">{a.walletTitle}</p>
          <p className="text-xs text-slate-400">{a.walletHint}</p>
        </div>
      </div>

      {!isConnected ? (
        <button
          type="button"
          onClick={openConnect}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-6 py-3 text-sm font-medium text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/20"
        >
          <InitiaLogo className="h-5 w-5" />
          {a.walletConnect}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="truncate font-mono text-xs text-emerald-200">{initiaAddress}</span>
          </div>
          <button
            type="button"
            onClick={handleWalletAuth}
            disabled={walletPending}
            className="button-primary flex w-full items-center justify-center gap-2 px-6 py-3 text-sm disabled:opacity-60"
          >
            {walletPending ? a.processing : a.walletEnter}
          </button>
        </div>
      )}

      {walletError ? <p className="text-sm text-rose-300">{walletError}</p> : null}
    </div>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction] = useActionState(action, undefined);
  const t = useDict();
  const a = t.auth;

  return (
    <div className="panel w-full max-w-xl rounded-[2rem] p-8 sm:p-10">
      <p className="eyebrow">{mode === "login" ? a.loginEyebrow : a.registerEyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold text-white">
        {mode === "login" ? a.loginTitle : a.registerTitle}
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-300">
        {mode === "login" ? a.loginSubtitle : a.registerSubtitle}
      </p>

      {/* ── Wallet auth ── */}
      <div className="mt-8">
        <WalletSection />
      </div>

      {/* ── Divider ── */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.08]" />
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{a.orDivider}</span>
        <div className="h-px flex-1 bg-white/[0.08]" />
      </div>

      {/* ── Email / password form ── */}
      <form action={formAction} className="space-y-5">
        {mode === "register" ? (
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">{a.nameLabel}</span>
            <input name="name" className="input" placeholder={a.namePlaceholder} />
            {state?.errors?.name?.[0] ? <p className="mt-2 text-sm text-rose-300">{state.errors.name[0]}</p> : null}
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">{a.emailLabel}</span>
          <input name="email" type="email" className="input" placeholder={a.emailPlaceholder} />
          {state?.errors?.email?.[0] ? <p className="mt-2 text-sm text-rose-300">{state.errors.email[0]}</p> : null}
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">{a.passwordLabel}</span>
          <input name="password" type="password" className="input" placeholder="********" />
          {state?.errors?.password?.[0] ? <p className="mt-2 text-sm text-rose-300">{state.errors.password[0]}</p> : null}
        </label>

        {state?.message ? <p className="mt-4 text-sm text-rose-300">{state.message}</p> : null}

        <div className="space-y-4 pt-2">
          <SubmitButton label={mode === "login" ? a.loginBtn : a.registerBtn} />
          <p className="text-sm text-slate-400">
            {mode === "login" ? a.noAccount : a.hasAccount}{" "}
            <Link href={mode === "login" ? "/register" : "/login"} className="text-cyan-200 hover:text-cyan-100">
              {mode === "login" ? a.goRegister : a.goLogin}
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
