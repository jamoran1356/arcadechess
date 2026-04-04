"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adminLoginAction } from "@/lib/actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-white/10 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
    >
      {pending ? "Verificando…" : "Acceder"}
    </button>
  );
}

export default function MesaNegraPage() {
  const [state, formAction] = useActionState(adminLoginAction, undefined);

  return (
    <div className="flex min-h-[calc(100vh-88px)] items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
        <h1 className="text-center text-lg font-semibold text-slate-300">♟</h1>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Email</span>
          <input name="email" type="email" className="input" autoComplete="email" />
          {state?.errors?.email?.[0] ? <p className="mt-1 text-xs text-rose-300">{state.errors.email[0]}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Contraseña</span>
          <input name="password" type="password" className="input" autoComplete="current-password" />
          {state?.errors?.password?.[0] ? <p className="mt-1 text-xs text-rose-300">{state.errors.password[0]}</p> : null}
        </label>

        {state?.message ? <p className="text-center text-sm text-rose-300">{state.message}</p> : null}

        <SubmitBtn />
      </form>
    </div>
  );
}
