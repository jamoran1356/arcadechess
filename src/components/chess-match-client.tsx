'use client';

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { ArcadeDuelModal } from "@/components/arcade-duel-modal";
import { useDict } from "@/components/locale-provider";

type MatchClientProps = {
  match: {
    id: string;
    title: string;
    theme: string;
    fen: string;
    turn: string;
    status: string;
    stakeAmount: string;
    stakeToken: string;
    isSolo?: boolean;
    moveHistory: string[];
    host: { id: string; name: string };
    guest: { id: string; name: string } | null;
    viewerRole: "host" | "guest" | "spectator";
    pendingDuel: {
      id: string;
      attackerId: string;
      defenderId: string;
      attackerName: string;
      defenderName: string;
      attackerScore: number | null;
      defenderScore: number | null;
      game: {
        name: string;
        blurb: string;
        timeLimitMs: number;
        antiCheat: string;
      };
      scenario: import("@/lib/arcade").ArcadeScenario;
    } | null;
  };
  currentUserId?: string;
};

export function ChessMatchClient({ match, currentUserId }: MatchClientProps) {
  const router = useRouter();
  const ch = useDict().chess;
  const [fen, setFen] = useState(match.fen);
  const [turn, setTurn] = useState(match.turn);
  const [status, setStatus] = useState(match.status);
  const [moveHistory, setMoveHistory] = useState(match.moveHistory);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const isMyTurn =
    (match.viewerRole === "host" && turn === "w") ||
    (match.viewerRole === "guest" && turn === "b");

  const canMove = Boolean(
    currentUserId &&
      (match.guest || match.isSolo) &&
      match.pendingDuel === null &&
      status !== "OPEN" &&
      status !== "FINISHED" &&
      isMyTurn,
  );

  const orientation = useMemo(() => {
    if (match.viewerRole === "guest") {
      return "black" as const;
    }
    return "white" as const;
  }, [match.viewerRole]);

  function onPieceDrop(sourceSquare: string, targetSquare: string) {
    if (!canMove || isPending) {
      return false;
    }

    setError(null);
    setIsPending(true);

    startTransition(() => {
      void fetch(`/api/matches/${match.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: sourceSquare, to: targetSquare }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error ?? ch.moveError);
          }

          if (data.pendingDuel) {
            router.refresh();
            return;
          }

          setFen(data.fen);
          setTurn(data.turn);
          setStatus(data.status);
          setMoveHistory(data.moveHistory);
          if (data.refresh) {
            router.refresh();
          }
        })
        .catch((requestError: unknown) => {
          setError(requestError instanceof Error ? requestError.message : ch.moveError);
        })
        .finally(() => {
          setIsPending(false);
        });
    });

    return false;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="panel rounded-[2rem] p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4 pb-4">
          <div>
            <p className="eyebrow">{ch.liveEyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{match.title}</h2>
          </div>
          <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
            {turn === "w" ? ch.turnWhite : ch.turnBlack}
          </span>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/85 p-3">
          <Chessboard
            options={{
              position: fen,
              boardOrientation: orientation,
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                if (!sourceSquare || !targetSquare) {
                  return false;
                }
                return onPieceDrop(sourceSquare, targetSquare);
              },
              darkSquareStyle: { backgroundColor: "#0f3857" },
              lightSquareStyle: { backgroundColor: "#d6f0ff" },
              boardStyle: { borderRadius: "1.25rem", overflow: "hidden" },
            }}
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{ch.whitesLabel}</p>
            <p className="mt-2 text-lg font-semibold text-white">{match.host.name}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{ch.statusLabel}</p>
            <p className="mt-2 text-lg font-semibold text-white">{status.replaceAll("_", " ")}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{ch.blacksLabel}</p>
            <p className="mt-2 text-lg font-semibold text-white">{match.guest?.name ?? (match.isSolo ? ch.soloMode : ch.waitingRival)}</p>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </section>

      <aside className="grid gap-5 self-start">
        <div className="panel rounded-[2rem] p-6">
          <p className="eyebrow">{ch.stakeEyebrow}</p>
          <p className="mt-3 text-4xl font-semibold text-amber-200">
            {match.stakeAmount} {match.stakeToken}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-300">{match.theme}</p>
          <Link href="/lobby" className="mt-5 inline-flex text-sm text-cyan-200 hover:text-cyan-100">
            {ch.backToLobby}
          </Link>
        </div>

        <div className="panel rounded-[2rem] p-6">
          <p className="eyebrow">{ch.historyEyebrow}</p>
          <div className="mt-4 flex max-h-72 flex-wrap gap-2 overflow-auto">
            {moveHistory.length > 0 ? (
              moveHistory.map((move, index) => (
                <span key={`${move}-${index}`} className="rounded-full bg-white/6 px-3 py-2 text-sm text-slate-200">
                  {index + 1}. {move}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-400">{ch.noMoves}</p>
            )}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6">
          <p className="eyebrow">{ch.statusEyebrow}</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {canMove
              ? ch.canMoveMsg
              : ch.waitingMsg}
          </p>
        </div>
      </aside>

      {match.pendingDuel && currentUserId ? (
        <ArcadeDuelModal duel={match.pendingDuel} currentUserId={currentUserId} />
      ) : null}
    </div>
  );
}
