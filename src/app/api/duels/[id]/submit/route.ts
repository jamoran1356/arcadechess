import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { enforceBan } from "@/lib/ban";
import { submitArcadeAttempt } from "@/lib/match-engine";
import { duelAttemptSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const banResp = await enforceBan(session.id);
  if (banResp) return banResp;

  const payload = await request.json();
  const parsed = duelAttemptSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Intento invalido." }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const result = await submitArcadeAttempt(id, session.id, parsed.data);
    revalidatePath("/lobby");
    revalidatePath("/");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo validar el duelo." },
      { status: 400 },
    );
  }
}