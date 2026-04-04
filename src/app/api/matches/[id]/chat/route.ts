import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  In-memory chat rooms for match participants & spectators           */
/* ------------------------------------------------------------------ */

type ChatMessage = {
  id: number;
  userId: string;
  userName: string;
  text: string;
  ts: number; // Unix ms
};

type ChatRoom = {
  messages: ChatMessage[];
  seq: number;
  lastActivity: number;
};

const MAX_MESSAGES = 120;
const MAX_TEXT_LENGTH = 200;
const ROOM_TTL_MS = 3_600_000; // 1 hour idle cleanup

const rooms = new Map<string, ChatRoom>();

// Periodic cleanup of stale rooms
if (typeof globalThis !== "undefined") {
  const key = "__chat_cleanup__";
  if (!(globalThis as Record<string, unknown>)[key]) {
    (globalThis as Record<string, unknown>)[key] = true;
    setInterval(() => {
      const now = Date.now();
      for (const [id, room] of rooms) {
        if (now - room.lastActivity > ROOM_TTL_MS) rooms.delete(id);
      }
    }, 60_000);
  }
}

function getRoom(matchId: string): ChatRoom {
  let room = rooms.get(matchId);
  if (!room) {
    room = { messages: [], seq: 0, lastActivity: Date.now() };
    rooms.set(matchId, room);
  }
  return room;
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/matches/[id]/chat?after=<seq>
 * Returns messages with id > after (for polling).
 */
export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const after = Number(searchParams.get("after") ?? 0);

  const room = getRoom(id);
  room.lastActivity = Date.now();

  const newMessages = room.messages.filter((m) => m.id > after);
  return NextResponse.json({ messages: newMessages, seq: room.seq });
}

/**
 * POST /api/matches/[id]/chat
 * Body: { text: string }
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const text = String(body?.text ?? "").trim();

  if (!text || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `El mensaje debe tener entre 1 y ${MAX_TEXT_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  const room = getRoom(id);
  room.seq += 1;
  room.lastActivity = Date.now();

  const message: ChatMessage = {
    id: room.seq,
    userId: session.id,
    userName: session.name,
    text,
    ts: Date.now(),
  };

  room.messages.push(message);

  // Trim old messages
  if (room.messages.length > MAX_MESSAGES) {
    room.messages = room.messages.slice(-MAX_MESSAGES);
  }

  return NextResponse.json({ message, seq: room.seq });
}
