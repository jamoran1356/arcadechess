"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { completeProfileAction } from "@/lib/actions";
import { useDict } from "@/components/locale-provider";

function SubmitBtn() {
  const { pending } = useFormStatus();
  const t = useDict();

  return (
    <button
      type="submit"
      disabled={pending}
      className="button-primary w-full px-6 py-3 text-sm disabled:opacity-60"
    >
      {pending ? t.auth.processing : t.completeProfile.saveBtn}
    </button>
  );
}

export function CompleteProfileForm() {
  const [state, formAction] = useActionState(completeProfileAction, undefined);
  const t = useDict();
  const cp = t.completeProfile;

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm text-slate-300">{cp.nameLabel}</span>
        <input name="name" className="input" placeholder={cp.namePlaceholder} required minLength={2} />
        {state?.errors?.name?.[0] ? <p className="mt-2 text-sm text-rose-300">{state.errors.name[0]}</p> : null}
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-slate-300">{cp.emailLabel}</span>
        <input name="email" type="email" className="input" placeholder={cp.emailPlaceholder} />
        <p className="mt-1 text-xs text-slate-500">{cp.emailHint}</p>
        {state?.errors?.email?.[0] ? <p className="mt-2 text-sm text-rose-300">{state.errors.email[0]}</p> : null}
      </label>

      {state?.message ? <p className="text-sm text-rose-300">{state.message}</p> : null}

      <SubmitBtn />
    </form>
  );
}
