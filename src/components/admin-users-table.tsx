'use client';

import { useState, useTransition } from "react";
import { UserRole } from "@prisma/client";
import { deleteUserAction, updateUserAction, banUserAction, unbanUserAction } from "@/lib/actions";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  rating: number;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
  wallets: { id: string; network: string; address: string; balance: string }[];
  _count: { hostedMatches: number; joinedMatches: number; wonMatches: number; transactions: number };
};

/* ------ Eye icon (detail modal) ------ */
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.01 9.964 7.178a1.01 1.01 0 010 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.01-9.964-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/* ------ Trash icon (delete) ------ */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  USER: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  MODERATOR: "border-violet-400/30 bg-violet-400/10 text-violet-300",
};

/* ====================================================================
   Main exported component
   ==================================================================== */
export function AdminUsersTable({ users }: { users: UserRow[] }) {
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isBanning, startBanTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    const fd = new FormData();
    fd.set("userId", deleteTarget.id);
    startDeleteTransition(async () => {
      await deleteUserAction(fd);
      setDeleteTarget(null);
    });
  }

  return (
    <>
      {/* Table */}
      <div className="overflow-x-auto rounded-[1.5rem] border border-white/10 bg-white/[0.02]">
        <table className="w-full min-w-[700px] text-left text-sm text-slate-300">
          <thead className="bg-white/5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Usuario</th>
              <th className="px-5 py-3.5">Rol</th>
              <th className="px-5 py-3.5 text-center">Partidas</th>
              <th className="px-5 py-3.5 text-center">Rating</th>
              <th className="px-5 py-3.5">Registro</th>
              <th className="px-5 py-3.5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-white/[0.06] transition hover:bg-white/[0.025]">
                {/* Name + Email */}
                <td className="px-5 py-4">
                  <p className="font-medium text-white">{user.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                  {user.bannedAt && (
                    <span className="mt-1 inline-block rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                      BANEADO
                    </span>
                  )}
                </td>

                {/* Role */}
                <td className="px-5 py-4">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_COLORS[user.role] ?? "text-slate-400"}`}>
                    {user.role}
                  </span>
                </td>

                {/* Matches */}
                <td className="px-5 py-4 text-center">
                  <span className="font-mono text-xs text-slate-300">{user._count.hostedMatches + user._count.joinedMatches}</span>
                  {user._count.wonMatches > 0 && (
                    <span className="ml-1 text-[10px] text-emerald-400">({user._count.wonMatches}W)</span>
                  )}
                </td>

                {/* Rating */}
                <td className="px-5 py-4 text-center font-mono text-xs text-amber-300">{user.rating}</td>

                {/* Registration date */}
                <td className="px-5 py-4 font-mono text-xs text-slate-500">{formatDate(user.createdAt)}</td>

                {/* Actions */}
                <td className="px-5 py-4">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDetailUser(user)}
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-300"
                      title="Ver detalle"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBanTarget(user)}
                      className={`rounded-lg border p-2 transition ${
                        user.bannedAt
                          ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-400 hover:border-emerald-400/40"
                          : "border-amber-400/20 bg-amber-400/5 text-amber-400 hover:border-amber-400/40"
                      }`}
                      title={user.bannedAt ? "Desbanear" : "Banear"}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(user)}
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-rose-400/30 hover:text-rose-300"
                      title="Eliminar"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  No hay usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---- Detail modal ---- */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDetailUser(null)}>
          <div className="relative mx-4 w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setDetailUser(null)} className="absolute right-4 top-4 text-slate-500 hover:text-white">✕</button>

            <p className="eyebrow">Detalle del usuario</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{detailUser.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{detailUser.email}</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Stat label="Rating" value={String(detailUser.rating)} />
              <Stat label="Rol" value={detailUser.role} />
              <Stat label="Partidas creadas" value={String(detailUser._count.hostedMatches)} />
              <Stat label="Partidas unidas" value={String(detailUser._count.joinedMatches)} />
              <Stat label="Victorias" value={String(detailUser._count.wonMatches)} />
              <Stat label="Transacciones" value={String(detailUser._count.transactions)} />
            </div>

            {/* Wallets */}
            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Wallets</p>
              {detailUser.wallets.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">Sin wallets vinculadas</p>
              ) : (
                <div className="mt-2 grid gap-2">
                  {detailUser.wallets.map((w) => (
                    <div key={w.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div>
                        <span className="text-[10px] font-semibold uppercase text-cyan-400">{w.network}</span>
                        <p className="mt-0.5 font-mono text-xs text-slate-300" title={w.address}>
                          {w.address.length > 30 ? `${w.address.slice(0, 14)}…${w.address.slice(-8)}` : w.address}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-amber-300">{w.balance}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inline role update */}
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Cambiar rol</p>
              <form action={updateUserAction} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={detailUser.id} />
                <select name="role" defaultValue={detailUser.role} className="input flex-1 py-2 text-xs">
                  {Object.values(UserRole).map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <button type="submit" className="button-secondary px-4 py-2 text-xs text-white">Guardar</button>
              </form>
            </div>

            <p className="mt-4 text-right text-[10px] text-slate-600">
              Registrado el {formatDate(detailUser.createdAt)}
            </p>
          </div>
        </div>
      )}

      {/* ---- Delete confirmation modal ---- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setDeleteTarget(null)}>
          <div className="relative mx-4 w-full max-w-sm rounded-[2rem] border border-rose-400/20 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold text-white">Eliminar usuario</p>
            <p className="mt-2 text-sm text-slate-300">
              ¿Seguro que deseas eliminar a <strong className="text-white">{deleteTarget.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="rounded-full border border-rose-400/30 bg-rose-500/20 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50"
              >
                {isDeleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Ban / Unban confirmation modal ---- */}
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !isBanning && setBanTarget(null)}>
          <div className="relative mx-4 w-full max-w-sm rounded-[2rem] border border-amber-400/20 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {banTarget.bannedAt ? (
              <>
                <p className="text-lg font-semibold text-white">Desbanear usuario</p>
                <p className="mt-2 text-sm text-slate-300">
                  ¿Desbanear a <strong className="text-white">{banTarget.name}</strong>? Podrá volver a jugar normalmente.
                </p>
                {banTarget.banReason && (
                  <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                    Motivo del ban: {banTarget.banReason}
                  </p>
                )}
                <div className="mt-5 flex justify-end gap-3">
                  <button type="button" disabled={isBanning} onClick={() => setBanTarget(null)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isBanning}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("userId", banTarget.id);
                      startBanTransition(async () => {
                        await unbanUserAction(fd);
                        setBanTarget(null);
                      });
                    }}
                    className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    {isBanning ? "Desbaneando…" : "Sí, desbanear"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-white">Banear usuario</p>
                <p className="mt-2 text-sm text-slate-300">
                  ¿Banear a <strong className="text-white">{banTarget.name}</strong>? No podrá realizar acciones en partidas ni duelos arcade.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set("userId", banTarget.id);
                    startBanTransition(async () => {
                      await banUserAction(fd);
                      setBanTarget(null);
                    });
                  }}
                  className="mt-3"
                >
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Motivo</label>
                  <input name="reason" defaultValue="Conducta abusiva / sabotaje de minijuegos" className="input mt-1 w-full py-2 text-xs" />
                  <div className="mt-5 flex justify-end gap-3">
                    <button type="button" disabled={isBanning} onClick={() => setBanTarget(null)} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20">
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isBanning}
                      className="rounded-full border border-amber-400/30 bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-50"
                    >
                      {isBanning ? "Baneando…" : "Sí, banear"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
