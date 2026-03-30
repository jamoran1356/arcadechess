import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const games = await prisma.arcadeGame.findMany({
      where: { isEnabled: true },
      select: {
        id: true,
        name: true,
        description: true,
        gameType: true,
        baseScore: true,
        difficultyMultiplier: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(games);
  } catch (error) {
    console.error("Failed to fetch arcade games:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
