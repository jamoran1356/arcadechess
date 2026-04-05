import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import {
  ArcadeGameType,
  MatchStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { evaluateArcadeAttempt, getSoloArcadeTimeLimitMs, type ArcadeAttempt } from "@/lib/arcade";
import { prisma } from "@/lib/db";
import { getOnchainAdapter } from "@/lib/onchain/service";
import { getPlatformConfig } from "@/lib/platform-config";
import { creditWallet } from "@/lib/wallet";

type MoveInput = {
  from: string;
  to: string;
  promotion?: string;
};

function isSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value);
}

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

function clampClock(clockMs: number) {
  return Math.max(0, Math.round(clockMs));
}

function consumeActiveTurnClock(match: {
  status: MatchStatus;
  turn: string;
  turnStartedAt: Date | null;
  whiteClockMs: number;
  blackClockMs: number;
}) {
  if (match.status !== MatchStatus.IN_PROGRESS || !match.turnStartedAt) {
    return {
      whiteClockMs: match.whiteClockMs,
      blackClockMs: match.blackClockMs,
    };
  }

  const elapsedMs = Math.max(0, Date.now() - match.turnStartedAt.getTime());

  if (match.turn === "w") {
    return {
      whiteClockMs: clampClock(match.whiteClockMs - elapsedMs),
      blackClockMs: match.blackClockMs,
    };
  }

  return {
    whiteClockMs: match.whiteClockMs,
    blackClockMs: clampClock(match.blackClockMs - elapsedMs),
  };
}

function buildSoloDefenderScore(gameType: ArcadeGameType, seed: string) {
  let hash = 0;
  const input = `${gameType}:${seed}:solo-bot`;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  const normalized = (hash % 1000) / 1000;

  switch (gameType) {
    case ArcadeGameType.TARGET_RUSH:
      return Math.round(3400 + normalized * 4200);
    case ArcadeGameType.MEMORY_GRID:
      return Math.round(1800 + normalized * 2600);
    case ArcadeGameType.KEY_CLASH:
      return Math.round(2200 + normalized * 2400);
    case ArcadeGameType.MAZE_RUNNER:
      return Math.round(3000 + normalized * 4000);
    case ArcadeGameType.PING_PONG:
      return Math.round(3500 + normalized * 4500);
    case ArcadeGameType.REACTION_DUEL:
      return Math.round(4000 + normalized * 3500);
    default:
      return Math.round(2500 + normalized * 2500);
  }
}

type MatchProgressState = {
  fen: string;
  turn: string;
  status: MatchStatus;
  winnerId: string | null;
  moveHistory: string[];
  whiteClockMs: number;
  blackClockMs: number;
  turnStartedAt: Date | null;
};

async function checkAndResolveTimeoutVictory(
  match: {
    id: string;
    whiteClockMs: number;
    blackClockMs: number;
    turn: string;
    hostId: string;
    guestId: string | null;
    status: MatchStatus;
    preferredNetwork: "INITIA" | "FLOW" | "SOLANA";
    stakeAmount: Prisma.Decimal;
    entryFee: Prisma.Decimal;
    stakeToken: string;
    onchainMatchIndex?: number | null;
  },
  currentTurnClocks: { whiteClockMs: number; blackClockMs: number },
): Promise<string | null> {
  const whiteTimeExpired = currentTurnClocks.whiteClockMs <= 0;
  const blackTimeExpired = currentTurnClocks.blackClockMs <= 0;

  if (!whiteTimeExpired && !blackTimeExpired) {
    return null;
  }

  // Timeout detected: the OTHER player wins.
  // Solo: host = player (white), guestId = null.
  //   White expires → player loses → no winner (draw/forfeit treated as loss).
  //   Black expires → hostId wins.
  // PvP: normal — opponent of the timed-out side wins.
  let winnerId: string;
  if (whiteTimeExpired) {
    winnerId = match.guestId ?? ""; // solo: empty string → no winner
  } else {
    winnerId = match.hostId;
  }

  await prisma.match.update({
    where: { id: match.id },
    data: {
      status: MatchStatus.FINISHED,
      winnerId: winnerId || null,
      whiteClockMs: currentTurnClocks.whiteClockMs,
      blackClockMs: currentTurnClocks.blackClockMs,
      turnStartedAt: null,
    },
  });

  if (winnerId) {
    await settleWinner(match, winnerId);
  }
  // Solo timeout with no guestId: player loses, vault keeps the deposit.

  return winnerId || match.hostId; // return hostId as sentinel so caller knows game ended
}

