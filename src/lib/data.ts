import { randomUUID } from "node:crypto";
import { Prisma, TransactionNetwork, TransactionStatus, UserRole } from "@prisma/client";
import { buildArcadeScenario, getArcadeDefinition, getSoloArcadeTimeLimitMs, arcadeLibrary } from "@/lib/arcade";
import { prisma } from "@/lib/db";
import { getEnabledNetworks } from "@/lib/networks";
import { getSupportedNetworks } from "@/lib/onchain/service";
import { getPlatformConfig } from "@/lib/platform-config";

const AUTO_SOLO_TARGET = 9;
const AUTO_SOLO_EMAIL = "arena-bot@playchess.local";

async function ensureAutoSoloMatches() {
  const openSoloCount = await prisma.match.count({
    where: { status: "OPEN", isSolo: true, guestId: null },
  });

  if (openSoloCount >= AUTO_SOLO_TARGET) {
    return;
  }

  let bot = await prisma.user.findUnique({ where: { email: AUTO_SOLO_EMAIL } });
  if (!bot) {
    bot = await prisma.user.create({
      data: {
        name: "Arena Bot",
        email: AUTO_SOLO_EMAIL,
        passwordHash: "bot-managed-account",
        role: "USER",
      },
    });
  }

  const toCreate = AUTO_SOLO_TARGET - openSoloCount;

  // Presets: first 3 are classic (no blockchain, no arcade), rest have arcade/stake
  const presets = [
    // ── Classic: sin blockchain, sin minijuegos ──
    { title: "Clásica Rápida 3m",  theme: "Ajedrez clásico sin blockchain", clock: 180_000,  stake: "0.000000", fee: "0.000000", arcade: [] as string[] },
    { title: "Clásica Blitz 5m",   theme: "Ajedrez clásico sin blockchain", clock: 300_000,  stake: "0.000000", fee: "0.000000", arcade: [] as string[] },
    { title: "Clásica Rapid 10m",  theme: "Ajedrez clásico sin blockchain", clock: 600_000,  stake: "0.000000", fee: "0.000000", arcade: [] as string[] },
    // ── Arcade gratuitas (con minijuego, sin stake) ──
    { title: "Solo Flash 1m",      theme: "Ritmo extremo con arcade",       clock: 60_000,   stake: "0.000000", fee: "0.000000", arcade: ["TARGET_RUSH", "MEMORY_GRID"] },
    { title: "Solo Arcade 3m",     theme: "Minijuegos en cada captura",     clock: 180_000,  stake: "0.000000", fee: "0.000000", arcade: ["TARGET_RUSH", "MEMORY_GRID", "REACTION_DUEL"] },
    { title: "Solo Custom 5m",     theme: "Partida gratuita con arcade",    clock: 300_000,  stake: "0.000000", fee: "0.000000", arcade: ["TARGET_RUSH", "MEMORY_GRID"] },
    // ── Arcade con stake (requiere blockchain) ──
    { title: "Solo Blitz 5m",      theme: "Capturas con arcade y apuesta",  clock: 300_000,  stake: "0.250000", fee: "0.050000", arcade: ["TARGET_RUSH", "MEMORY_GRID"] },
    { title: "Solo Rapid 10m",     theme: "Control clásico con apuesta",    clock: 600_000,  stake: "0.500000", fee: "0.050000", arcade: ["TARGET_RUSH", "MEMORY_GRID", "MAZE_RUNNER"] },
    { title: "Solo Pro 15m",       theme: "Partida avanzada con apuesta",   clock: 900_000,  stake: "1.000000", fee: "0.100000", arcade: ["TARGET_RUSH", "MEMORY_GRID", "PING_PONG", "MAZE_RUNNER"] },
  ];

  for (let i = 0; i < toCreate; i += 1) {
    const preset = presets[i % presets.length];
    await prisma.match.create({
      data: {
        id: randomUUID(),
        title: `${preset.title} #${Math.floor(Date.now() / 1000) % 10000}`,
        theme: preset.theme,
        boardTheme: "arena",
        stakeAmount: preset.stake,
        entryFee: preset.fee,
        stakeToken: "INIT",
        preferredNetwork: "INITIA",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        turn: "w",
        moveHistory: [],
        arcadeGamePool: preset.arcade,
        isSolo: true,
        gameClockMs: preset.clock,
        whiteClockMs: preset.clock,
        blackClockMs: preset.clock,
        turnStartedAt: null,
        status: "OPEN",
        hostId: bot.id,
      },
    });
  }
}

