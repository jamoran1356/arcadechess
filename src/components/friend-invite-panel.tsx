'use client';

import { useTransition, useState } from "react";
import { addFriendAction, acceptFriendAction, removeFriendAction } from "@/lib/actions";

export interface FriendData {
  id: string;
  name: string;
  email: string;
  status: "PENDING" | "ACCEPTED";
  direction: "sent" | "received";
}

interface Props {
  initialFriends: FriendData[];
}

export function FriendInvitePanel({ initialFriends }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleInviteEmail() {
    if (!identifier.trim() || !identifier.includes("@")) return;
    const subject = encodeURIComponent("Te invito a PlayChess");
    const body = encodeURIComponent("Sumate a PlayChess y juguemos una partida: https://playchess.pydti.com/lobby");
    window.location.href = `mailto:${encodeURIComponent(identifier.trim())}?subject=${subject}&body=${body}`;
  }

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await addFriendAction(fd);
        setIdentifier("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al agregar amigo.");
      }
    });
  }

  function handleAccept(friendshipId: string) {
    const fd = new FormData();
    fd.set("friendshipId", friendshipId);
    startTransition(async () => {
      await acceptFriendAction(fd);
    });
  }

  function handleRemove(friendshipId: string) {
    const fd = new FormData();
    fd.set("friendshipId", friendshipId);
    startTransition(async () => {
      await removeFriendAction(fd);
    });
  }

  const accepted = initialFriends.filter((f) => f.status === "ACCEPTED");
  const incoming = initialFriends.filter((f) => f.status === "PENDING" && f.direction === "received");
  const outgoing = initialFriends.filter((f) => f.status === "PENDING" && f.direction === "sent");

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Friends & invites</p>

      {/* Add friend form */}
      <form onSubmit={handleAdd} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          name="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="input"
          placeholder="Correo o wallet de tu amigo"
          autoComplete="off"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleInviteEmail}
            className="button-secondary px-4 py-2 text-xs text-white"
            title="Invitar por correo"
          >
            ✉ Invitar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="button-primary px-4 py-2 text-xs"
          >
            {isPending ? "…" : "+ Agregar"}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-slate-500 uppercase tracking-widest">Solicitudes recibidas</p>
          <div className="flex flex-col gap-2">
            {incoming.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-xs text-slate-200">{f.name} <span className="text-slate-500">({f.email})</span></span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleAccept(f.id)} disabled={isPending} className="button-primary px-3 py-1 text-xs">Aceptar</button>
                  <button type="button" onClick={() => handleRemove(f.id)} disabled={isPending} className="button-secondary px-3 py-1 text-xs text-white">Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted friends */}
      {accepted.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-slate-500 uppercase tracking-widest">Amigos ({accepted.length})</p>
          <div className="flex flex-wrap gap-2">
            {accepted.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 pl-3 pr-1 py-1">
                <span className="text-xs text-emerald-100">{f.name}</span>
                <button type="button" onClick={() => handleRemove(f.id)} disabled={isPending} className="rounded-full p-0.5 text-slate-400 hover:text-red-400 text-xs leading-none">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-slate-500 uppercase tracking-widest">Enviadas (pendiente)</p>
          <div className="flex flex-wrap gap-2">
            {outgoing.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 pl-3 pr-1 py-1">
                <span className="text-xs text-amber-100">{f.name}</span>
                <button type="button" onClick={() => handleRemove(f.id)} disabled={isPending} className="rounded-full p-0.5 text-slate-400 hover:text-red-400 text-xs leading-none">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {accepted.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
        <p className="mt-4 text-xs text-slate-600">Aún no tenés amigos en PlayChess. ¡Agregá uno!</p>
      )}
    </div>
  );
}
