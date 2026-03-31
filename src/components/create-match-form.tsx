"use client";

import { useRef, useState, useTransition } from "react";
import { ArcadeGameType, TransactionNetwork } from "@prisma/client";
import { createMatchAction } from "@/lib/actions";
import { DialogModal } from "@/components/dialog-modal";
import { useEscrowTx } from "@/hooks/use-escrow-tx";

type WalletInfo = { id: string; network: string; balance: string };

type Props = {
  wallets: WalletInfo[];
  arcadeLibrary: { id: string; name: string; blurb: string }[];
  labels: {
    publishEyebrow: string;
    publishTitle: string;
    modeVersus: string;
    modeSolo: string;
    stakeLabel: string;
    feeLabel: string;
    clockLabel: string;
    clockNote: string;
    arcadeLibrary: string;
    createBtn: string;
  };
};

export function CreateMatchForm({ wallets, arcadeLibrary, labels: t }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState({ stake: "0", fee: "0", total: "0", token: "INIT", network: "INITIA", walletBalance: "0" });
  const { sendToEscrow, isWalletConnected } = useEscrowTx();

  function handleSubmitClick(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const form = formRef.current;
    if (!form) return;

    const fd = new FormData(form);
    const stake = Number(fd.get("stakeAmount") ?? 0);
    const fee = Number(fd.get("entryFee") ?? 0);
    const token = String(fd.get("stakeToken") ?? "INIT");
    const network = String(fd.get("network") ?? "INITIA");

    if (stake <= 0) {
      setError("Debes establecer un monto de stake mayor a 0.");
      return;
    }

    const total = stake + fee;
    const wallet = wallets.find((w) => w.network === network);
    const walletBalance = wallet ? Number(wallet.balance).toFixed(6) : "0.000000";

    setPreview({
      stake: stake.toFixed(6),
      fee: fee.toFixed(6),
      total: total.toFixed(6),
      token,
      network,
      walletBalance,
    });
    setShowConfirm(true);
  }

  function handleConfirm() {
    const form = formRef.current;
    if (!form) return;

    startTransition(async () => {
      try {
        const fd = new FormData(form);
        const network = String(fd.get("network") ?? "INITIA");

        // Sign real on-chain tx for INITIA network
        if (network === "INITIA" && isWalletConnected) {
          const total = Number(preview.total);
          const txHash = await sendToEscrow(total, `playchess:create`);
          fd.set("escrowTxHash", txHash);
        }

        await createMatchAction(fd);
      } catch (err: unknown) {
        setShowConfirm(false);
        setError(err instanceof Error ? err.message : "Error al crear la partida.");
      }
    });
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmitClick} className="mt-8 grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <input type="radio" name="isSolo" value="false" defaultChecked />
            {t.modeVersus}
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <input type="radio" name="isSolo" value="true" />
            {t.modeSolo}
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <input name="stakeAmount" type="number" min="0" step="0.01" className="input" placeholder={t.stakeLabel} required />
          <input name="entryFee" type="number" min="0" step="0.01" className="input" placeholder={t.feeLabel} defaultValue="0" required />
          <input name="stakeToken" className="input" defaultValue="INIT" />
          <select name="network" className="input" defaultValue={TransactionNetwork.INITIA}>
            {Object.values(TransactionNetwork).map((network) => (
              <option key={network} value={network}>{network}</option>
            ))}
          </select>
        </div>

        {wallets.length > 0 ? (
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            {wallets.map((w) => (
              <span key={w.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1">
                {w.network}: <span className="font-semibold text-slate-200">{Number(w.balance).toFixed(2)}</span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-300">
            {t.clockLabel}
            <input name="gameClockMinutes" type="number" min="1" max="30" step="1" className="input" defaultValue="5" required />
          </label>
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            {t.clockNote}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{t.arcadeLibrary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {arcadeLibrary.map((game) => (
              <label key={game.id} className="rounded-[1.25rem] border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-200">
                <input type="checkbox" name="arcadeGamePool" value={game.id as ArcadeGameType} defaultChecked={game.id !== ArcadeGameType.KEY_CLASH} className="mr-2" />
                {game.name}
                <p className="mt-2 text-xs leading-6 text-slate-400">{game.blurb}</p>
              </label>
            ))}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={isPending} className="button-primary mt-2 px-6 py-3 text-sm disabled:opacity-60">
          {isPending ? "Procesando..." : t.createBtn}
        </button>
      </form>

      <DialogModal
        open={showConfirm}
        title="Confirmar envío de fondos"
        description={`Se debitarán fondos de tu wallet ${preview.network} para crear la partida.`}
        tone="warning"
        confirmLabel={isPending ? "Enviando..." : `Enviar ${preview.total} ${preview.token}`}
        cancelLabel="Cancelar"
        isBusy={isPending}
        onClose={() => !isPending && setShowConfirm(false)}
        onConfirm={handleConfirm}
      >
        <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <div className="flex justify-between">
            <span>Stake</span>
            <span className="font-semibold text-amber-200">{preview.stake} {preview.token}</span>
          </div>
          <div className="flex justify-between">
            <span>Entry Fee</span>
            <span className="font-semibold text-amber-200">{preview.fee} {preview.token}</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
            <span>Total a bloquear</span>
            <span className="text-cyan-200">{preview.total} {preview.token}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Tu saldo ({preview.network})</span>
            <span>{preview.walletBalance} {preview.token}</span>
          </div>
        </div>
      </DialogModal>
    </>
  );
}