export async function syncMatchTimeoutIfNeeded(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { duels: { where: { resolvedAt: null }, select: { id: true } } },
  });

  if (!match) {
    return null;
  }

  if (match.status !== MatchStatus.IN_PROGRESS) {
    return null;
  }

  const clocks = consumeActiveTurnClock(match);
  const winnerId = await checkAndResolveTimeoutVictory(match, clocks);

  if (!winnerId) {
    return null;
  }

  if (match.duels.length > 0) {
    await prisma.arcadeDuel.updateMany({
      where: { matchId: match.id, resolvedAt: null },
      data: {
        resolvedAt: new Date(),
        participationPenalty: "match_timeout",
      },
    });
  }

  return winnerId;
}

function advanceSoloBotTurn(state: MatchProgressState) {
  if (state.status === MatchStatus.FINISHED || state.turn !== "b") {
    return { ...state, isBotCheckmate: false };
  }

  // Consume the time elapsed on black's clock before the bot moves
  const clocks = consumeActiveTurnClock({
    status: state.status as MatchStatus,
    turn: state.turn,
    turnStartedAt: state.turnStartedAt,
    whiteClockMs: state.whiteClockMs,
    blackClockMs: state.blackClockMs,
  });

  const botChess = new Chess(state.fen);
  const botMoves = botChess.moves({ verbose: true });
  const botMove = botMoves[Math.floor(Math.random() * botMoves.length)];

  if (!botMove) {
    return {
      ...state,
      isBotCheckmate: false,
      whiteClockMs: clocks.whiteClockMs,
      blackClockMs: clocks.blackClockMs,
      turnStartedAt: state.status === MatchStatus.IN_PROGRESS ? new Date() : null,
    };
  }

  const appliedBot = botChess.move({
    from: botMove.from,
    to: botMove.to,
    promotion: botMove.promotion,
  });

  const nextStatus = botChess.isGameOver() ? MatchStatus.FINISHED : MatchStatus.IN_PROGRESS;
  const isBotCheckmate = botChess.isCheckmate();

  return {
    fen: botChess.fen(),
    turn: botChess.turn(),
    status: nextStatus,
    winnerId: null,
    isBotCheckmate,
    moveHistory: [...state.moveHistory, `${appliedBot.san} [solo-bot]`],
    whiteClockMs: clocks.whiteClockMs,
    blackClockMs: clocks.blackClockMs,
    turnStartedAt: nextStatus === MatchStatus.IN_PROGRESS ? new Date() : null,
  };
}

