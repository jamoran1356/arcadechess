import { MatchStatus } from "@prisma/client";
import { updateMatchStatusAction } from "@/lib/actions";
import { getAdminMatchesSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminMesasPage() {
  const matches = await getAdminMatchesSnapshot();

  return (
    <div className="panel rounded-[2rem] p-6 lg:p-8">
      <p className="eyebrow">Mesas</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">Control de partidas y estado</h2>

      <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10">
        <table className="w-full min-w-[980px] text-left text-sm text-slate-300">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Partida</th>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Modalidad</th>
              <th className="px-4 py-3">Stake</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Actualizar</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id} className="border-t border-white/10">
                <td className="px-4 py-3">{match.title}</td>
                <td className="px-4 py-3">{match.host.name}</td>
                <td className="px-4 py-3">{match.guest?.name ?? "-"}</td>
                <td className="px-4 py-3">{match.isSolo ? "Solo" : "Versus"}</td>
                <td className="px-4 py-3">{match.stakeAmount.toString()} {match.stakeToken}</td>
                <td className="px-4 py-3">{match.status}</td>
                <td className="px-4 py-3">
                  <form action={updateMatchStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="matchId" value={match.id} />
                    <select name="status" defaultValue={match.status} className="input py-2 text-xs">
                      {Object.values(MatchStatus).map((status) => (
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