function decimalToString(value: Prisma.Decimal) {
  return value.toString();
}

function asStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map(String) : [];
}

export async function getLandingSnapshot() {
  await ensureAutoSoloMatches();
  const [openMatches, usersCount, transactionsCount, topPlayers] = await Promise.all([
    prisma.match.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "ARCADE_PENDING"] } },
      include: { host: true, guest: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.user.findMany({
      where: {
        OR: [
          { hostedMatches: { some: {} } },
          { joinedMatches: { some: {} } },
        ],
      },
      orderBy: { wonMatches: { _count: "desc" } },
      take: 10,
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            wonMatches: true,
            hostedMatches: true,
            joinedMatches: true,
          },
        },
      },
    }),
  ]);

  return {
    stats: {
      usersCount,
      transactionsCount,
      availableMatches: openMatches.length,
    },
    openMatches: openMatches.map((match) => ({
      id: match.id,
      title: match.title,
      theme: match.theme,
      boardTheme: match.boardTheme,
      status: match.status,
      stakeAmount: decimalToString(match.stakeAmount),
      entryFee: decimalToString(match.entryFee),
      stakeToken: match.stakeToken,
      gameClockMs: match.gameClockMs,
      network: match.preferredNetwork,
      host: match.host.name,
      guest: match.guest?.name ?? null,
      createdAt: match.createdAt.toISOString(),
      arcadeGamePool: asStringArray(match.arcadeGamePool),
    })),
    networks: getSupportedNetworks(await getEnabledNetworks()),
    arcadeLibrary,
    topPlayers: topPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      wins: p._count.wonMatches,
      matches: p._count.hostedMatches + p._count.joinedMatches,
    })),
  };
}

export async function getRanking(page: number, perPage: number) {
  const skip = (page - 1) * perPage;

  const [players, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { hostedMatches: { some: {} } },
          { joinedMatches: { some: {} } },
        ],
      },
      orderBy: { wonMatches: { _count: "desc" } },
      skip,
      take: perPage,
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            wonMatches: true,
            hostedMatches: true,
            joinedMatches: true,
          },
        },
        transactions: {
          where: { type: "PRIZE_PAYOUT", status: "SETTLED" },
          select: { amount: true },
        },
      },
    }),
    prisma.user.count({
      where: {
        OR: [
          { hostedMatches: { some: {} } },
          { joinedMatches: { some: {} } },
        ],
      },
    }),
  ]);

  return {
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      wins: p._count.wonMatches,
      matches: p._count.hostedMatches + p._count.joinedMatches,
      earnings: p.transactions
        .reduce((sum, tx) => sum + Number(tx.amount), 0)
        .toFixed(2),
    })),
    total,
  };
}

export async function getUserRankPosition(userId: string) {
  // Get all users ordered by wins (same ordering as getRanking)
  const allRanked = await prisma.user.findMany({
    where: {
      OR: [
        { hostedMatches: { some: {} } },
        { joinedMatches: { some: {} } },
      ],
    },
    orderBy: { wonMatches: { _count: "desc" } },
    select: {
      id: true,
      _count: { select: { wonMatches: true } },
    },
  });

  const idx = allRanked.findIndex((u) => u.id === userId);
  if (idx === -1) return { position: null, wins: 0, totalPlayers: allRanked.length };
  return {
    position: idx + 1,
    wins: allRanked[idx]._count.wonMatches,
    totalPlayers: allRanked.length,
  };
}

