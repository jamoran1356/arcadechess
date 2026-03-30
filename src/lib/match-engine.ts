import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import {
  ArcadeGameType,
  MatchStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { evaluateArcadeAttempt, type ArcadeAttempt } from "@/lib/arcade";
import { prisma } from "@/lib/db";
import { getOnchainAdapter } from "@/lib/onchain/service";

type MoveInput = {
  from: string;
  to: string;
  promotion?: string;
};

function asGameTypes(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as ArcadeGameType[];
  }

  return value.filter((entry): entry is ArcadeGameType =>
    Object.values(ArcadeGameType).includes(entry as ArcadeGameType),
  );
}

function asMoveHistory(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map(String) : [];
}

function flipTurn(turn: string) {
  return turn === "w" ? "b" : "w";
}

function getPlayerColor(match: { hostId: string; guestId: string | null }, userId: string) {
  if (userId === match.hostId) {
    return "w";
  }

  if (userId === match.guestId) {
    return "b";
  }

  return null;
}

async function settleWinner(match: {
  id: string;
  guestId: string | null;
  preferredNetwork: "INITIA" | "FLOW" | "SOLANA";
  stakeAmount: Prisma.Decimal;
  entryFee: Prisma.Decimal;
  stakeToken: string;
}, winnerId: string) {
  const multiplier = match.guestId ? 2 : 1;
  const payout = match.stakeAmount.mul(multiplier).add(match.entryFee.mul(multiplier));
  const adapter = getOnchainAdapter(match.preferredNetwork);
  const receipt = await adapter.settleEscrow({
    matchId: match.id,
    winnerId,
    amount: payout.toString(),
    token: match.stakeToken,
  });

  await prisma.transaction.create({
    data: {
      userId: winnerId,
      matchId: match.id,
      network: match.preferredNetwork,
      type: TransactionType.PRIZE_PAYOUT,
      status: receipt.mode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
      amount: payout.toString(),
      token: match.stakeToken,
      txHash: receipt.txHash,
      metadata: { description: receipt.description, mode: receipt.mode },
    },
  });
}

export async function performMatchMove(matchId: string, userId: string, moveInput: MoveInput) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { duels: { where: { resolvedAt: null }, take: 1 } },
  });

  if (!match) {
    throw new Error("La partida no existe.");
  }

  if (!match.guestId && !match.isSolo) {
    throw new Error("La partida aun espera un rival.");
  }

  if (match.status === MatchStatus.ARCADE_PENDING || match.duels.length > 0) {
    throw new Error("Hay una captura en duelo, resuelvela antes de mover.");
  }

  if (match.status === MatchStatus.FINISHED) {
    throw new Error("La partida ya termino.");
  }

  const color = getPlayerColor(match, userId);
  if (!color) {
    throw new Error("No participas en esta partida.");
  }

  if (match.turn !== color) {
    throw new Error("No es tu turno.");
  }

  const chess = new Chess(match.fen);
  const legalMove = chess
    .moves({ verbose: true })
    .find(
      (candidate) =>
        candidate.from === moveInput.from &&
        candidate.to === moveInput.to &&
        (!moveInput.promotion || candidate.promotion === moveInput.promotion),
    );

  if (!legalMove) {
    throw new Error("Movimiento invalido.");
  }

  const isCapture = legalMove.flags.includes("c") || legalMove.flags.includes("e");
  if (isCapture) {
    const defenderId = userId === match.hostId ? match.guestId : match.hostId;
    const gamePool = asGameTypes(match.arcadeGamePool);
    const gameType = gamePool[Math.floor(Math.random() * gamePool.length)] ?? ArcadeGameType.TARGET_RUSH;

    const duel = await prisma.$transaction(async (tx) => {
      const created = await tx.arcadeDuel.create({
        data: {
          matchId,
          attackerId: userId,
          defenderId,
          gameType,
          seed: randomUUID(),
          boardMove: {
            from: moveInput.from,
            to: moveInput.to,
            promotion: moveInput.promotion ?? null,
            san: legalMove.san,
          },
        },
      });

      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.ARCADE_PENDING },
      });

      return created;
    });

    return {
      pendingDuel: true,
      duelId: duel.id,
      message: "Captura detectada. Se abrio un duelo arcade.",
    };
  }

  const appliedMove = chess.move({
    from: moveInput.from,
    to: moveInput.to,
    promotion: moveInput.promotion,
  });

  const moveHistory = [...asMoveHistory(match.moveHistory), appliedMove.san];
  let winnerId: string | null = null;
  let status = MatchStatus.IN_PROGRESS;

  if (chess.isGameOver()) {
    status = MatchStatus.FINISHED;
    if (chess.isCheckmate()) {
      winnerId = userId;
    }
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      fen: chess.fen(),
      turn: chess.turn(),
      status,
      winnerId,
      moveHistory,
    },
  });

  if (winnerId) {
    await settleWinner(match, winnerId);
  }

  if (match.isSolo && status !== MatchStatus.FINISHED) {
    const botChess = new Chess(chess.fen());
    const botMoves = botChess.moves({ verbose: true });
    const botMove = botMoves[Math.floor(Math.random() * botMoves.length)];

    if (botMove) {
      const appliedBot = botChess.move({
        from: botMove.from,
        to: botMove.to,
        promotion: botMove.promotion,
      });

      const botHistory = [...moveHistory, `${appliedBot.san} [solo-bot]`];
      let botStatus = MatchStatus.IN_PROGRESS;
      const botWinnerId: string | null = null;

      if (botChess.isGameOver()) {
        botStatus = MatchStatus.FINISHED;
      }

      await prisma.match.update({
        where: { id: matchId },
        data: {
          fen: botChess.fen(),
          turn: botChess.turn(),
          status: botStatus,
          winnerId: botWinnerId,
          moveHistory: botHistory,
        },
      });

      return {
        pendingDuel: false,
        fen: botChess.fen(),
        turn: botChess.turn(),
        status: botStatus,
        moveHistory: botHistory,
        refresh: botStatus === MatchStatus.FINISHED,
      };
    }
  }

  return {
    pendingDuel: false,
    fen: chess.fen(),
    turn: chess.turn(),
    status,
    moveHistory,
    refresh: status === MatchStatus.FINISHED,
  };
}

