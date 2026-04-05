'use client';

import { useActionState } from "react";
import { placeMatchBetAction } from "@/lib/actions";

type BetFormProps = {
  matchId: string;
  hostId: string;
  hostName: string;
  guestId: string;
  guestName: string;
  stakeToken: string;
  labels: {
    pickLabel: string;
    amountLabel: string;
    submitBtn: string;
    hint: string;
  };
};

async function betAction(_prev: string | null, formData: FormData): Promise<string | null> {
  try {
    await placeMatchBetAction(formData);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "No se pudo registrar la apuesta.";
  }
}

export function BetForm({ matchId, hostId, hostName, guestId, guestName, stakeToken, labels }: BetFormProps) {
  const [error, action, isPending] = useActionState(betAction, null);

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="matchId" value={matchId} />
      <label className="block text-sm text-slate-300">
        <span className="mb-2 block">{labels.pickLabel}</span>
        <select name="predictedWinnerId" className="input w-full" defaultValue={hostId}>
          <option value={hostId}>{hostName}</option>
          <option value={guestId}>{guestName}</option>
        </select>
      </label>
      <label className="block text-sm text-slate-300">
        <span className="mb-2 block">{labels.amountLabel}</span>
        <input name="amount" type="number" min="0.01" step="0.01" className="input w-full" placeholder={`10 ${stakeToken}`} required />
      </label>
      {error && (
        <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      <button type="submit" disabled={isPending} className="button-primary w-full px-5 py-3 text-sm disabled:opacity-50">
        {isPending ? "Procesando…" : labels.submitBtn}
      </button>
      <p className="text-xs leading-6 text-slate-400">{labels.hint}</p>
    </form>
  );
}
