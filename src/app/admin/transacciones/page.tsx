import { TransactionStatus } from "@prisma/client";
import { updateTransactionAction } from "@/lib/actions";
import { getAdminTransactionsSnapshot } from "@/lib/data";
import { ReconcileButton } from "./reconcile-button";

export const dynamic = "force-dynamic";

export default async function AdminTransaccionesPage() {
  const transactions = await getAdminTransactionsSnapshot();
  const pendingCount = transactions.filter((t) => t.status === "PENDING").length;

  return (
    <div className="panel rounded-[2rem] p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Transacciones</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Control de movimientos onchain</h2>
        </div>
        {pendingCount > 0 && <ReconcileButton pendingCount={pendingCount} />}
      </div>

      <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10">
        <table className="w-full min-w-[920px] text-left text-sm text-slate-300">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Jugador</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Red</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Actualizar</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-t border-white/10">
                <td className="px-4 py-3">{transaction.user.name}</td>
                <td className="px-4 py-3">{transaction.type.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{transaction.network}</td>
                <td className="px-4 py-3">{transaction.amount.toString()} {transaction.token}</td>
                <td className="px-4 py-3">{transaction.status}</td>
                <td className="px-4 py-3">
                  <form action={updateTransactionAction} className="flex items-center gap-2">
                    <input type="hidden" name="transactionId" value={transaction.id} />
                    <select name="status" defaultValue={transaction.status} className="input py-2 text-xs">
                      {Object.values(TransactionStatus).map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="button-secondary px-3 py-2 text-xs text-white">
                      Guardar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