function calculateSettlementAmounts(match: {
  guestId: string | null;
  stakeAmount: Prisma.Decimal;
  entryFee: Prisma.Decimal;
}) {
  const participantCount = match.guestId ? 2 : 1;
  const prize = match.stakeAmount.mul(participantCount);
  const retainedFee = match.entryFee.mul(participantCount);

  return {
    participantCount,
    prize,
    retainedFee,
  };
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

export async function settleWinner(match: {
  id: string;
  guestId: string | null;
  preferredNetwork: "INITIA" | "FLOW" | "SOLANA";
  stakeAmount: Prisma.Decimal;
  entryFee: Prisma.Decimal;
  stakeToken: string;
  onchainMatchIndex?: number | null;
}, winnerId: string) {
  const settlement = calculateSettlementAmounts(match);
  const adapter = getOnchainAdapter(match.preferredNetwork);

  let receipt;

  if (!match.guestId) {
    // Solo match: contract is in OPEN status (only host deposited).
    // Use refund_match to return the deposit from vault to the host.
    receipt = await adapter.refundMatchOnchain({
      matchId: match.id,
      onchainMatchIndex: match.onchainMatchIndex ?? null,
    });
  } else {
    // PvP match: both players deposited → STATUS_FUNDED → settle_to_winner
    const winnerWallet = await prisma.wallet.findFirst({
      where: { userId: winnerId, network: match.preferredNetwork },
      select: { address: true },
    });

    receipt = await adapter.settleEscrow({
      matchId: match.id,
      winnerId,
      winnerAddress: winnerWallet?.address ?? "",
      onchainMatchIndex: match.onchainMatchIndex ?? null,
      amount: settlement.prize.toString(),
      token: match.stakeToken,
    });
  }

  await prisma.transaction.create({
    data: {
      userId: winnerId,
      matchId: match.id,
      network: match.preferredNetwork,
      type: TransactionType.PRIZE_PAYOUT,
      status: receipt.settled ? TransactionStatus.SETTLED : TransactionStatus.PENDING,
      amount: settlement.prize.toString(),
      token: match.stakeToken,
      txHash: receipt.txHash,
      metadata: {
        description: receipt.description,
        mode: receipt.mode,
        settled: receipt.settled,
        participantCount: settlement.participantCount,
        grossStakePool: settlement.prize.toString(),
        retainedFeePool: settlement.retainedFee.toString(),
      },
    },
  });

  if (receipt.settled) {
    await creditWallet(winnerId, match.preferredNetwork, Number(settlement.prize.toString()));
  } else {
    console.error(`settleWinner: on-chain settlement failed for match ${match.id}. Tokens NOT credited to winner ${winnerId}.`);
  }

  await settleSpectatorBets(match.id, winnerId, match.preferredNetwork, match.stakeToken);
}

/**
 * Refund both players their stakeAmount when the match ends in a draw
 * (stalemate, insufficient material, repetition, 50-move rule, etc.).
 * entryFee is NOT refunded — it's the platform's commission.
 */
export async function settleDraw(match: {
  id: string;
  hostId: string;
  guestId: string | null;
  preferredNetwork: "INITIA" | "FLOW" | "SOLANA";
  stakeAmount: Prisma.Decimal;
  stakeToken: string;
  onchainMatchIndex?: number | null;
}) {
  const stakeNum = Number(match.stakeAmount.toString());
  if (stakeNum <= 0) return;

  const adapter = getOnchainAdapter(match.preferredNetwork);

  let onchainReceipt;

  if (!match.guestId) {
    // Solo match: contract in OPEN status → use refund_match
    onchainReceipt = await adapter.refundMatchOnchain({
      matchId: match.id,
      onchainMatchIndex: match.onchainMatchIndex ?? null,
    });
  } else {
    // PvP match: both deposited → STATUS_FUNDED → settle_draw
    onchainReceipt = await adapter.settleDrawOnchain({
      matchId: match.id,
      onchainMatchIndex: match.onchainMatchIndex ?? null,
    });
  }

  const participants = [match.hostId, match.guestId].filter(Boolean) as string[];
  for (const userId of participants) {
    await prisma.transaction.create({
      data: {
        userId,
        matchId: match.id,
        network: match.preferredNetwork,
        type: TransactionType.PRIZE_PAYOUT,
        status: onchainReceipt.settled ? TransactionStatus.SETTLED : TransactionStatus.PENDING,
        amount: stakeNum.toFixed(6),
        token: match.stakeToken,
        txHash: onchainReceipt.txHash || `draw_refund_${match.id}_${userId}`,
        metadata: {
          description: onchainReceipt.description,
          mode: onchainReceipt.mode,
          settled: onchainReceipt.settled,
          category: "draw-refund",
        },
      },
    });
    if (onchainReceipt.settled) {
      await creditWallet(userId, match.preferredNetwork, stakeNum);
    } else {
      console.error(`settleDraw: on-chain settlement failed for match ${match.id}. Tokens NOT credited to ${userId}.`);
    }
  }

  // Refund all open bets
  await refundOpenBets(match.id, match.preferredNetwork, match.stakeToken);
}

/**
 * Refund a single player their full lock (stake + entryFee)
 * when a match is cancelled with no opponent.
 */
export async function refundPlayer(match: {
  id: string;
  hostId: string;
  preferredNetwork: "INITIA" | "FLOW" | "SOLANA";
  stakeAmount: Prisma.Decimal;
  entryFee: Prisma.Decimal;
  stakeToken: string;
  onchainMatchIndex?: number | null;
}, userId: string) {
  const refundAmount = Number(match.stakeAmount.toString()) + Number(match.entryFee.toString());
  if (refundAmount <= 0) return;

  // On-chain refund
  const adapter = getOnchainAdapter(match.preferredNetwork);
  const onchainReceipt = await adapter.refundMatchOnchain({
    matchId: match.id,
    onchainMatchIndex: match.onchainMatchIndex ?? null,
  });

  await prisma.transaction.create({
    data: {
      userId,
      matchId: match.id,
      network: match.preferredNetwork,
      type: TransactionType.PRIZE_PAYOUT,
      status: onchainReceipt.settled ? TransactionStatus.SETTLED : TransactionStatus.PENDING,
      amount: refundAmount.toFixed(6),
      token: match.stakeToken,
      txHash: onchainReceipt.txHash || `cancel_refund_${match.id}_${userId}`,
      metadata: {
        description: onchainReceipt.description,
        mode: onchainReceipt.mode,
        settled: onchainReceipt.settled,
        category: "cancel-refund",
      },
    },
  });
  if (onchainReceipt.settled) {
    await creditWallet(userId, match.preferredNetwork, refundAmount);
  } else {
    console.error(`refundPlayer: on-chain refund failed for match ${match.id}. Tokens NOT credited to ${userId}.`);
  }
}

async function refundOpenBets(
  matchId: string,
  network: "INITIA" | "FLOW" | "SOLANA",
  token: string,
) {
  const openBets = await prisma.matchBet.findMany({
    where: { matchId, status: "OPEN" },
  });
  if (openBets.length === 0) return;

  const settledAt = new Date();
  for (const bet of openBets) {
    const amount = Number(bet.amount.toString());
    await prisma.$transaction([
      prisma.matchBet.update({
        where: { id: bet.id },
        data: { status: "CANCELLED", settledAt },
      }),
      prisma.transaction.create({
        data: {
          userId: bet.userId,
          matchId,
          network,
          type: TransactionType.PRIZE_PAYOUT,
          status: TransactionStatus.SETTLED,
          amount: amount.toFixed(6),
          token,
          txHash: `bet_refund_${matchId}_${bet.id}`,
          metadata: {
            description: `Empate/cancelación — reembolso de apuesta.`,
            mode: "internal",
            category: "bet-refund",
          },
        },
      }),
    ]);
    await creditWallet(bet.userId, network, amount);
  }
}

export async function settleSpectatorBets(
  matchId: string,
  winnerId: string,
  network: "INITIA" | "FLOW" | "SOLANA",
  token: string,
) {
  const platformConfig = await getPlatformConfig();
  const betFeeRate = platformConfig.betFeeBps / 10_000;
  const bets = await prisma.matchBet.findMany({
    where: {
      matchId,
      status: "OPEN",
    },
    orderBy: { createdAt: "asc" },
  });

  if (bets.length === 0) {
    return;
  }

  const winningBets = bets.filter((bet) => bet.predictedWinnerId === winnerId);
  const losingBets = bets.filter((bet) => bet.predictedWinnerId !== winnerId);
  const totalWinning = winningBets.reduce((sum, bet) => sum + Number(bet.amount.toString()), 0);
  const totalLosing = losingBets.reduce((sum, bet) => sum + Number(bet.amount.toString()), 0);
  const settledAt = new Date();

  if (winningBets.length === 0) {
    await prisma.matchBet.updateMany({
      where: { matchId, status: "OPEN" },
      data: { status: "LOST", settledAt },
    });
    return;
  }

  const adapter = getOnchainAdapter(network);

  for (const bet of winningBets) {
    const stake = Number(bet.amount.toString());
    const share = totalWinning > 0 ? (stake / totalWinning) * totalLosing : 0;
    const feeAmount = share * betFeeRate;
    const payout = (stake + share - feeAmount).toFixed(6);
    const receipt = await adapter.settleBet({
      matchId,
      bettorId: bet.userId,
      winnerId,
      predictedWinnerId: bet.predictedWinnerId,
      amount: payout,
      token,
    });

    await prisma.$transaction([
      prisma.matchBet.update({
        where: { id: bet.id },
        data: {
          status: "WON",
          payoutAmount: payout,
          payoutTxHash: receipt.txHash,
          settledAt,
          metadata: {
            ...(bet.metadata && typeof bet.metadata === "object" ? bet.metadata as Prisma.InputJsonObject : {}),
            payoutMode: receipt.mode,
            payoutDescription: receipt.description,
            platformFeeAmount: feeAmount.toFixed(6),
            platformFeeBps: platformConfig.betFeeBps,
            winnerId,
          },
        },
      }),
      prisma.transaction.create({
        data: {
          userId: bet.userId,
          matchId,
          network,
          type: TransactionType.PRIZE_PAYOUT,
          status: receipt.mode === "configured" ? TransactionStatus.PENDING : TransactionStatus.SETTLED,
          amount: payout,
          token,
          txHash: receipt.txHash,
          metadata: {
            description: receipt.description,
            mode: receipt.mode,
            category: "spectator-bet-payout",
            predictedWinnerId: bet.predictedWinnerId,
            platformFeeAmount: feeAmount.toFixed(6),
            platformFeeBps: platformConfig.betFeeBps,
            winnerId,
          },
        },
      }),
    ]);

    await creditWallet(bet.userId, network, Number(payout));
  }

  if (losingBets.length > 0) {
    await prisma.matchBet.updateMany({
      where: {
        matchId,
        status: "OPEN",
        predictedWinnerId: { not: winnerId },
      },
      data: {
        status: "LOST",
        settledAt,
      },
    });
  }
}

export async function performMatchMove(matchId: string, userId: string, moveInput: MoveInput) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { duels: { where: { resolvedAt: null }, take: 1 } },
  });

  if (!match) {
    throw new Error("La partida no existe.");
  }

  // Check for timeout before processing any move
  const clocks = consumeActiveTurnClock(match);
  const timeoutWinnerId = await checkAndResolveTimeoutVictory(match, clocks);
  if (timeoutWinnerId) {
    return {
      pendingDuel: false,
      fen: match.fen,
      turn: match.turn,
      status: MatchStatus.FINISHED,
      moveHistory: asMoveHistory(match.moveHistory),
      whiteClockMs: clocks.whiteClockMs,
      blackClockMs: clocks.blackClockMs,
      turnStartedAt: null,
      refresh: true,
      timeoutMessage: `Tiempo agotado. ${clocks.whiteClockMs <= 0 ? "Blancas" : "Negras"} pierde por timeout.`,
    };
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
  const gamePool = asGameTypes(match.arcadeGamePool);
  if (isCapture && gamePool.length > 0) {
    const defenderId = (userId === match.hostId ? match.guestId : match.hostId) ?? userId;
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
        data: {
          status: MatchStatus.ARCADE_PENDING,
          whiteClockMs: clocks.whiteClockMs,
          blackClockMs: clocks.blackClockMs,
          turnStartedAt: null,
        },
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

  // clocks already computed above for the timeout check
  let nextState: MatchProgressState = {
    fen: chess.fen(),
    turn: chess.turn(),
    status: MatchStatus.IN_PROGRESS,
    winnerId: null,
    moveHistory: [...asMoveHistory(match.moveHistory), appliedMove.san],
    whiteClockMs: clocks.whiteClockMs,
    blackClockMs: clocks.blackClockMs,
    turnStartedAt: new Date(),
  };

  if (chess.isGameOver()) {
    nextState = {
      ...nextState,
      status: MatchStatus.FINISHED,
      turnStartedAt: null,
    };
    if (chess.isCheckmate()) {
      nextState = {
        ...nextState,
        winnerId: userId,
      };
    }
  }

  // Solo: do NOT advance the bot here — the client waits 3 s then calls /bot-move

  await prisma.match.update({
    where: { id: matchId },
    data: {
      fen: nextState.fen,
      turn: nextState.turn,
      status: nextState.status,
      winnerId: nextState.winnerId,
      moveHistory: nextState.moveHistory,
      whiteClockMs: nextState.whiteClockMs,
      blackClockMs: nextState.blackClockMs,
      turnStartedAt: nextState.turnStartedAt,
    },
  });

  if (nextState.winnerId) {
    await settleWinner(match, nextState.winnerId);
  } else if (nextState.status === MatchStatus.FINISHED) {
    await settleDraw(match);
  }

  return {
    pendingDuel: false,
    botPending: match.isSolo && nextState.status === MatchStatus.IN_PROGRESS,
    fen: nextState.fen,
    turn: nextState.turn,
    status: nextState.status,
    moveHistory: nextState.moveHistory,
    whiteClockMs: nextState.whiteClockMs,
    blackClockMs: nextState.blackClockMs,
    turnStartedAt: nextState.turnStartedAt?.toISOString() ?? null,
    refresh: nextState.status === MatchStatus.FINISHED,
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

  const boardMove = duel.boardMove as { from: string; to: string; promotion?: string | null; san: string };
  const playerSeed = isAttacker ? `${duel.seed}:attacker` : `${duel.seed}:defender`;
  const soloTimeLimitMs = duel.match.isSolo
    ? getSoloArcadeTimeLimitMs({
        fen: duel.match.fen,
        targetSquare: boardMove.to,
        attackerTurn: duel.match.turn === "b" ? "b" : "w",
      })
    : undefined;
  const evaluation = evaluateArcadeAttempt(duel.gameType, playerSeed, attempt, { timeLimitMs: soloTimeLimitMs });
  const score = Math.max(0, Math.round(evaluation.score));

  let updatedDuel = await prisma.arcadeDuel.update({
    where: { id: duelId },
    data: isAttacker
      ? { attackerScore: score, attackerEnteredAt: duel.attackerEnteredAt ?? new Date() }
      : { defenderScore: score, defenderEnteredAt: duel.defenderEnteredAt ?? new Date() },
  });

  if (duel.match.isSolo && isAttacker && updatedDuel.defenderScore === null) {
    updatedDuel = await prisma.arcadeDuel.update({
      where: { id: duelId },
      data: {
        defenderScore: buildSoloDefenderScore(duel.gameType, `${duel.seed}:defender`),
        defenderEnteredAt: updatedDuel.defenderEnteredAt ?? new Date(),
      },
    });
  }

  if (updatedDuel.attackerScore === null || updatedDuel.defenderScore === null) {
    return {
      resolved: false,
      message: evaluation.valid
        ? "Resultado registrado. Esperando al rival."
        : `Resultado registrado con score ${score}. Esperando al rival.`,
    };
  }

  const isTie = updatedDuel.attackerScore === updatedDuel.defenderScore;
  // Tie favors attacker (one minigame per capture, no rematch)
  const attackerWins = isTie || updatedDuel.attackerScore > updatedDuel.defenderScore;
  const duelWinnerId = attackerWins ? duel.attackerId : duel.match.isSolo ? null : duel.defenderId;
  const match = duel.match;
  const moveHistory = asMoveHistory(match.moveHistory);
  const scoreTag = `${updatedDuel.attackerScore} vs ${updatedDuel.defenderScore}`;

  const result = await prisma.$transaction(async (tx) => {
    // Guard against race with arcade-participation polling
    const freshDuel = await tx.arcadeDuel.findUnique({ where: { id: duelId }, select: { resolvedAt: true } });
    if (freshDuel?.resolvedAt) {
      return { attackerWins: false, duelWinnerId: null, matchWinnerId: null, status: MatchStatus.IN_PROGRESS, alreadyResolved: true };
    }

    let nextState: MatchProgressState = {
      fen: match.fen,
      turn: match.turn,
      status: MatchStatus.IN_PROGRESS,
      winnerId: null,
      moveHistory: [...moveHistory],
      whiteClockMs: match.whiteClockMs,
      blackClockMs: match.blackClockMs,
      turnStartedAt: new Date(),
    };

    if (attackerWins) {
      const chess = new Chess(match.fen);
      const applied = chess.move({
        from: boardMove.from,
        to: boardMove.to,
        promotion: boardMove.promotion ?? undefined,
      });

      nextState = {
        ...nextState,
        fen: chess.fen(),
        turn: chess.turn(),
        moveHistory: [...moveHistory, `${applied.san} [arcade ${scoreTag}]`],
      };

      if (chess.isGameOver()) {
        nextState = {
          ...nextState,
          status: MatchStatus.FINISHED,
          turnStartedAt: null,
        };
        if (chess.isCheckmate()) {
          nextState = {
            ...nextState,
            winnerId: duel.attackerId,
          };
        }
      }
    } else {
      const chess = new Chess(match.fen);
      // Attacker lost the duel — remove their piece from the starting square.
      // boardMove.from is guaranteed to be a valid chess square (validated upstream).
      chess.remove(boardMove.from as Square);
      const attackerLostKing = boardMove.san.includes("K") || boardMove.san.startsWith("K");

      // chess.remove() doesn't flip the turn in the FEN string — patch it manually.
      const newTurn = flipTurn(match.turn);
      const fenParts = chess.fen().split(" ");
      fenParts[1] = newTurn;

      nextState = {
        ...nextState,
        fen: fenParts.join(" "),
        turn: newTurn,
        moveHistory: [...moveHistory, `${boardMove.san} [arcade-loss ${scoreTag}]`],
      };

      if (attackerLostKing) {
        nextState = {
          ...nextState,
          status: MatchStatus.FINISHED,
          winnerId: duel.match.isSolo ? null : duel.defenderId,
          turnStartedAt: null,
        };
      }
    }

    // Solo: do NOT advance the bot here — the client waits 3 s then calls /bot-move

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
        fen: nextState.fen,
        turn: nextState.turn,
        status: nextState.status,
        winnerId: nextState.winnerId,
        moveHistory: nextState.moveHistory,
        whiteClockMs: nextState.whiteClockMs,
        blackClockMs: nextState.blackClockMs,
        turnStartedAt: nextState.turnStartedAt,
      },
    });

    return {
      attackerWins,
      duelWinnerId,
      matchWinnerId: nextState.winnerId,
      status: nextState.status,
    };
  });

  if ("alreadyResolved" in result && result.alreadyResolved) {
    return {
      resolved: true,
      message: "El duelo ya fue resuelto.",
      winnerId: null,
      matchStatus: MatchStatus.IN_PROGRESS,
    };
  }

  if (result.matchWinnerId) {
    await settleWinner(match, result.matchWinnerId);
  } else if (result.status === MatchStatus.FINISHED) {
    await settleDraw(match);
  }

  return {
    resolved: true,
    botPending: match.isSolo && result.status === MatchStatus.IN_PROGRESS,
    message: result.attackerWins
      ? "El atacante gano el duelo y conquista la casilla."
      : "El defensor sostuvo la casilla y el tablero continua.",
    winnerId: result.duelWinnerId,
    matchStatus: result.status,
  };
}

