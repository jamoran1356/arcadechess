import "dotenv/config";
import { PrismaClient, ArcadeGameType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.wallet.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.arcadeDuel.deleteMany();
  await prisma.match.deleteMany();

  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["admin@playchess.gg", "luna@playchess.gg", "marco@playchess.gg"],
      },
    },
  });

  // Seed arcade games with contract addresses for each network
  await prisma.arcadeGame.deleteMany();
  await prisma.arcadeGame.createMany({
    data: [
      {
        name: "Target Rush",
        description: "Click as many targets as possible in the time limit.",
        gameType: ArcadeGameType.TARGET_RUSH,
        baseScore: 1000,
        difficultyMultiplier: "1.0",
        isEnabled: true,
        contractAddresses: {
          INITIA: "init1target_rush_game_contract_address_12345",
          FLOW: "0xa061e8a7d40a88b0",
          SOLANA: "PMCjtbjN15YvMxPoXdsrmr35RRDV5W5ASVdVEbF6PX6",
        },
        metadata: {
          description_long: "Reflex-based game where you tap targets that appear randomly on screen",
          duration_ms: 9000,
          difficulty_levels: [
            { level: 1, target_size: 80, spawn_rate: 0.5 },
            { level: 2, target_size: 60, spawn_rate: 0.7 },
            { level: 3, target_size: 40, spawn_rate: 1.0 },
          ],
        },
      },
      {
        name: "Memory Grid",
        description: "Memorize and repeat a sequence of cells.",
        gameType: ArcadeGameType.MEMORY_GRID,
        baseScore: 1000,
        difficultyMultiplier: "1.0",
        isEnabled: true,
        contractAddresses: {
          INITIA: "init1memory_grid_game_contract_address_12345",
          FLOW: "0xb873c87d4a9c2c11",
          SOLANA: "PMCjtbjN15YvMxPoXdsrmr35RRDV5W5ASVdVEbF6PX6",
        },
        metadata: {
          description_long: "Memory game where you must recall and repeat an increasingly complex sequence",
          grid_size: 4,
          duration_ms: 8000,
          cell_size: 100,
        },
      },
      {
        name: "Key Clash",
        description: "Press the correct keys in sequence against the timer.",
        gameType: ArcadeGameType.KEY_CLASH,
        baseScore: 1000,
        difficultyMultiplier: "1.0",
        isEnabled: true,
        contractAddresses: {
          INITIA: "init1key_clash_game_contract_address_12345",
          FLOW: "0xc5e2f8f4d8b3a5c2",
          SOLANA: "PMCjtbjN15YvMxPoXdsrmr35RRDV5W5ASVdVEbF6PX6",
        },
        metadata: {
          description_long: "Keyboard rhythm game where you must press keys in the correct sequence within time limits",
          duration_ms: 7000,
          base_difficulty: 8,
          key_sequence_length: 12,
        },
      },
    ],
  });

  console.log("✅ Database seed completed: demo users removed, gameplay tables reset, arcade games loaded");

  // Enable all 3 networks in platform config
  await prisma.platformConfig.upsert({
    where: { key: "default" },
    update: { enabledNetworks: ["INITIA", "SOLANA", "FLOW"] },
    create: { key: "default", enabledNetworks: ["INITIA", "SOLANA", "FLOW"] },
  });
  console.log("✅ Enabled networks: INITIA, SOLANA, FLOW");
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
