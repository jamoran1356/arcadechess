import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMatchSnapshot } from "@/lib/data";
import { syncMatchTimeoutIfNeeded } from "@/lib/match-engine";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  await syncMatchTimeoutIfNeeded(id);
  const match = await getMatchSnapshot(id, session.id);

  if (!match) {
    return NextResponse.json({ error: "La partida no existe." }, { status: 404 });
  }

  return NextResponse.json(match);
}
