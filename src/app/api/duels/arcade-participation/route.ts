import { NextResponse } from "next/server";
import type { Square } from "chess.js";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { settleSpectatorBets } from "@/lib/match-engine";
import { getOnchainAdapter } from "@/lib/onchain/service";

/**
 * System endpoint que detecta y penaliza a jugadores que no participan en duelos arcade.
 * Se ejecuta periódicamente (ej: cada 5 segundos) desde el cliente o un servicio.
 *
 * Lógica:
 * - Si un duel arcade ha estado abierto >8s sin que ambos entren, se penaliza al no-participante
 * - El participante recibe el pool completo
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const duelId = typeof body?.duelId === "string" ? body.duelId : undefined;

    // Buscar dueles arcade sin resolver hace más de 8 segundos
    const now = new Date();
    const threshold = new Date(now.getTime() - 8000);
    const duelResolveThreshold = new Date(now.getTime() - 26000);

    const unresolvedDuels = await prisma.arcadeDuel.findMany({
      where: {
        ...(duelId ? { id: duelId } : {}),
        OR: [
          { attackerId: session.id },
          { defenderId: session.id },
        ],
        resolvedAt: null,
        createdAt: { lt: threshold },
        match: {
          status: "ARCADE_PENDING",
        },
      },
      include: { match: true },
    });

    const results = [];

    for (const duel of unresolvedDuels) {
      const match = duel.match;
      const attackerParticipated = duel.attackerEnteredAt !== null;
      const defenderParticipated = duel.defenderEnteredAt !== null;

      // Caso 1: Ambos participaron - resolver por score si ya vencio la ventana del minijuego
      if (attackerParticipated && defenderParticipated) {
        const attackerScore = duel.attackerScore ?? 0;
        const defenderScore = duel.defenderScore ?? 0;

        if (duel.createdAt < duelResolveThreshold || (duel.attackerScore !== null && duel.defenderScore !== null)) {
          const winner = attackerScore > defenderScore ? duel.attackerId : duel.defenderId;
          await resolveDuelByScores(duel, attackerScore, defenderScore, winner, "duel_timeout_or_completed");
          results.push({
            duelId: duel.id,
            reason: "duel_timeout_or_completed",
            winner,
          });
        }
        continue;
      }

      // Caso 2: Ninguno participó - el atacante gana por default
      if (!attackerParticipated && !defenderParticipated) {
        await resolveDuelWithPenalty(duel, duel.attackerId, "defender_no_show");
        results.push({
          duelId: duel.id,
          reason: "both_no_show",
          winner: duel.attackerId,
        });
        continue;
      }

      // Caso 3: Solo el atacante participó - gana
      if (attackerParticipated && !defenderParticipated) {
        await resolveDuelWithPenalty(duel, duel.attackerId, "defender_no_show");
        results.push({
          duelId: duel.id,
          reason: "defender_no_show",
          winner: duel.attackerId,
        });
        continue;
      }

      // Caso 4: Solo el defensor participó - el atacante pierde (defensor gana por defensa)
      if (!attackerParticipated && defenderParticipated) {
        await resolveDuelWithPenalty(duel, duel.defenderId, "attacker_no_show");
        results.push({
          duelId: duel.id,
          reason: "attacker_no_show",
          winner: duel.defenderId,
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Arena participación check error:", error);
    return NextResponse.json(
      { error: "Interno del servidor" },
      { status: 500 },
    );
  }
}

async function resolveDuelWithPenalty(
  duel: {
    id: string;
    attackerId: string;
    defenderId: string;
    boardMove: unknown;
    match: {
      id: string;
      fen: string;
      turn: string;
      moveHistory: unknown;
      preferredNetwork: "INITIA" | "FLOW" | "SOLANA";
      stakeAmount: { toString(): string; mul(value: number): { toString(): string } };
      entryFee: { toString(): string; mul(value: number): { toString(): string } };
      guestId: string | null;
      stakeToken: string;
    };
  },
  winnerId: string,
  penaltyReason: string,
) {
  const match = duel.match;
  const fullScore = 10000;
  const defenderWon = winnerId === duel.defenderId;
  const boardMove = parseBoardMove(duel.boardMove);
  let settledMatchWinnerId: string | null = null;

  await prisma.$transaction(async (tx) => {
    // Registrar el duelo como resuelto
    await tx.arcadeDuel.update({
      where: { id: duel.id },
      data: {
        winnerId,
        participationPenalty: penaltyReason,
        resolvedAt: new Date(),
        ...(winnerId === duel.attackerId && { attackerScore: fullScore }),
        ...(winnerId === duel.defenderId && { defenderScore: fullScore }),
      },
    });

    // Actualizar el tablero según resultado
    let nextStatus: "IN_PROGRESS" | "FINISHED" = "IN_PROGRESS";
    let nextFen = match.fen;
    let nextTurn = match.turn;
    let matchWinnerId = null;

    const moveHistory = Array.isArray(match.moveHistory)
      ? match.moveHistory
      : [];

    if (defenderWon) {
      if (!boardMove) {
        nextTurn = match.turn;
        await tx.match.update({
          where: { id: match.id },
          data: {
            status: nextStatus,
            fen: nextFen,
            turn: nextTurn,
            winnerId: matchWinnerId,
            moveHistory: [
              ...moveHistory,
              `Arcade penalty resolved (${penaltyReason}) - invalid boardMove payload`,
            ],
          },
        });
        return;
      }

      // El defensor ganó: el atacante pierde la pieza que intentó mover.
      const Chess = (await import("chess.js")).Chess;
      const chess = new Chess(match.fen);
      chess.remove(boardMove.from as Square);
      nextFen = chess.fen();
      nextTurn = match.turn === "w" ? "b" : "w";
    } else {
      if (!boardMove) {
        // Fallback defensivo: si el payload del movimiento está corrupto, no mutamos tablero.
        nextTurn = match.turn;
        await tx.match.update({
          where: { id: match.id },
          data: {
            status: nextStatus,
            fen: nextFen,
            turn: nextTurn,
            winnerId: matchWinnerId,
            moveHistory: [
              ...moveHistory,
              `Arcade penalty resolved (${penaltyReason}) - invalid boardMove payload`,
            ],
          },
        });
        return;
      }

      // El atacante ganó - aplicar el movimiento
      const Chess = (await import("chess.js")).Chess;
      const chess = new Chess(match.fen);
      const applied = chess.move({
        from: boardMove.from,
        to: boardMove.to,
        promotion: boardMove.promotion ?? undefined,
      });

      nextFen = chess.fen();
      nextTurn = chess.turn();

      if (chess.isGameOver()) {
        nextStatus = "FINISHED";
        if (chess.isCheckmate()) {
          matchWinnerId = winnerId;
        }
      }
    }

    await tx.match.update({
      where: { id: match.id },
      data: {
        status: nextStatus,
        fen: nextFen,
        turn: nextTurn,
        winnerId: matchWinnerId,
        moveHistory: [
          ...moveHistory,
          defenderWon
            ? `${boardMove?.san ?? "move"} [arcade-loss-penalty]`
            : `Arcade penalty resolved (${penaltyReason})`,
        ],
      },
    });

    // Si hay ganador de la partida, procesar pago
    if (matchWinnerId) {
      settledMatchWinnerId = matchWinnerId;
      const adapter = getOnchainAdapter(match.preferredNetwork);
      const participantCount = match.guestId ? 2 : 1;
      const stakePool = match.stakeAmount.mul(participantCount);
      const feePool = match.entryFee.mul(participantCount);

      const receipt = await adapter.settleEscrow({
        matchId: match.id,
        winnerId: matchWinnerId,
        amount: stakePool.toString(),
        token: match.stakeToken,
      });

      await tx.transaction.create({
        data: {
          userId: matchWinnerId,
          matchId: match.id,
          network: match.preferredNetwork,
          type: "PRIZE_PAYOUT",
          status: receipt.mode === "configured" ? "PENDING" : "SETTLED",
          amount: stakePool.toString(),
          token: match.stakeToken,
          txHash: receipt.txHash,
          metadata: {
            description: receipt.description,
            mode: receipt.mode,
            penaltyResolved: true,
            participantCount,
            grossStakePool: stakePool.toString(),
            retainedFeePool: feePool.toString(),
          },
        },
      });
    }
  });

  if (settledMatchWinnerId) {
    await settleSpectatorBets(match.id, settledMatchWinnerId, match.preferredNetwork, match.stakeToken);
  }
}

async function resolveDuelByScores(
  duel: {
    id: string;
    attackerId: string;
    defenderId: string;
    boardMove: unknown;
    match: {
      id: string;
      fen: string;
      turn: string;
      moveHistory: unknown;
      preferredNetwork: "INITIA" | "FLOW" | "SOLANA";
      stakeAmount: { toString(): string; mul(value: number): { toString(): string } };
      entryFee: { toString(): string; mul(value: number): { toString(): string } };
      guestId: string | null;
      stakeToken: string;
    };
  },
  attackerScore: number,
  defenderScore: number,
  winnerId: string,
  reason: string,
) {
  const match = duel.match;
  const boardMove = parseBoardMove(duel.boardMove);
  const attackerWins = winnerId === duel.attackerId;
  let settledMatchWinnerId: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.arcadeDuel.update({
      where: { id: duel.id },
      data: {
        attackerScore,
        defenderScore,
        winnerId,
        resolvedAt: new Date(),
        participationPenalty: reason,
      },
    });

    let nextStatus: "IN_PROGRESS" | "FINISHED" = "IN_PROGRESS";
    let nextFen = match.fen;
    let nextTurn = match.turn;
    let matchWinnerId: string | null = null;
    const moveHistory = Array.isArray(match.moveHistory) ? match.moveHistory : [];

    if (!boardMove) {
      await tx.match.update({
        where: { id: match.id },
        data: {
          status: nextStatus,
          fen: nextFen,
          turn: nextTurn,
          winnerId: matchWinnerId,
          moveHistory: [...moveHistory, `Arcade resolved (${reason}) - invalid boardMove payload`],
        },
      });
      return;
    }

    if (attackerWins) {
      const Chess = (await import("chess.js")).Chess;
      const chess = new Chess(match.fen);
      const applied = chess.move({
        from: boardMove.from,
        to: boardMove.to,
        promotion: boardMove.promotion ?? undefined,
      });
      nextFen = chess.fen();
      nextTurn = chess.turn();

      if (chess.isGameOver()) {
        nextStatus = "FINISHED";
        if (chess.isCheckmate()) {
          matchWinnerId = winnerId;
        }
      }

      await tx.match.update({
        where: { id: match.id },
        data: {
          status: nextStatus,
          fen: nextFen,
          turn: nextTurn,
          winnerId: matchWinnerId,
          moveHistory: [...moveHistory, `${applied.san} [arcade]`],
        },
      });
    } else {
      const Chess = (await import("chess.js")).Chess;
      const chess = new Chess(match.fen);
      chess.remove(boardMove.from as Square);
      nextFen = chess.fen();
      nextTurn = match.turn === "w" ? "b" : "w";

      await tx.match.update({
        where: { id: match.id },
        data: {
          status: nextStatus,
          fen: nextFen,
          turn: nextTurn,
          winnerId: matchWinnerId,
          moveHistory: [...moveHistory, `${boardMove.san ?? "move"} [arcade-loss]`],
        },
      });
    }

    if (matchWinnerId) {
      settledMatchWinnerId = matchWinnerId;
      const adapter = getOnchainAdapter(match.preferredNetwork);
      const participantCount = match.guestId ? 2 : 1;
      const stakePool = match.stakeAmount.mul(participantCount);
      const feePool = match.entryFee.mul(participantCount);
      const receipt = await adapter.settleEscrow({
        matchId: match.id,
        winnerId: matchWinnerId,
        amount: stakePool.toString(),
        token: match.stakeToken,
      });

      await tx.transaction.create({
        data: {
          userId: matchWinnerId,
          matchId: match.id,
          network: match.preferredNetwork,
          type: "PRIZE_PAYOUT",
          status: receipt.mode === "configured" ? "PENDING" : "SETTLED",
          amount: stakePool.toString(),
          token: match.stakeToken,
          txHash: receipt.txHash,
          metadata: {
            description: receipt.description,
            mode: receipt.mode,
            penaltyResolved: true,
            participantCount,
            grossStakePool: stakePool.toString(),
            retainedFeePool: feePool.toString(),
          },
        },
      });
    }
  });

  if (settledMatchWinnerId) {
    await settleSpectatorBets(match.id, settledMatchWinnerId, match.preferredNetwork, match.stakeToken);
  }
}

function parseBoardMove(value: unknown): { from: string; to: string; promotion?: string | null; san?: string | null } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { from?: unknown; to?: unknown; promotion?: unknown; san?: unknown };
  if (typeof candidate.from !== "string" || typeof candidate.to !== "string") {
    return null;
  }

  return {
    from: candidate.from,
    to: candidate.to,
    promotion: typeof candidate.promotion === "string" ? candidate.promotion : null,
    san: typeof candidate.san === "string" ? candidate.san : null,
  };
}