export async function getLobbySnapshot(userId?: string) {
  await ensureAutoSoloMatches();
  const [matches, me] = await Promise.all([
    prisma.match.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "ARCADE_PENDING"] } },
      include: { host: true, guest: true, duels: { where: { resolvedAt: null }, take: 1, orderBy: { createdAt: "desc" } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    userId ? prisma.user.findUnique({ where: { id: userId }, include: { wallets: true } }) : null,
  ]);

  return {
    me,
    matches: matches.map((match) => ({
      id: match.id,
      title: match.title,
      theme: match.theme,
      boardTheme: match.boardTheme,
      status: match.status,
      isSolo: match.isSolo,
      stakeAmount: decimalToString(match.stakeAmount),
      entryFee: decimalToString(match.entryFee),
      stakeToken: match.stakeToken,
      gameClockMs: match.gameClockMs,
      network: match.preferredNetwork,
      host: match.host.name,
      guest: match.guest?.name ?? null,
      arcadeGamePool: asStringArray(match.arcadeGamePool),
      hasPendingDuel: match.duels.length > 0,
    })),
  };
}

export async function getDashboardSnapshot(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallets: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        include: { match: true },
        take: 12,
      },
      hostedMatches: { include: { guest: true }, orderBy: { createdAt: "desc" }, take: 6 },
      joinedMatches: { include: { host: true }, orderBy: { createdAt: "desc" }, take: 6 },
      _count: { select: { hostedMatches: true, joinedMatches: true, transactions: true } },
    },
  });

  return user;
}

export async function getAdminSnapshot() {
  const [usersCount, transactionsCount, openMatchesCount, settledVolume, users, transactions] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.match.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "ARCADE_PENDING"] } } }),
    prisma.transaction.aggregate({
      where: { status: TransactionStatus.SETTLED },
      _sum: { amount: true },
    }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.transaction.findMany({ orderBy: { createdAt: "desc" }, include: { user: true, match: true }, take: 10 }),
  ]);

  return {
    metrics: {
      usersCount,
      transactionsCount,
      openMatchesCount,
      settledVolume: settledVolume._sum.amount?.toString() ?? "0",
    },
    users,
    transactions,
  };
}

