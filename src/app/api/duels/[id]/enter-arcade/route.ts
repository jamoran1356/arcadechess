import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Registra que un jugador (atacante o defensor) ha entrado al minijuego arcade.
 * Esto es crucial para el sistema de penalización automática.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    const duel = await prisma.arcadeDuel.findUnique({
      where: { id },
      include: { match: true },
    });

    if (!duel) {
      return NextResponse.json({ error: "Duelo no encontrado" }, { status: 404 });
    }

    const isAttacker = session.id === duel.attackerId;
    const isDefender = session.id === duel.defenderId;

    if (!isAttacker && !isDefender) {
      return NextResponse.json(
        { error: "No eres participante en este duelo" },
        { status: 403 },
      );
    }

    if (duel.resolvedAt) {
      return NextResponse.json(
        { error: "El duelo ya fue resuelto" },
        { status: 400 },
      );
    }

    const updatedDuel = await prisma.arcadeDuel.update({
      where: { id },
      data: isAttacker
        ? { attackerEnteredAt: new Date() }
        : { defenderEnteredAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      role: isAttacker ? "attacker" : "defender",
      duelId: id,
      enteredAt: isAttacker
        ? updatedDuel.attackerEnteredAt
        : updatedDuel.defenderEnteredAt,
    });
  } catch (error) {
    console.error("Arcade participation register error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
