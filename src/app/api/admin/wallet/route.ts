import { NextResponse } from "next/server";
import { getSession, hasAdminAccess } from "@/lib/auth";
import { getOnchainAdapter } from "@/lib/onchain/service";

const ADMIN_ADDRESS = process.env.NEXT_PUBLIC_INITIA_ADMIN_ADDRESS || "";

export async function GET() {
  const session = await getSession();
  if (!session || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adapter = getOnchainAdapter("INITIA");
  const balance = await adapter.queryBalance(ADMIN_ADDRESS);

  return NextResponse.json({
    address: ADMIN_ADDRESS,
    balance: balance?.amount ?? 0,
    denom: balance?.denom ?? "INIT",
  });
}
