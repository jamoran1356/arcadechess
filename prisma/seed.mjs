import "dotenv/config";
import { PrismaClient, TransactionNetwork, UserRole, MatchStatus, TransactionStatus, TransactionType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Chess } from "chess.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

function walletAddress(network, slug) {
  return `${network.toLowerCase()}_${slug}`;
}

async function main() {
  const adminPassword = await bcrypt.hash("Admin123!", 10);
  const demoPassword = await bcrypt.hash("Demo123!", 10);

  const [admin, luna, marco] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@playchess.gg" },
      update: { name: "Admin Arena", passwordHash: adminPassword, role: UserRole.ADMIN },
      create: {
        name: "Admin Arena",
        email: "admin@playchess.gg",
        passwordHash: adminPassword,
        role: UserRole.ADMIN,
        rating: 1420,
      },
    }),
    prisma.user.upsert({
      where: { email: "luna@playchess.gg" },
      update: { name: "Luna Gambit", passwordHash: demoPassword },
      create: {
        name: "Luna Gambit",
        email: "luna@playchess.gg",
        passwordHash: demoPassword,
        rating: 1350,
      },
    }),
    prisma.user.upsert({
      where: { email: "marco@playchess.gg" },
      update: { name: "Marco Blitz", passwordHash: demoPassword },
      create: {
        name: "Marco Blitz",
        email: "marco@playchess.gg",
        passwordHash: demoPassword,
        rating: 1310,
      },
    }),
  ]);

  await prisma.wallet.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.arcadeDuel.deleteMany();
  await prisma.match.deleteMany();

  await prisma.wallet.createMany({
    data: [admin, luna, marco].flatMap((user) => [
      { userId: user.id, network: TransactionNetwork.INITIA, address: walletAddress(TransactionNetwork.INITIA, user.id), balance: "250.00" },
      { userId: user.id, network: TransactionNetwork.FLOW, address: walletAddress(TransactionNetwork.FLOW, user.id), balance: "120.00" },
      { userId: user.id, network: TransactionNetwork.SOLANA, address: walletAddress(TransactionNetwork.SOLANA, user.id), balance: "80.00" },
    ]),
  });

  const liveBoard = new Chess();
  liveBoard.move("e4");
  liveBoard.move("e5");
  liveBoard.move("Nf3");
  liveBoard.move("Nc6");

  const matches = await prisma.$transaction([
    prisma.match.create({
      data: {
        title: "Arena Neon Stake #1",
        theme: "Cyber city con apuestas sincronizadas",
        boardTheme: "neon-grid",
        stakeAmount: "15.000000",
        stakeToken: "INIT",
        preferredNetwork: TransactionNetwork.INITIA,
        fen: new Chess().fen(),
        moveHistory: [],
        arcadeGamePool: ["TARGET_RUSH", "MEMORY_GRID", "KEY_CLASH"],
        status: MatchStatus.OPEN,
        hostId: luna.id,
      },
    }),
    prisma.match.create({
      data: {
        title: "Flow Bazaar Duel",
        theme: "Mercado flotante con minijuegos de reflejos",
        boardTheme: "flow-bloom",
        stakeAmount: "8.500000",
        stakeToken: "FLOW",
        preferredNetwork: TransactionNetwork.FLOW,
        fen: liveBoard.fen(),
        moveHistory: ["e4", "e5", "Nf3", "Nc6"],
        arcadeGamePool: ["TARGET_RUSH", "KEY_CLASH"],
        status: MatchStatus.IN_PROGRESS,
        hostId: marco.id,
        guestId: luna.id,
      },
    }),
    prisma.match.create({
      data: {
        title: "Solana Speed Circuit",
        theme: "Circuito de velocidad con capturas por arcade",
        boardTheme: "sol-track",
        stakeAmount: "2.250000",
        stakeToken: "SOL",
        preferredNetwork: TransactionNetwork.SOLANA,
        fen: new Chess().fen(),
        moveHistory: [],
        arcadeGamePool: ["MEMORY_GRID", "KEY_CLASH"],
        status: MatchStatus.OPEN,
        hostId: admin.id,
      },
    }),
  ]);

  await prisma.transaction.createMany({
    data: [
      {
        userId: luna.id,
        matchId: matches[0].id,
        network: TransactionNetwork.INITIA,
        type: TransactionType.ESCROW_LOCK,
        status: TransactionStatus.SETTLED,
        amount: "15.000000",
        token: "INIT",
        txHash: "initia_demo_escrow_luna",
        metadata: { role: "host" },
      },
      {
        userId: marco.id,
        matchId: matches[1].id,
        network: TransactionNetwork.FLOW,
        type: TransactionType.ENTRY_STAKE,
        status: TransactionStatus.SETTLED,
        amount: "8.500000",
        token: "FLOW",
        txHash: "flow_demo_join_marco",
        metadata: { role: "host" },
      },
      {
        userId: luna.id,
        matchId: matches[1].id,
        network: TransactionNetwork.FLOW,
        type: TransactionType.ENTRY_STAKE,
        status: TransactionStatus.SETTLED,
        amount: "8.500000",
        token: "FLOW",
        txHash: "flow_demo_join_luna",
        metadata: { role: "guest" },
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
