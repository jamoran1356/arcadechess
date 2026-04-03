import { NextResponse } from "next/server";
import { getSession, hasAdminAccess } from "@/lib/auth";
import { initiaAdapter } from "@/lib/onchain/initia";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const toAddress = String(body.toAddress ?? "").trim();
  const amount = Number(body.amount ?? 0);

  if (!toAddress.startsWith("init1") || toAddress.length < 40) {
    return NextResponse.json({ error: "Dirección de destino inválida." }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0." }, { status: 400 });
  }

  try {
    const result = await initiaAdapter.sendTokens(
      toAddress,
      amount,
      `playchess::admin_withdraw to ${toAddress}`,
    );

    return NextResponse.json({
      success: true,
      txHash: result.txHash,
      amount,
      toAddress,
    });
  } catch (err) {
    console.error("Admin withdraw error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al enviar fondos." },
      { status: 500 },
    );
  }
}
