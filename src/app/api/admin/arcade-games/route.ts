import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { ArcadeGameType } from "@prisma/client";

// Validation schema
const arcadeGameSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  gameType: z.nativeEnum(ArcadeGameType),
  baseScore: z.number().int().positive("Base score must be positive"),
  difficultyMultiplier: z.string().transform(val => parseFloat(val)).refine(val => val > 0, "Difficulty multiplier must be positive"),
  isEnabled: z.boolean().default(true),
  contractAddresses: z.record(z.string(), z.string()),
  metadata: z.record(z.string(), z.any()).optional(),
});

type ArcadeGameInput = z.infer<typeof arcadeGameSchema>;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const games = await prisma.arcadeGame.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(games);
  } catch (error) {
    console.error("Failed to fetch arcade games:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = arcadeGameSchema.parse(body);

    // Check if game type already exists
    const existingGame = await prisma.arcadeGame.findUnique({
      where: { gameType: validatedData.gameType },
    });

    if (existingGame) {
      return NextResponse.json(
        { error: `Game type ${validatedData.gameType} already exists` },
        { status: 400 }
      );
    }

    const game = await prisma.arcadeGame.create({
      data: {
        ...validatedData,
        difficultyMultiplier: validatedData.difficultyMultiplier.toString(),
      },
    });

    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten().fieldErrors }, { status: 400 });
    }
    console.error("Failed to create arcade game:", error);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("id");

    if (!gameId) {
      return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
    }

    const body = await req.json();
    const validatedData = arcadeGameSchema.partial().parse(body);

    const game = await prisma.arcadeGame.update({
      where: { id: gameId },
      data: {
        ...validatedData,
        ...(validatedData.difficultyMultiplier && {
          difficultyMultiplier: validatedData.difficultyMultiplier.toString(),
        }),
      },
    });

    return NextResponse.json(game);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten().fieldErrors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    console.error("Failed to update arcade game:", error);
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("id");

    if (!gameId) {
      return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
    }

    await prisma.arcadeGame.delete({
      where: { id: gameId },
    });

    return NextResponse.json({ message: "Game deleted successfully" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    console.error("Failed to delete arcade game:", error);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}