export async function performBotMove(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      fen: true,
      turn: true,
      status: true,
      isSolo: true,
      moveHistory: true,
      whiteClockMs: true,
      blackClockMs: true,
      turnStartedAt: true,
      hostId: true,
      guestId: true,
      winnerId: true,
    },
  });

  if (!match) {
    throw new Error("La partida no existe.");
  }

  if (!match.isSolo) {
    throw new Error("No es una partida en solitario.");
  }

  if (match.status !== MatchStatus.IN_PROGRESS || match.turn !== "b") {
    return {
      skipped: true,
      fen: match.fen,
      turn: match.turn,
      status: match.status,
      moveHistory: asMoveHistory(match.moveHistory),
      whiteClockMs: match.whiteClockMs,
      blackClockMs: match.blackClockMs,
      turnStartedAt: match.turnStartedAt?.toISOString() ?? null,
    };
  }

  const currentState: MatchProgressState = {
    fen: match.fen,
    turn: match.turn,
    status: match.status,
    winnerId: null,
    moveHistory: asMoveHistory(match.moveHistory),
    whiteClockMs: match.whiteClockMs,
    blackClockMs: match.blackClockMs,
    turnStartedAt: match.turnStartedAt ?? null,
  };

  const nextState = advanceSoloBotTurn(currentState);

  await prisma.match.update({
    where: { id: matchId },
    data: {
      fen: nextState.fen,
      turn: nextState.turn,
      status: nextState.status,
      winnerId: nextState.winnerId,
      moveHistory: nextState.moveHistory,
      whiteClockMs: nextState.whiteClockMs,
      blackClockMs: nextState.blackClockMs,
      turnStartedAt: nextState.turnStartedAt,
    },
  });

  if (nextState.winnerId) {
    const fullMatch = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      select: { id: true, hostId: true, guestId: true, preferredNetwork: true, stakeAmount: true, entryFee: true, stakeToken: true, onchainMatchIndex: true },
    });
    await settleWinner(fullMatch, nextState.winnerId);
  } else if (nextState.status === MatchStatus.FINISHED) {
    if (nextState.isBotCheckmate) {
      // Bot checkmated the player — host loses. No refund, vault keeps deposit.
      console.log(`Solo match ${matchId}: bot checkmate — host loses stake.`);
    } else {
      // True draw (stalemate, repetition, etc.) — refund the host
      const fullMatch = await prisma.match.findUniqueOrThrow({
        where: { id: matchId },
        select: { id: true, hostId: true, guestId: true, preferredNetwork: true, stakeAmount: true, stakeToken: true, onchainMatchIndex: true },
      });
      await settleDraw(fullMatch);
    }
  }

  return {
    skipped: false,
    fen: nextState.fen,
    turn: nextState.turn,
    status: nextState.status,
    moveHistory: nextState.moveHistory,
    whiteClockMs: nextState.whiteClockMs,
    blackClockMs: nextState.blackClockMs,
    turnStartedAt: nextState.turnStartedAt?.toISOString() ?? null,
    refresh: nextState.status === MatchStatus.FINISHED,
  };
}
