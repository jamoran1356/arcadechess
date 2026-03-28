import { NextResponse } from "next/server";
import { ArcadeGameType } from "@prisma/client";
import { evaluateArcadeAttempt } from "@/lib/arcade";
import { duelAttemptSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const payload = await request.json();
  const gameType = String(payload?.gameType ?? ArcadeGameType.TARGET_RUSH) as ArcadeGameType;
  const seed = String(payload?.seed ?? "arcade-test-seed");

  if (!Object.values(ArcadeGameType).includes(gameType)) {
    return NextResponse.json({ error: "gameType invalido" }, { status: 400 });
  }

  const parsed = duelAttemptSchema.safeParse(payload?.attempt);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Intento invalido." }, { status: 400 });
  }

  const result = evaluateArcadeAttempt(gameType, seed, parsed.data);
  const normalizedScore = Math.max(0, Math.round(Number(result.score ?? 0)));
  return NextResponse.json({
    valid: result.valid,
    score: normalizedScore,
    reason: result.reason ?? null,
  });
}