export async function submitArcadeAttempt(duelId: string, userId: string, attempt: ArcadeAttempt) {
  const duel = await prisma.arcadeDuel.findUnique({
    where: { id: duelId },
    include: { match: true },
  });

  if (!duel) {
    throw new Error("El duelo no existe.");
  }

  if (duel.resolvedAt) {
    throw new Error("El duelo ya fue resuelto.");
  }

  const isAttacker = userId === duel.attackerId;
  const isDefender = userId === duel.defenderId;
  if (!isAttacker && !isDefender) {
    throw new Error("No participas en este duelo.");
  }

  if ((isAttacker && duel.attackerScore !== null) || (isDefender && duel.defenderScore !== null)) {
    throw new Error("Ya enviaste tu intento.");
  }

  const evaluation = evaluateArcadeAttempt(duel.gameType, duel.seed, attempt);
  const score = evaluation.valid ? Math.max(0, Math.round(evaluation.score)) : 0;

  const updatedDuel = await prisma.arcadeDuel.update({
    where: { id: duelId },
    data: isAttacker
      ? { attackerScore: score, attackerEnteredAt: duel.attackerEnteredAt ?? new Date() }
      : { defenderScore: score, defenderEnteredAt: duel.defenderEnteredAt ?? new Date() },
  });

  if (updatedDuel.attackerScore === null || updatedDuel.defenderScore === null) {
    return {
      resolved: false,
      message: evaluation.valid
        ? "Resultado registrado. Esperando al rival."
        : "Intento registrado con score 0 por validacion fallida.",
    };
  }

  const attackerWins = updatedDuel.attackerScore > updatedDuel.defenderScore;
  const duelWinnerId = attackerWins ? duel.attackerId : duel.defenderId;
  const match = duel.match;
  const moveHistory = asMoveHistory(match.moveHistory);

  const result = await prisma.$transaction(async (tx) => {
    let nextFen = match.fen;
    let nextTurn = match.turn;
    let nextStatus = MatchStatus.IN_PROGRESS;
    let matchWinnerId: string | null = null;
    let nextMoveHistory = [...moveHistory];

    if (attackerWins) {
      const chess = new Chess(match.fen);
      const boardMove = duel.boardMove as { from: string; to: string; promotion?: string | null; san: string };
      const applied = chess.move({
        from: boardMove.from,
        to: boardMove.to,
        promotion: boardMove.promotion ?? undefined,
      });

      nextFen = chess.fen();
      nextTurn = chess.turn();
      nextMoveHistory = [...moveHistory, `${applied.san} [arcade]`];
      if (chess.isGameOver()) {
        nextStatus = MatchStatus.FINISHED;
        if (chess.isCheckmate()) {
          matchWinnerId = duel.attackerId;
        }
      }
    } else {
      nextTurn = flipTurn(match.turn);
      nextMoveHistory = [...moveHistory, `Defensa arcade exitosa en ${match.turn === "w" ? "blancas" : "negras"}`];
    }

    await tx.arcadeDuel.update({
      where: { id: duelId },
      data: {
        winnerId: duelWinnerId,
        resolvedAt: new Date(),
      },
    });

    await tx.match.update({
      where: { id: match.id },
      data: {
        fen: nextFen,
        turn: nextTurn,
        status: nextStatus,
        winnerId: matchWinnerId,
        moveHistory: nextMoveHistory,
      },
    });

    return {
      attackerWins,
      duelWinnerId,
      matchWinnerId,
      status: nextStatus,
    };
  });

  if (result.matchWinnerId) {
    await settleWinner(match, result.matchWinnerId);
  }

  return {
    resolved: true,
    message: result.attackerWins
      ? "El atacante gano el duelo y conquista la casilla."
      : "El defensor sostuvo la casilla y el tablero continua.",
    winnerId: result.duelWinnerId,
    matchStatus: result.status,
  };
}
