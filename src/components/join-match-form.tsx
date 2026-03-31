"use client";

import { useState, useTransition } from "react";
import { joinMatchAction, startSoloMatchAction } from "@/lib/actions";
import { DialogModal } from "@/components/dialog-modal";
import { useEscrowTx } from "@/hooks/use-escrow-tx";
import { getInitiaExplorerTxUrl } from "@/lib/explorer";

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
  const [escrowTxHash, setEscrowTxHash] = useState<string | null>(null);
  const { sendToEscrow, isWalletConnected } = useEscrowTx();

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

        // Sign real on-chain tx for INITIA network
        if (network === "INITIA" && isWalletConnected) {
          const txHash = await sendToEscrow(Number(total), `playchess:${isSolo ? "solo" : "join"}:${matchId}`);
          setEscrowTxHash(txHash);
          return; // Show explorer link, wait for user to continue
        }

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

  function handleContinueAfterTx() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("matchId", matchId);
        fd.set("escrowTxHash", escrowTxHash!);

        if (isSolo) {
          await startSoloMatchAction(fd);
        } else {
          await joinMatchAction(fd);
        }
      } catch (err: unknown) {
        setShowConfirm(false);
        setEscrowTxHash(null);
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
        title={escrowTxHash ? "Transacción confirmada" : "Confirmar envío al escrow"}
        description={
          escrowTxHash
            ? "Tu depósito fue registrado en la blockchain. Puedes verificarlo en el explorador."
            : `Tus fondos serán congelados en el contrato de escrow de la red ${network} hasta que la partida finalice.`
        }
        tone={escrowTxHash ? "success" : "warning"}
        confirmLabel={
          escrowTxHash
            ? isPending ? "Entrando..." : "Continuar y entrar a la partida"
            : isPending ? "Enviando..." : `Enviar ${total} ${stakeToken} al escrow`
        }
        cancelLabel="Cancelar"
        isBusy={isPending}
        onClose={() => { if (!isPending) { setShowConfirm(false); setEscrowTxHash(null); } }}
        onConfirm={escrowTxHash ? handleContinueAfterTx : handleConfirm}
      >
        {escrowTxHash ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/></svg>
              <span>Depósito de <strong>{total} {stakeToken}</strong> confirmado</span>
            </div>
            {(() => {
              const url = getInitiaExplorerTxUrl(escrowTxHash);
              return url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                >
                  <span className="font-mono text-xs truncate mr-3">{escrowTxHash.slice(0, 16)}…{escrowTxHash.slice(-8)}</span>
                  <span className="shrink-0 font-semibold">Ver en explorador ↗</span>
                </a>
              ) : null;
            })()}
          </div>
        ) : (
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
        )}
      </DialogModal>
    </div>
  );
}
