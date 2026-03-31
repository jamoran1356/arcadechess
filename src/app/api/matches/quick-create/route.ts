import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Sistema de generación automática de partidas "quick play".
 * Endpoint /api/matches/quick-create crea una partida con config preestablecida lista para ser jugada.
 *
 * Parámetros:
 * - stakeAmount: Decimal (cantidad a apostar, 0 para gratuitas)
 * - entryFee: Decimal (fee para entrar, 0 si es gratuito)
 * - gameClockMs: Int (tiempo del reloj en ms: 60000 = 1 min, 300000 = 5 min, 600000 = 10 min)
 * - network: TransactionNetwork (SOLANA, FLOW, INITIA)
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.INTERNAL_API_SECRET || "dev-secret";

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      stakeAmount = "0",
      entryFee = "0",
      gameClockMs = 300000, // 5 min por default
      network = "SOLANA",
      title,
      hostId,
    } = body;

    // Validar que hostId existe
    if (!hostId) {
      return NextResponse.json(
        { error: "hostId es requerido" },
        { status: 400 },
      );
    }

    const host = await prisma.user.findUnique({
      where: { id: hostId },
    });

    if (!host) {
      return NextResponse.json(
        { error: "Host no encontrado" },
        { status: 404 },
      );
    }

    // Crear la partida
    const match = await prisma.match.create({
      data: {
        title: title || `Partida ${new Date().toLocaleTimeString()}`,
        theme: "arcade",
        boardTheme: "arena",
        stakeAmount: String(stakeAmount),
        stakeToken: "INIT",
        entryFee: String(entryFee),
        preferredNetwork: String(network) as "INITIA" | "FLOW" | "SOLANA",
        arcadeGamePool: ["TARGET_RUSH", "MEMORY_GRID", "KEY_CLASH"],
        gameClockMs: Number(gameClockMs),
        whiteClockMs: Number(gameClockMs),
        blackClockMs: Number(gameClockMs),
        turnStartedAt: null,
        isSolo: false,
        status: "OPEN",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moveHistory: [],
        hostId,
      },
    });

    return NextResponse.json({
      success: true,
      matchId: match.id,
      status: match.status,
      stakeAmount: match.stakeAmount,
      entryFee: match.entryFee,
      gameClockMs: match.gameClockMs,
      joinUrl: `/match/${match.id}`,
    });
  } catch (error) {
    console.error("Quick create match error:", error);
    return NextResponse.json(
      { error: "Error creando partida" },
      { status: 500 },
    );
  }
}

/**
 * GET: Obtener estado actual de partidas disponibles para jugar.
 * Retorna partidas abiertas con stake config, fee, y cuánto tiempo llevan esperando.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);

    const openMatches = await prisma.match.findMany({
      where: {
        status: "OPEN",
        guestId: null,
      },
      select: {
        id: true,
        title: true,
        stakeAmount: true,
        entryFee: true,
        gameClockMs: true,
        preferredNetwork: true,
        host: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const formatted = openMatches.map((m: {
      id: string;
      title: string;
      stakeAmount: { toString(): string };
      entryFee: { toString(): string };
      gameClockMs: number;
      preferredNetwork: "INITIA" | "FLOW" | "SOLANA";
      host: { id: string; name: string };
      createdAt: Date;
    }) => {
      const waitTimeMs = Date.now() - m.createdAt.getTime();
      return {
        ...m,
        stakeAmount: m.stakeAmount.toString(),
        entryFee: m.entryFee.toString(),
        waitTimeMs,
      };
    });

    return NextResponse.json({
      total: formatted.length,
      matches: formatted,
    });
  } catch (error) {
    console.error("List open matches error:", error);
    return NextResponse.json(
      { error: "Error listando partidas" },
      { status: 500 },
    );
  }
}
