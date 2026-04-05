"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReconcileButton({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    settled: number;
    failed: number;
    unchanged: number;
  } | null>(null);

  async function handleReconcile() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/transactions/reconcile", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al conciliar");
        return;
      }
      const data = await res.json();
      setResult({
        settled: data.settled,
        failed: data.failed,
        unchanged: data.unchanged,
      });
      router.refresh();
    } catch {
      alert("Error de red al conciliar transacciones");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-xs text-slate-400">
          {result.settled} resueltas · {result.failed} fallidas · {result.unchanged} sin cambio
        </span>
      )}
      <button
        onClick={handleReconcile}
        disabled={loading}
        className="button-primary px-4 py-2 text-sm"
      >
        {loading
          ? "Conciliando…"
          : `Conciliar ${pendingCount} pendientes`}
      </button>
    </div>
  );
}
