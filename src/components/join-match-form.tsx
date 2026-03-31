"use client";

import { useState, useTransition } from "react";
import { joinMatchAction, startSoloMatchAction } from "@/lib/actions";
import { DialogModal } from "@/components/dialog-modal";

type Props = {
  matchId: string;
  stakeAmount: string;
  entryFee: string;
  stakeToken: string;
  network: string;
  isSolo: boolean;
  joinLabel: string;
  startSoloLabel: string;
};

export function JoinMatchForm({
  matchId,
  stakeAmount,
  entryFee,
  stakeToken,
  network,
  isSolo,
  joinLabel,
  startSoloLabel,
}: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const stake = Number(stakeAmount);
  const fee = Number(entryFee);
  const total = (stake + fee).toFixed(6);

  function handleClick() {
    setError(null);
    setShowConfirm(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("matchId", matchId);
        if (isSolo) {
          await startSoloMatchAction(fd);
        } else {
          await joinMatchAction(fd);
        }
      } catch (err: unknown) {
        setShowConfirm(false);
        setError(err instanceof Error ? err.message : "Error al unirse a la partida.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm text-slate-300">
        <p>Stake: <span className="font-semibold text-amber-200">{stakeAmount} {stakeToken}</span></p>
        <p>Fee: <span className="font-semibold text-amber-200">{entryFee} {stakeToken}</span></p>
        <p className="mt-1 text-xs text-slate-400">
          Total a bloquear: {total} {stakeToken}
        </p>
      </div>

      {error ? (
        <div className="w-full rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="button-primary px-6 py-3 text-sm disabled:opacity-60"
      >
        {isPending ? "Procesando..." : isSolo ? startSoloLabel : joinLabel}
      </button>

      <DialogModal
        open={showConfirm}
        title="Confirmar envío al escrow"
        description={`Tus fondos serán congelados en el contrato de escrow de la red ${network} hasta que la partida finalice.`}
        tone="warning"
        confirmLabel={isPending ? "Enviando..." : `Enviar ${total} ${stakeToken} al escrow`}
        cancelLabel="Cancelar"
        isBusy={isPending}
        onClose={() => !isPending && setShowConfirm(false)}
        onConfirm={handleConfirm}
      >
        <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <div className="flex justify-between">
            <span>Stake</span>
            <span className="font-semibold text-amber-200">{stakeAmount} {stakeToken}</span>
          </div>
          <div className="flex justify-between">
            <span>Entry Fee (plataforma)</span>
            <span className="font-semibold text-amber-200">{entryFee} {stakeToken}</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
            <span>Total a congelar en escrow</span>
            <span className="text-cyan-200">{total} {stakeToken}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Los fondos se liberarán automáticamente al ganador cuando la partida termine.
          </p>
        </div>
      </DialogModal>
    </div>
  );
}
