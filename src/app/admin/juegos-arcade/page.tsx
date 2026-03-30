import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ArcadeGamesAdminClient } from "@/components/arcade-games-admin-client";

export const metadata = {
  title: "Arcade Games - Admin | PlayChess",
};

export default async function ArcadeGamesPage() {
  const session = await getSession();

  if (!session?.id || session.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-100">Arcade Games Management</h1>
        <p className="mt-2 text-slate-400">
          Create, update, and manage arcade minigames. Configure contract addresses for each blockchain network.
        </p>
      </div>

      <ArcadeGamesAdminClient />
    </main>
  );
}
