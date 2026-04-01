import { NextRequest, NextResponse } from "next/server";
import { TransactionNetwork } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireUser();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as { address?: string; network?: string };
  const address = String(body.address ?? "").trim();
  const network = String(body.network ?? "INITIA").toUpperCase();

  if (!address || address.length < 10) {
    return NextResponse.json({ error: "Dirección inválida" }, { status: 400 });
  }

  if (!Object.values(TransactionNetwork).includes(network as TransactionNetwork)) {
    return NextResponse.json({ error: "Red inválida" }, { status: 400 });
  }

  const existing = await prisma.wallet.findFirst({
    where: { userId: session.id, network: network as TransactionNetwork },
  });

  if (existing) {
    // Only update if currently a placeholder
    const isPlaceholder = existing.address.startsWith("initia_") ||
      existing.address.startsWith("flow_") ||
      existing.address.startsWith("solana_");

    if (isPlaceholder || existing.address !== address) {
      await prisma.wallet.update({
        where: { id: existing.id },
        data: { address },
      });
    }

    return NextResponse.json({ linked: true, walletId: existing.id });
  }

  const wallet = await prisma.wallet.create({
    data: {
      userId: session.id,
      network: network as TransactionNetwork,
      address,
      balance: "0",
    },
  });

  return NextResponse.json({ linked: true, walletId: wallet.id });
}
