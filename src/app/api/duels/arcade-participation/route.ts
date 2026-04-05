import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { Square } from "chess.js";
import { ArcadeGameType, Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { settleDraw, settleSpectatorBets } from "@/lib/match-engine";
import { getOnchainAdapter } from "@/lib/onchain/service";
import { creditWallet } from "@/lib/wallet";

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
          const isTie = attackerScore === defenderScore;
          const winner = isTie ? null : attackerScore > defenderScore ? duel.attackerId : duel.defenderId;
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
      onchainMatchIndex: number | null;
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
  let matchEndedAsDraw = false;

  await prisma.$transaction(async (tx) => {
    // Guard against race with submitArcadeAttempt — if it already resolved, bail.
    const freshDuel = await tx.arcadeDuel.findUnique({ where: { id: duel.id }, select: { resolvedAt: true } });
    if (freshDuel?.resolvedAt) return;

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
            turnStartedAt: new Date(),
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
      nextTurn = match.turn === "w" ? "b" : "w";
      // chess.remove() no cambia el turno en el FEN, parchamos manualmente
      const fenParts = chess.fen().split(" ");
      fenParts[1] = nextTurn;
      nextFen = fenParts.join(" ");

      // Check if the resulting position is game-over (e.g. discovered checkmate/stalemate)
      try {
        const resultChess = new Chess(nextFen);
        if (resultChess.isGameOver()) {
          nextStatus = "FINISHED";
          if (resultChess.isCheckmate()) {
            // The side to move is checkmated; winner is the other side's player.
            matchWinnerId = match.turn === "w"
              ? (duel.attackerId)   // White attacked, Black (defender turn) is mated → White wins
              : (duel.defenderId);  // Black attacked, White (defender turn) is mated → Black player wins
          }
        }
      } catch { /* FEN without king — handled below */ }

      // If the removed piece was the king, the attacker loses immediately.
      if (nextStatus !== "FINISHED") {
        const pieceAtFrom = match.fen.split(" ")[0];
        const isKingCapture = boardMove.san?.startsWith("K");
        if (isKingCapture) {
          nextStatus = "FINISHED";
          matchWinnerId = duel.defenderId;
        }
      }
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
            turnStartedAt: new Date(),
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
        turnStartedAt: nextStatus === "FINISHED" ? null : new Date(),
        moveHistory: [
          ...moveHistory,
          defenderWon
            ? `${boardMove?.san ?? "move"} [arcade-loss-penalty: ${penaltyReason}]`
            : `Arcade penalty resolved (${penaltyReason})`,
        ],
      },
    });

    // Si hay ganador de la partida, procesar pago (solo PvP — solo matches no tienen escrow)
    if (matchWinnerId && match.guestId) {
      settledMatchWinnerId = matchWinnerId;
      const adapter = getOnchainAdapter(match.preferredNetwork);
      const participantCount = 2;
      const stakePool = match.stakeAmount.mul(participantCount);
      const feePool = match.entryFee.mul(participantCount);

      const winnerWallet = await prisma.wallet.findFirst({
        where: { userId: matchWinnerId, network: match.preferredNetwork },
        select: { address: true },
      });
      const receipt = await adapter.settleEscrow({
        matchId: match.id,
        winnerId: matchWinnerId,
        winnerAddress: winnerWallet?.address ?? "",
        onchainMatchIndex: match.onchainMatchIndex ?? null,
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
    } else if (nextStatus === "FINISHED") {
      matchEndedAsDraw = true;
    }
  });

  if (settledMatchWinnerId) {
    const participantCount = match.guestId ? 2 : 1;
    const prizeAmount = Number(match.stakeAmount.mul(participantCount).toString());
    await creditWallet(settledMatchWinnerId, match.preferredNetwork, prizeAmount);
    await settleSpectatorBets(match.id, settledMatchWinnerId, match.preferredNetwork, match.stakeToken);
  } else if (matchEndedAsDraw) {
    await settleDraw({
      id: match.id,
      hostId: duel.attackerId,
      guestId: match.guestId,
      preferredNetwork: match.preferredNetwork,
      stakeAmount: match.stakeAmount as unknown as Prisma.Decimal,
      stakeToken: match.stakeToken,
      onchainMatchIndex: match.onchainMatchIndex ?? null,
    });
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
      arcadeGamePool: unknown;
      preferredNetwork: "INITIA" | "FLOW" | "SOLANA";
      stakeAmount: { toString(): string; mul(value: number): { toString(): string } };
      entryFee: { toString(): string; mul(value: number): { toString(): string } };
      guestId: string | null;
      stakeToken: string;
      onchainMatchIndex: number | null;
    };
  },
  attackerScore: number,
  defenderScore: number,
  winnerId: string | null,
  reason: string,
) {
  const match = duel.match;
  const boardMove = parseBoardMove(duel.boardMove);
  const isTie = winnerId === null;
  const attackerWins = !isTie && winnerId === duel.attackerId;
  const scoreTag = `${attackerScore} vs ${defenderScore}`;
  let settledMatchWinnerId: string | null = null;
  let matchEndedAsDraw = false;
  let receiptSettled = false;

  await prisma.$transaction(async (tx) => {
    // Guard against race with submitArcadeAttempt — if it already resolved, bail.
    const freshDuel = await tx.arcadeDuel.findUnique({ where: { id: duel.id }, select: { resolvedAt: true } });
    if (freshDuel?.resolvedAt) return;

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
          turnStartedAt: new Date(),
          moveHistory: [...moveHistory, `Arcade resolved (${reason}) - invalid boardMove payload`],
        },
      });
      return;
    }

    if (isTie) {
      // Tie — create a rematch duel with a different minigame
      const arcadeGamePool = (match as unknown as { arcadeGamePool?: unknown }).arcadeGamePool;
      const poolArray = Array.isArray(arcadeGamePool)
        ? arcadeGamePool.filter((g): g is string => typeof g === "string" && Object.values(ArcadeGameType).includes(g as ArcadeGameType))
        : [];
      const newGameType = (poolArray[Math.floor(Math.random() * poolArray.length)] as ArcadeGameType | undefined) ?? ArcadeGameType.TARGET_RUSH;

      await tx.arcadeDuel.create({
        data: {
          matchId: match.id,
          attackerId: duel.attackerId,
          defenderId: duel.defenderId,
          gameType: newGameType,
          seed: randomUUID(),
          boardMove: duel.boardMove as Prisma.InputJsonValue,
        },
      });

      // Keep match in ARCADE_PENDING
      await tx.match.update({
        where: { id: match.id },
        data: {
          moveHistory: [...moveHistory, `${boardMove?.san ?? "move"} [arcade-tie ${scoreTag} → rematch]`],
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
          turnStartedAt: nextStatus === "FINISHED" ? null : new Date(),
          moveHistory: [...moveHistory, `${applied.san} [arcade ${scoreTag}]`],
        },
      });
    } else {
      const Chess = (await import("chess.js")).Chess;
      const chess = new Chess(match.fen);
      chess.remove(boardMove.from as Square);
      nextTurn = match.turn === "w" ? "b" : "w";
      // chess.remove() no cambia el turno en el FEN, parchamos manualmente
      const fenParts = chess.fen().split(" ");
      fenParts[1] = nextTurn;
      nextFen = fenParts.join(" ");

      // Check if the resulting position is game-over (e.g. discovered checkmate/stalemate)
      try {
        const resultChess = new Chess(nextFen);
        if (resultChess.isGameOver()) {
          nextStatus = "FINISHED";
          if (resultChess.isCheckmate()) {
            matchWinnerId = match.turn === "w"
              ? (duel.attackerId)
              : (duel.defenderId);
          }
        }
      } catch { /* FEN without king */ }

      if (nextStatus !== "FINISHED" && boardMove.san?.startsWith("K")) {
        nextStatus = "FINISHED";
        matchWinnerId = duel.defenderId;
      }

      await tx.match.update({
        where: { id: match.id },
        data: {
          status: nextStatus,
          fen: nextFen,
          turn: nextTurn,
          winnerId: matchWinnerId,
          turnStartedAt: nextStatus === "FINISHED" ? null : new Date(),
          moveHistory: [...moveHistory, `${boardMove.san ?? "move"} [arcade-loss ${scoreTag}]`],
        },
      });
    }

    // Solo matches have no on-chain escrow — skip settlement.
    if (matchWinnerId && match.guestId) {
      settledMatchWinnerId = matchWinnerId;
      const adapter = getOnchainAdapter(match.preferredNetwork);
      const participantCount = 2;
      const stakePool = match.stakeAmount.mul(participantCount);
      const feePool = match.entryFee.mul(participantCount);

      const winnerWallet = await prisma.wallet.findFirst({
        where: { userId: matchWinnerId, network: match.preferredNetwork },
        select: { address: true },
      });
      const receipt = await adapter.settleEscrow({
        matchId: match.id,
        winnerId: matchWinnerId,
        winnerAddress: winnerWallet?.address ?? "",
        onchainMatchIndex: match.onchainMatchIndex ?? null,
        amount: stakePool.toString(),
        token: match.stakeToken,
      });

      receiptSettled = receipt.settled;

      await tx.transaction.create({
        data: {
          userId: matchWinnerId,
          matchId: match.id,
          network: match.preferredNetwork,
          type: "PRIZE_PAYOUT",
          status: receipt.settled ? "SETTLED" : "PENDING",
          amount: stakePool.toString(),
          token: match.stakeToken,
          txHash: receipt.txHash,
          metadata: {
            description: receipt.description,
            mode: receipt.mode,
            settled: receipt.settled,
            penaltyResolved: true,
            participantCount,
            grossStakePool: stakePool.toString(),
            retainedFeePool: feePool.toString(),
          },
        },
      });
    } else if (nextStatus === "FINISHED") {
      matchEndedAsDraw = true;
    }
  });

  if (settledMatchWinnerId && receiptSettled) {
    const participantCount = match.guestId ? 2 : 1;
    const prizeAmount = Number(match.stakeAmount.mul(participantCount).toString());
    await creditWallet(settledMatchWinnerId, match.preferredNetwork, prizeAmount);
    await settleSpectatorBets(match.id, settledMatchWinnerId, match.preferredNetwork, match.stakeToken);
  } else if (settledMatchWinnerId && !receiptSettled) {
    console.error(`resolveDuelByScores: on-chain settlement failed for match ${match.id}. Tokens NOT credited to ${settledMatchWinnerId}.`);
  } else if (matchEndedAsDraw) {
    await settleDraw({
      id: match.id,
      hostId: duel.attackerId,
      guestId: match.guestId,
      preferredNetwork: match.preferredNetwork,
      stakeAmount: match.stakeAmount as unknown as Prisma.Decimal,
      stakeToken: match.stakeToken,
      onchainMatchIndex: match.onchainMatchIndex ?? null,
    });
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
