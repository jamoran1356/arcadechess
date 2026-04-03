'use client';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { ArcadeDuelModal } from "@/components/arcade-duel-modal";
import { DialogModal } from "@/components/dialog-modal";
import { MatchShareControls } from "@/components/match-share-controls";
import { useDict } from "@/components/locale-provider";
import { resignMatchAction } from "@/lib/actions";

type MatchClientProps = {
  match: {
    id: string;
    title: string;
    theme: string;
    fen: string;
    turn: string;
    status: string;
    gameClockMs: number;
    whiteClockMs: number;
    blackClockMs: number;
    turnStartedAt: string | null;
    stakeAmount: string;
    stakeToken: string;
    isSolo?: boolean;
    winner?: { id: string; name: string } | null;
    moveHistory: string[];
    host: { id: string; name: string };
    guest: { id: string; name: string } | null;
    viewerRole: string;
    pendingDuel: {
      id: string;
      attackerId: string;
      defenderId: string;
      attackerEnteredAt: string | null;
      defenderEnteredAt: string | null;
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

type PendingDuelState = NonNullable<MatchClientProps["match"]["pendingDuel"]>;

export function ChessMatchClient({ match, currentUserId }: MatchClientProps) {
  const router = useRouter();
  const ch = useDict().chess;
  const [fen, setFen] = useState(match.fen);
  const [turn, setTurn] = useState(match.turn);
  const [status, setStatus] = useState(match.status);
  const [whiteClockMs, setWhiteClockMs] = useState(match.whiteClockMs);
  const [blackClockMs, setBlackClockMs] = useState(match.blackClockMs);
  const [turnStartedAt, setTurnStartedAt] = useState<string | null>(match.turnStartedAt);
  const [moveHistory, setMoveHistory] = useState(match.moveHistory);
  const [guest, setGuest] = useState(match.guest);
  const [winnerId, setWinnerId] = useState<string | null>(match.winner?.id ?? null);
  const [pendingDuel, setPendingDuel] = useState<PendingDuelState | null>(match.pendingDuel);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [timeoutMessage, setTimeoutMessage] = useState<string | null>(null);
  const [isResigning, startResignTransition] = useTransition();
  const [showResignDialog, setShowResignDialog] = useState(false);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [winDialogText, setWinDialogText] = useState("Ganaste la partida.");
  const [prizePhase, setPrizePhase] = useState<"sending" | "sent" | null>(null);
  const [prizeTxHash, setPrizeTxHash] = useState<string | null>(null);
  const [prizeAmount, setPrizeAmount] = useState<string | null>(null);
  const previousStatusRef = useRef(status);

  const syncMatchState = useCallback(async () => {
    const response = await fetch(`/api/matches/${match.id}/state`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? ch.moveError);
    }

    setFen(data.fen);
    setTurn(data.turn);
    setStatus(data.status);
    setMoveHistory(data.moveHistory);
    setWhiteClockMs(data.whiteClockMs);
    setBlackClockMs(data.blackClockMs);
    setTurnStartedAt(data.turnStartedAt);
    setGuest(data.guest ?? null);
    setWinnerId(data.winner?.id ?? null);
    if (data.status === "ARCADE_PENDING") {
      setPendingDuel(data.pendingDuel ?? null);
    } else {
      setPendingDuel(null);
    }
  }, [ch.moveError, match.id]);

  const isActiveParticipant =
    currentUserId &&
    (match.host.id === currentUserId || guest?.id === currentUserId) &&
    (status === "IN_PROGRESS" || status === "OPEN" || status === "ARCADE_PENDING");

  function handleResign() {
    const fd = new FormData();
    fd.set("matchId", match.id);
    startResignTransition(() => resignMatchAction(fd));
  }

  useEffect(() => {
    setFen(match.fen);
    setTurn(match.turn);
    setStatus(match.status);
    setWhiteClockMs(match.whiteClockMs);
    setBlackClockMs(match.blackClockMs);
    setTurnStartedAt(match.turnStartedAt);
    setMoveHistory(match.moveHistory);
    setGuest(match.guest);
    setWinnerId(match.winner?.id ?? null);
    setPendingDuel(match.status === "ARCADE_PENDING" ? (match.pendingDuel ?? null) : null);
  }, [match]);

  useEffect(() => {
    const wasFinished = previousStatusRef.current === "FINISHED";
    const justFinished = !wasFinished && status === "FINISHED";

    if (justFinished && currentUserId && winnerId === currentUserId) {
      const lastEvent = moveHistory[moveHistory.length - 1] ?? "";
      if (lastEvent.includes("[resign]")) {
        setWinDialogText("Tu oponente se rindió. ¡Ganaste la partida!");
      } else if (lastEvent.includes("timeout")) {
        setWinDialogText("¡Ganaste por tiempo! El reloj del rival llegó a 0.");
      } else {
        setWinDialogText("¡Ganaste la partida!");
      }
      setPrizePhase("sending");
      setPrizeTxHash(null);
      setPrizeAmount(null);
      setShowWinDialog(true);
    }

    previousStatusRef.current = status;
  }, [currentUserId, moveHistory, status, winnerId]);

  // Poll for prize settlement transaction once the win dialog is open
  useEffect(() => {
    if (prizePhase !== "sending") return;

    let cancelled = false;
    const poll = async () => {
      for (let attempt = 0; attempt < 20 && !cancelled; attempt++) {
        try {
          const res = await fetch(`/api/matches/${match.id}/state`, { cache: "no-store" });
          if (!res.ok) break;
          const data = await res.json();
          const payoutTx = (data.transactions ?? []).find(
            (t: { type: string; status: string }) => t.type === "PRIZE_PAYOUT" && t.status === "SETTLED",
          );
          if (payoutTx) {
            setPrizeAmount(payoutTx.amount ?? null);
            setPrizeTxHash(payoutTx.txHash ?? null);
            setPrizePhase("sent");
            return;
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 2000));
      }
      // After timeout, show as sent anyway (settlement may have been DB-only)
      if (!cancelled) setPrizePhase("sent");
    };

    void poll();
    return () => { cancelled = true; };
  }, [prizePhase, match.id]);

  const isMyTurn =
    (match.viewerRole === "host" && turn === "w") ||
    (match.viewerRole === "guest" && turn === "b");

  const canMove = Boolean(
    currentUserId &&
      (guest || match.isSolo) &&
      status !== "ARCADE_PENDING" &&
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

  const [displayClocks, setDisplayClocks] = useState({
    white: match.whiteClockMs,
    black: match.blackClockMs,
  });

  // Check for clock timeout
  useEffect(() => {
    if (displayClocks.white <= 0 || displayClocks.black <= 0) {
      const timeoutMsg = displayClocks.white <= 0 ? "Blancas agotaron tiempo" : "Negras agotaron tiempo";
      setTimeoutMessage(timeoutMsg);
    } else {
      setTimeoutMessage(null);
    }
  }, [displayClocks]);

  useEffect(() => {
    const tick = () => {
      const nextWhite = whiteClockMs;
      const nextBlack = blackClockMs;

      if (status !== "IN_PROGRESS" || !turnStartedAt) {
        setDisplayClocks({ white: nextWhite, black: nextBlack });
        return;
      }

      const elapsed = Math.max(0, Date.now() - new Date(turnStartedAt).getTime());

      if (turn === "w") {
        setDisplayClocks({
          white: Math.max(0, nextWhite - elapsed),
          black: nextBlack,
        });
        return;
      }

      setDisplayClocks({
        white: nextWhite,
        black: Math.max(0, nextBlack - elapsed),
      });
    };

    tick();
    const intervalId = window.setInterval(tick, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [blackClockMs, status, turn, turnStartedAt, whiteClockMs]);

  const activeTurnClockMs = turn === "w" ? displayClocks.white : displayClocks.black;
  const totalRemainingClockMs = displayClocks.white + displayClocks.black;

  // Solo mode: when it's the bot's turn, wait 3 s then trigger its move
  useEffect(() => {
    if (!match.isSolo || turn !== "b" || status !== "IN_PROGRESS") return;

    const timer = setTimeout(() => {
      void fetch(`/api/matches/${match.id}/bot-move`, { method: "POST" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || data.skipped) return;
          setFen(data.fen);
          setTurn(data.turn);
          setStatus(data.status);
          setMoveHistory(data.moveHistory);
          setWhiteClockMs(data.whiteClockMs);
          setBlackClockMs(data.blackClockMs);
          setTurnStartedAt(data.turnStartedAt);
          if (data.refresh) {
            router.refresh();
          }
        })
        .catch(() => {/* silent — next move will retry */});
    }, 3000);

    return () => clearTimeout(timer);
  }, [match.isSolo, match.id, turn, status, router]);

  useEffect(() => {
    if (match.isSolo || status === "FINISHED") {
      return;
    }

    const intervalMs = status === "ARCADE_PENDING" ? 4000 : 1500;
    const intervalId = window.setInterval(() => {
      void syncMatchState().catch(() => {
        // best-effort sync for versus matches
      });
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [match.isSolo, status, syncMatchState]);

  function formatClock(clockMs: number) {
    const totalSeconds = Math.max(0, Math.ceil(clockMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

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
            await syncMatchState();
            return;
          }

          setFen(data.fen);
          setTurn(data.turn);
          setStatus(data.status);
          setMoveHistory(data.moveHistory);
          setWhiteClockMs(data.whiteClockMs);
          setBlackClockMs(data.blackClockMs);
          setTurnStartedAt(data.turnStartedAt);
          setPendingDuel(null);
          if (data.refresh) {
            await syncMatchState();
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

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/10 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-100/70">{ch.totalClockLabel}</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-100">{formatClock(totalRemainingClockMs)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-400/10 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-100/70">{ch.activeClockLabel}</p>
            <p className="mt-2 text-2xl font-semibold text-amber-100">{formatClock(activeTurnClockMs)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{ch.whiteClockLabel}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatClock(displayClocks.white)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{ch.blackClockLabel}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatClock(displayClocks.black)}</p>
          </div>
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
            <p className="mt-2 text-lg font-semibold text-white">{guest?.name ?? (match.isSolo ? ch.soloMode : ch.waitingRival)}</p>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {timeoutMessage ? <p className="mt-2 text-sm text-amber-300">{timeoutMessage}</p> : null}
      </section>

      <aside className="grid gap-5 self-start">
        <div className="panel rounded-[2rem] p-6">
          <p className="eyebrow">{ch.stakeEyebrow}</p>
          <p className="mt-3 text-4xl font-semibold text-amber-200">
            {match.stakeAmount} {match.stakeToken}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-300">{match.theme}</p>
          <div className="mt-4">
            <MatchShareControls matchId={match.id} title={match.title} />
          </div>
          <Link href="/lobby" className="mt-5 inline-flex text-sm text-cyan-200 hover:text-cyan-100">
            {ch.backToLobby}
          </Link>
          {isActiveParticipant ? (
            <button
              type="button"
              onClick={() => setShowResignDialog(true)}
              disabled={isResigning}
              className="mt-3 w-full rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:border-rose-300/60 hover:bg-rose-400/20 disabled:opacity-50"
            >
              {isResigning ? "Rindiendo…" : "Rendirse"}
            </button>
          ) : null}
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

      {pendingDuel && currentUserId ? (
        <ArcadeDuelModal duel={pendingDuel} currentUserId={currentUserId} onStateRefresh={syncMatchState} />
      ) : null}

      <DialogModal
        open={showResignDialog}
        title="Rendirse en la partida"
        description="Si confirmás, la partida se cierra y tu rival queda como ganador."
        tone="danger"
        confirmLabel="Sí, rendirme"
        cancelLabel="Seguir jugando"
        isBusy={isResigning}
        onClose={() => setShowResignDialog(false)}
        onConfirm={handleResign}
      />

      <DialogModal
        open={showWinDialog}
        title="¡Victoria!"
        tone="success"
        confirmLabel={prizePhase === "sent" ? "Entendido" : undefined}
        hideCancel
        isBusy={prizePhase === "sending"}
        onClose={() => { setShowWinDialog(false); setPrizePhase(null); }}
      >
        <div className="mt-2 space-y-4 text-sm text-slate-200">
          <p>{winDialogText}</p>

          {prizePhase === "sending" && (
            <div className="flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <svg className="h-5 w-5 animate-spin text-cyan-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="text-cyan-200">Enviando premio a tu wallet...</span>
            </div>
          )}

          {prizePhase === "sent" && (
            <div className="space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold text-emerald-300">¡Premio enviado!</span>
              </div>
              {prizeAmount && (
                <p className="text-lg font-bold text-emerald-200">
                  +{prizeAmount} {match.stakeToken}
                </p>
              )}
              {prizeTxHash && (
                <a
                  href={`https://scan.testnet.initia.xyz/initiation-2/txs/${prizeTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan-300 underline hover:text-cyan-200"
                >
                  Ver transacción en explorador ↗
                </a>
              )}
            </div>
          )}
        </div>
      </DialogModal>
    </div>
  );
}
