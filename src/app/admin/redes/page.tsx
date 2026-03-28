import { TransactionNetwork } from "@prisma/client";
import { updateWalletNetworkAction } from "@/lib/actions";
import { getAdminNetworksSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminRedesPage() {
  const wallets = await getAdminNetworksSnapshot();

  return (
    <div className="panel rounded-[2rem] p-6 lg:p-8">
      <p className="eyebrow">Redes</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">Billeteras y redes activas</h2>

      <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm text-slate-300">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Direccion</th>
              <th className="px-4 py-3">Red</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3">Accion</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((wallet) => (
              <tr key={wallet.id} className="border-t border-white/10 align-top">
                <td className="px-4 py-3">{wallet.user.name}</td>
                <td className="px-4 py-3 break-all">{wallet.address}</td>
                <td className="px-4 py-3">{wallet.network}</td>
                <td className="px-4 py-3">{wallet.balance}</td>
                <td className="px-4 py-3">
                  <form action={updateWalletNetworkAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="walletId" value={wallet.id} />
                    <select name="network" defaultValue={wallet.network} className="input py-2 text-xs">
                      {Object.values(TransactionNetwork).map((network) => (
                        <option key={network} value={network}>
                          {network}
                        </option>
                      ))}
                    </select>
                    <input name="balance" type="number" step="0.01" min="0" defaultValue={wallet.balance} className="input py-2 text-xs" />
                    <button type="submit" className="button-secondary px-3 py-2 text-xs text-white">
                      Actualizar
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
