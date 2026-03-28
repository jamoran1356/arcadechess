import { UserRole } from "@prisma/client";
import { deleteUserAction, updateUserAction } from "@/lib/actions";
import { getAdminUsersSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminClientesPage() {
  const users = await getAdminUsersSnapshot();

  return (
    <div className="panel rounded-[2rem] p-6 lg:p-8">
      <p className="eyebrow">Clientes</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">Gestion de usuarios</h2>

      <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10">
        <table className="w-full min-w-[860px] text-left text-sm text-slate-300">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Wallets</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-white/10 align-top">
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <form action={updateUserAction} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <select name="role" defaultValue={user.role} className="input py-2 text-xs">
                      {Object.values(UserRole).map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="button-secondary px-3 py-2 text-xs text-white">
                      Guardar
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <div className="grid gap-2">
                    {user.wallets.map((wallet) => (
                      <span key={wallet.id} className="rounded-lg bg-white/6 px-2 py-1 text-xs">
                        {wallet.network}: {wallet.balance}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <form action={deleteUserAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" className="rounded-lg border border-rose-300/30 px-3 py-2 text-xs text-rose-200 hover:border-rose-200/50">
                      Eliminar
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
