import { prisma } from "@/lib/db";

/**
 * Returns the ban reason if the user is banned, or null if they're in good standing.
 */
export async function checkBan(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bannedAt: true, banReason: true },
  });
  if (!user || !user.bannedAt) return null;
  return user.banReason ?? "Account banned.";
}

/**
 * Utility for API route handlers: returns a 403 Response if banned, or null if OK.
 */
export async function enforceBan(userId: string): Promise<Response | null> {
  const reason = await checkBan(userId);
  if (!reason) return null;
  return Response.json(
    { error: `Cuenta baneada: ${reason}` },
    { status: 403 },
  );
}
