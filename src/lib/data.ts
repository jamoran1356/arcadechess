import { Prisma, TransactionStatus, UserRole } from "@prisma/client";
import { buildArcadeScenario, getArcadeDefinition, arcadeLibrary } from "@/lib/arcade";
import { prisma } from "@/lib/db";
import { getSupportedNetworks } from "@/lib/onchain/service";

function decimalToString(value: Prisma.Decimal) {
  return value.toString();
}

function asStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map(String) : [];
}

export async function getLandingSnapshot() {
  const [openMatches, usersCount, transactionsCount] = await Promise.all([
    prisma.match.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "ARCADE_PENDING"] } },
      include: { host: true, guest: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.user.count(),
    prisma.transaction.count(),
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
      stakeToken: match.stakeToken,
      network: match.preferredNetwork,
      host: match.host.name,
      guest: match.guest?.name ?? null,
      createdAt: match.createdAt.toISOString(),
      arcadeGamePool: asStringArray(match.arcadeGamePool),
    })),
    networks: getSupportedNetworks(),
    arcadeLibrary,
  };
}

export async function getLobbySnapshot(userId?: string) {
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
      stakeToken: match.stakeToken,
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

export async function getAdminUsersSnapshot() {
  return prisma.user.findMany({
    include: { wallets: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getAdminTransactionsSnapshot() {
  return prisma.transaction.findMany({
    include: { user: true, match: true },
    orderBy: { createdAt: "desc" },
    take: 120,
  });
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
  const [settled, pending, failed, byNetwork] = await Promise.all([
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
  ]);

  return {
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
    stakeToken: match.stakeToken,
    host: match.host,
    guest: match.guest,
    winner: match.winner,
    moveHistory: asStringArray(match.moveHistory),
    arcadeGamePool: asStringArray(match.arcadeGamePool),
    transactions: match.transactions.map((transaction) => ({
      ...transaction,
      amount: transaction.amount.toString(),
    })),
    viewerRole,
    pendingDuel: pendingDuel
      ? {
          id: pendingDuel.id,
          attackerId: pendingDuel.attackerId,
          defenderId: pendingDuel.defenderId,
          attackerName: pendingDuel.attacker.name,
          defenderName: pendingDuel.defender.name,
          gameType: pendingDuel.gameType,
          game: getArcadeDefinition(pendingDuel.gameType),
          seed: pendingDuel.seed,
          scenario: buildArcadeScenario(pendingDuel.gameType, pendingDuel.seed),
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
