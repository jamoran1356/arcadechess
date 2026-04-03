import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  In-memory room state for real-time pong sync between two players  */
/* ------------------------------------------------------------------ */

type PongRoom = {
  attackerPaddleY: number;
  defenderPaddleY: number;
  ball: { x: number; y: number };
  attackerScore: number;
  defenderScore: number;
  over: boolean;
  defenderConnected: boolean;
  ts: number; // last activity timestamp for cleanup
};

const rooms = new Map<string, PongRoom>();

// Periodically prune stale rooms (idle > 120s)
if (typeof globalThis !== "undefined") {
  const key = "__pong_cleanup__";
  if (!(globalThis as Record<string, unknown>)[key]) {
    (globalThis as Record<string, unknown>)[key] = true;
    setInterval(() => {
      const now = Date.now();
      for (const [id, room] of rooms) {
        if (now - room.ts > 120_000) rooms.delete(id);
      }
    }, 15_000);
  }
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/duels/[id]/pong-sync
 *
 * Body:
 *  - role: "attacker" | "defender"
 *  - paddleY: number
 *  - state?: { ball, attackerScore, defenderScore, over }  (only from attacker)
 *
 * Returns the full room state so each player can render the game.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { role, paddleY, state } = body as {
    role: "attacker" | "defender";
    paddleY: number;
    state?: {
      ball: { x: number; y: number };
      attackerScore: number;
      defenderScore: number;
      over: boolean;
    };
  };

  if (role !== "attacker" && role !== "defender") {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  let room = rooms.get(id);
  if (!room) {
    room = {
      attackerPaddleY: 150,
      defenderPaddleY: 150,
      ball: { x: 240, y: 150 },
      attackerScore: 0,
      defenderScore: 0,
      over: false,
      defenderConnected: false,
      ts: Date.now(),
    };
    rooms.set(id, room);
  }

  room.ts = Date.now();

  if (role === "attacker") {
    room.attackerPaddleY = paddleY;
    if (state) {
      room.ball = state.ball;
      room.attackerScore = state.attackerScore;
      room.defenderScore = state.defenderScore;
      room.over = state.over;
    }
  } else {
    room.defenderPaddleY = paddleY;
    room.defenderConnected = true;
  }

  return NextResponse.json({
    attackerPaddleY: room.attackerPaddleY,
    defenderPaddleY: room.defenderPaddleY,
    ball: room.ball,
    attackerScore: room.attackerScore,
    defenderScore: room.defenderScore,
    over: room.over,
    defenderConnected: room.defenderConnected,
  });
}
