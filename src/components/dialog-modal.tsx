"use client";

import { useEffect } from "react";

type DialogTone = "default" | "success" | "danger" | "warning";

type DialogModalProps = {
  open: boolean;
  title: string;
  description?: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  isBusy?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
};

function getToneStyles(tone: DialogTone) {
  switch (tone) {
    case "success":
      return {
        ring: "border-emerald-400/25",
        badge: "border-emerald-400/30 bg-emerald-400/12 text-emerald-200",
        button: "bg-emerald-500 text-white hover:bg-emerald-400",
      };
    case "danger":
      return {
        ring: "border-rose-400/25",
        badge: "border-rose-400/30 bg-rose-400/12 text-rose-200",
        button: "bg-rose-500 text-white hover:bg-rose-400",
      };
    case "warning":
      return {
        ring: "border-amber-400/25",
        badge: "border-amber-400/30 bg-amber-400/12 text-amber-200",
        button: "bg-amber-400 text-slate-950 hover:bg-amber-300",
      };
    default:
      return {
        ring: "border-cyan-400/25",
        badge: "border-cyan-400/30 bg-cyan-400/12 text-cyan-100",
        button: "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
      };
  }
}

export function DialogModal({
  open,
  title,
  description,
  tone = "default",
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  hideCancel = false,
  isBusy = false,
  onClose,
  onConfirm,
}: DialogModalProps) {
  const styles = getToneStyles(tone);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isBusy, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-[1.75rem] border ${styles.ring} bg-[linear-gradient(180deg,rgba(6,13,22,0.98),rgba(9,17,29,0.96))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.22em] ${styles.badge}`}>
              Dialog
            </span>
            <h3 className="mt-4 text-2xl font-semibold text-white">{title}</h3>
            {description ? <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-40"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {!hideCancel ? (
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-40"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm ?? onClose}
            disabled={isBusy}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-40 ${styles.button}`}
          >
            {isBusy ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
