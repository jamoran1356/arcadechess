"use client";

import { useCallback, useEffect, useState } from "react";

type WalletData = {
  address: string;
  balance: number;
  denom: string;
};

export function AdminPlatformWallet() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/wallet");
      if (res.ok) {
        setWallet(await res.json());
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setSending(true);

    try {
      const res = await fetch("/api/admin/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toAddress: toAddress.trim(), amount: Number(amount) }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, txHash: data.txHash });
        setToAddress("");
        setAmount("");
        // Refresh balance
        void fetchBalance();
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : "Error desconocido" });
    }

    setSending(false);
  }

  return (
    <section className="panel rounded-[2rem] p-6 lg:p-8">
      <p className="eyebrow">Wallet de plataforma</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">Fondos on-chain</h2>
      <p className="mt-3 text-sm leading-7 text-slate-300">
        Balance real de la wallet administradora en la red Initia. Desde aquí puedes retirar fondos acumulados
        (fees y ganancias) a cualquier dirección.
      </p>

      {loading ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
          <svg className="h-5 w-5 animate-spin text-cyan-300" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Consultando balance on-chain...
        </div>
      ) : wallet ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          {/* Balance card */}
          <div className="space-y-4">
            <article className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-200/70">Balance disponible</p>
              <p className="mt-2 text-4xl font-semibold text-emerald-200">
                {wallet.balance.toFixed(6)} {wallet.denom}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Dirección admin</p>
              <p className="mt-2 break-all font-mono text-sm text-cyan-200">{wallet.address}</p>
            </article>
            <button
              type="button"
              onClick={() => void fetchBalance()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar balance
            </button>
          </div>

          {/* Withdraw form */}
          <form onSubmit={handleWithdraw} className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Enviar fondos</h3>
            <label className="grid gap-2 text-sm text-slate-300">
              <span>Dirección destino</span>
              <input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="init1..."
                required
                className="input"
              />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              <span>Monto (INIT)</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.000000"
                min="0.000001"
                step="0.000001"
                required
                className="input"
              />
            </label>

            {result?.success && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm">
                <p className="font-semibold text-emerald-300">Fondos enviados exitosamente</p>
                {result.txHash && (
                  <a
                    href={`https://scan.testnet.initia.xyz/initiation-2/txs/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300 underline hover:text-cyan-200"
                  >
                    Ver transacción en explorador ↗
                  </a>
                )}
              </div>
            )}

            {result && !result.success && (
              <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-300">
                {result.error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="button-primary w-full px-5 py-3 text-sm disabled:opacity-50"
            >
              {sending ? "Enviando..." : "Enviar fondos"}
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-6 text-sm text-rose-300">No se pudo obtener el balance de la wallet.</p>
      )}
    </section>
  );
}