export async function getAdminUsersSnapshot(page = 1, perPage = 12) {
  const [items, totalCount] = await Promise.all([
    prisma.user.findMany({
      include: {
        wallets: true,
        _count: { select: { hostedMatches: true, joinedMatches: true, wonMatches: true, transactions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count(),
  ]);
  return { items, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / perPage)) };
}

export async function getAdminTransactionsSnapshot() {
  return prisma.transaction.findMany({
    include: { user: true, match: true },
    orderBy: { createdAt: "desc" },
    take: 120,
  });
}

export async function getPublicTransactions(page = 1, perPage = 20) {
  const skip = (page - 1) * perPage;

  const [items, totalCount, agg] = await Promise.all([
    prisma.transaction.findMany({
      select: {
        id: true,
        type: true,
        network: true,
        status: true,
        amount: true,
        token: true,
        txHash: true,
        createdAt: true,
        user: { select: { wallets: { select: { address: true, network: true } } } },
        match: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.transaction.count(),
    prisma.transaction.aggregate({
      where: { status: "SETTLED" },
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  return {
    items,
    totalCount,
    settledCount: agg._count,
    settledVolume: Number(agg._sum.amount ?? 0),
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(totalCount / perPage)),
  };
}

export async function getAdminNetworksSnapshot() {
  return prisma.wallet.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 120,
  });
}

export async function getAdminMatchesSnapshot() {
  return prisma.match.findMany({
    include: { host: true, guest: true, winner: true },
    orderBy: { createdAt: "desc" },
    take: 120,
  });
}

export async function getAdminPlansSnapshot() {
  return prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

export async function getAdminActivitySnapshot() {
  const [recentMatches, recentDuels, recentTransactions] = await Promise.all([
    prisma.match.findMany({
      include: { host: true, guest: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.arcadeDuel.findMany({
      include: { attacker: true, defender: true, winner: true, match: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.transaction.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return { recentMatches, recentDuels, recentTransactions };
}

export async function getAdminRevenueSnapshot() {
  const [platformConfig, settled, pending, failed, byNetwork, matches, bets] = await Promise.all([
    getPlatformConfig(),
    prisma.transaction.aggregate({
      where: { status: TransactionStatus.SETTLED },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { status: TransactionStatus.PENDING },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { status: TransactionStatus.FAILED },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ["network"],
      _sum: { amount: true },
      _count: true,
    }),
    prisma.match.findMany({
      select: { stakeAmount: true, entryFee: true, guestId: true, isSolo: true },
    }),
    prisma.matchBet.findMany({
      select: { metadata: true },
    }),
  ]);

  const capturedMatchFees = matches.reduce((sum, match) => {
    const participantCount = match.guestId ? 2 : match.isSolo ? 1 : 1;
    return sum + Number(match.entryFee.toString()) * participantCount;
  }, 0);

  const capturedBetFees = bets.reduce((sum, bet) => {
    if (!bet.metadata || typeof bet.metadata !== "object" || Array.isArray(bet.metadata)) {
      return sum;
    }

    const maybeFee = (bet.metadata as Record<string, unknown>).platformFeeAmount;
    const feeAmount = Number(maybeFee ?? 0);
    return sum + (Number.isFinite(feeAmount) ? feeAmount : 0);
  }, 0);

  return {
    config: {
      matchFeeBps: platformConfig.matchFeeBps,
      betFeeBps: platformConfig.betFeeBps,
      arcadeFeeFixed: platformConfig.arcadeFeeFixed.toString(),
      minEntryFee: platformConfig.minEntryFee.toString(),
      isActive: platformConfig.isActive,
      notes: platformConfig.notes ?? "",
    },
    settled: {
      amount: settled._sum.amount?.toString() ?? "0",
      count: settled._count,
    },
    pending: {
      amount: pending._sum.amount?.toString() ?? "0",
      count: pending._count,
    },
    failed: {
      amount: failed._sum.amount?.toString() ?? "0",
      count: failed._count,
    },
    byNetwork: byNetwork.map((item) => ({
      network: item.network,
      amount: item._sum.amount?.toString() ?? "0",
      count: item._count,
    })),
    feeCapture: {
      matchFees: capturedMatchFees.toFixed(6),
      betFees: capturedBetFees.toFixed(6),
      total: (capturedMatchFees + capturedBetFees).toFixed(6),
    },
  };
}

export async function getAdminSiteStatusSnapshot() {
  const [openMatches, inProgressMatches, pendingArcade, users, transactions] = await Promise.all([
    prisma.match.count({ where: { status: "OPEN" } }),
    prisma.match.count({ where: { status: "IN_PROGRESS" } }),
    prisma.match.count({ where: { status: "ARCADE_PENDING" } }),
    prisma.user.count(),
    prisma.transaction.count(),
  ]);

  return {
    openMatches,
    inProgressMatches,
    pendingArcade,
    users,
    transactions,
    generatedAt: new Date().toISOString(),
  };
}

export async function getMatchSnapshot(matchId: string, viewerId?: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      host: true,
      guest: true,
      winner: true,
      bets: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
      transactions: { orderBy: { createdAt: "desc" } },
      duels: {
        include: { attacker: true, defender: true, winner: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!match) {
    return null;
  }

  const pendingDuel = match.duels.find((duel) => !duel.resolvedAt) ?? null;
  const pendingDuelDefinition = pendingDuel
    ? {
        ...getArcadeDefinition(pendingDuel.gameType),
        timeLimitMs:
          match.isSolo
            ? getSoloArcadeTimeLimitMs({
                fen: match.fen,
                targetSquare: String((pendingDuel.boardMove as { to?: string })?.to ?? ""),
                attackerTurn: match.turn === "b" ? "b" : "w",
              })
            : getArcadeDefinition(pendingDuel.gameType).timeLimitMs,
      }
    : null;
  const totalBetPool = match.bets.reduce((sum, bet) => sum + Number(bet.amount.toString()), 0);
  const hostBetPool = match.bets
    .filter((bet) => bet.predictedWinnerId === match.hostId)
    .reduce((sum, bet) => sum + Number(bet.amount.toString()), 0);
  const guestBetPool = match.bets
    .filter((bet) => bet.predictedWinnerId === match.guestId)
    .reduce((sum, bet) => sum + Number(bet.amount.toString()), 0);
  const viewerBet = viewerId ? match.bets.find((bet) => bet.userId === viewerId) ?? null : null;
  const viewerRole = viewerId
    ? viewerId === match.hostId
      ? "host"
      : viewerId === match.guestId
        ? "guest"
        : "spectator"
    : "spectator";

  return {
    id: match.id,
    title: match.title,
    theme: match.theme,
    boardTheme: match.boardTheme,
    fen: match.fen,
    turn: match.turn,
    status: match.status,
    isSolo: match.isSolo,
    network: match.preferredNetwork,
    stakeAmount: decimalToString(match.stakeAmount),
    entryFee: decimalToString(match.entryFee),
    stakeToken: match.stakeToken,
    gameClockMs: match.gameClockMs,
    whiteClockMs: match.whiteClockMs,
    blackClockMs: match.blackClockMs,
    turnStartedAt: match.turnStartedAt?.toISOString() ?? null,
    host: match.host,
    guest: match.guest,
    winner: match.winner,
    moveHistory: asStringArray(match.moveHistory),
    arcadeGamePool: asStringArray(match.arcadeGamePool),
    transactions: match.transactions.map((transaction) => ({
      ...transaction,
      amount: transaction.amount.toString(),
    })),
    bets: match.bets.map((bet) => ({
      id: bet.id,
      userId: bet.userId,
      userName: bet.user.name,
      predictedWinnerId: bet.predictedWinnerId,
      amount: bet.amount.toString(),
      payoutAmount: bet.payoutAmount?.toString() ?? null,
      status: bet.status,
      createdAt: bet.createdAt.toISOString(),
    })),
    betting: {
      isOpen: Boolean(match.guestId && ["IN_PROGRESS", "ARCADE_PENDING"].includes(match.status)),
      totalPool: totalBetPool.toFixed(6),
      hostPool: hostBetPool.toFixed(6),
      guestPool: guestBetPool.toFixed(6),
      totalBettors: match.bets.length,
      viewerBet: viewerBet
        ? {
            id: viewerBet.id,
            predictedWinnerId: viewerBet.predictedWinnerId,
            amount: viewerBet.amount.toString(),
            payoutAmount: viewerBet.payoutAmount?.toString() ?? null,
            status: viewerBet.status,
          }
        : null,
    },
    viewerRole,
    pendingDuel: pendingDuel
      ? {
          id: pendingDuel.id,
          attackerId: pendingDuel.attackerId,
          defenderId: pendingDuel.defenderId,
          attackerEnteredAt: pendingDuel.attackerEnteredAt?.toISOString() ?? null,
          defenderEnteredAt: pendingDuel.defenderEnteredAt?.toISOString() ?? null,
          attackerName: pendingDuel.attacker.name,
          defenderName: match.isSolo ? "Arena Bot" : pendingDuel.defender.name,
          gameType: pendingDuel.gameType,
          game: pendingDuelDefinition ?? getArcadeDefinition(pendingDuel.gameType),
          seed: pendingDuel.seed,
          scenario: buildArcadeScenario(
            pendingDuel.gameType,
            viewerId === pendingDuel.attackerId
              ? `${pendingDuel.seed}:attacker`
              : `${pendingDuel.seed}:defender`,
          ),
          attackerScore: pendingDuel.attackerScore,
          defenderScore: pendingDuel.defenderScore,
          winnerId: pendingDuel.winnerId,
          boardMove: pendingDuel.boardMove as { from: string; to: string; san: string },
        }
      : null,
  };
}

export function isAdminRole(role: UserRole) {
  return role === UserRole.ADMIN;
}
