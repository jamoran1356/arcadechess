import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { performMatchMove } from "@/lib/match-engine";
import { moveSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = moveSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Movimiento invalido." }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const result = await performMatchMove(id, session.id, parsed.data);
    revalidatePath(`/match/${id}`);
    revalidatePath("/lobby");
    revalidatePath("/");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo mover la pieza." },
      { status: 400 },
    );
  }
}
