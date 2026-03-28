'use client';

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, registerAction } from "@/lib/actions";

type AuthFormProps = {
  mode: "login" | "register";
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="button-primary w-full px-6 py-3 text-sm disabled:opacity-70">
      {pending ? "Procesando..." : label}
    </button>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="panel w-full max-w-xl rounded-[2rem] p-8 sm:p-10">
      <p className="eyebrow">{mode === "login" ? "Ingreso" : "Registro"}</p>
      <h1 className="mt-3 text-4xl font-semibold text-white">
        {mode === "login" ? "Entra a la arena" : "Crea tu perfil competitivo"}
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-300">
        {mode === "login"
          ? "Accede a tu lobby, stakes y partidas activas."
          : "Cada usuario obtiene wallet local para Initia, Flow y Solana lista para integracion."}
      </p>

      <div className="mt-8 space-y-5">
        {mode === "register" ? (
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Nombre</span>
            <input name="name" className="input" placeholder="Luna Gambit" />
            {state?.errors?.name?.[0] ? <p className="mt-2 text-sm text-rose-300">{state.errors.name[0]}</p> : null}
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Correo</span>
          <input name="email" type="email" className="input" placeholder="tu@correo.com" />
          {state?.errors?.email?.[0] ? <p className="mt-2 text-sm text-rose-300">{state.errors.email[0]}</p> : null}
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Contrasena</span>
          <input name="password" type="password" className="input" placeholder="********" />
          {state?.errors?.password?.[0] ? <p className="mt-2 text-sm text-rose-300">{state.errors.password[0]}</p> : null}
        </label>
      </div>

      {state?.message ? <p className="mt-4 text-sm text-rose-300">{state.message}</p> : null}

      <div className="mt-8 space-y-4">
        <SubmitButton label={mode === "login" ? "Entrar" : "Registrar cuenta"} />
        <p className="text-sm text-slate-400">
          {mode === "login" ? "Aun no tienes cuenta? " : "Ya tienes cuenta? "}
          <Link href={mode === "login" ? "/register" : "/login"} className="text-cyan-200 hover:text-cyan-100">
            {mode === "login" ? "Registrate" : "Inicia sesion"}
          </Link>
        </p>
      </div>
    </form>
  );
}
