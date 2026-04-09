import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { enforceBan } from "@/lib/ban";
import { prisma } from "@/lib/db";
import { updateArcadeLiveState } from "@/lib/arcade-live";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const banResp = await enforceBan(session.id);
  if (banResp) return banResp;

  try {
    const { id } = await context.params;
    const payload = await request.json().catch(() => null);
    const actionCount = Number(payload?.actionCount ?? 0);
    const latestValue = typeof payload?.latestValue === "string" ? payload.latestValue.slice(0, 24) : null;

    if (!Number.isFinite(actionCount) || actionCount < 0) {
      return NextResponse.json({ error: "Progress inválido" }, { status: 400 });
    }

    const duel = await prisma.arcadeDuel.findUnique({
      where: { id },
      select: {
        id: true,
        attackerId: true,
        defenderId: true,
        resolvedAt: true,
      },
    });

    if (!duel) {
      return NextResponse.json({ error: "Duelo no encontrado" }, { status: 404 });
    }

    if (duel.resolvedAt) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const role = session.id === duel.attackerId ? "attacker" : session.id === duel.defenderId ? "defender" : null;
    if (!role) {
      return NextResponse.json({ error: "No eres participante en este duelo" }, { status: 403 });
    }

    updateArcadeLiveState({ duelId: duel.id, role, actionCount, latestValue });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Arcade progress sync error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
