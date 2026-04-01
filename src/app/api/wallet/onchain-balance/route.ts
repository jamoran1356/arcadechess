import { NextRequest, NextResponse } from "next/server";
import { TransactionNetwork } from "@prisma/client";
import { getOnchainAdapter } from "@/lib/onchain/service";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const network = request.nextUrl.searchParams.get("network") as TransactionNetwork | null;

  if (!address || !network) {
    return NextResponse.json({ error: "address and network are required" }, { status: 400 });
  }

  if (!Object.values(TransactionNetwork).includes(network)) {
    return NextResponse.json({ error: "Invalid network" }, { status: 400 });
  }

  const adapter = getOnchainAdapter(network);
  const result = await adapter.queryBalance(address);

  return NextResponse.json(result);
}
