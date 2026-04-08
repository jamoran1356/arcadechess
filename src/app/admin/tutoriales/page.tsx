import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createTutorialVideoAction,
  updateTutorialVideoAction,
  deleteTutorialVideoAction,
} from "@/lib/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tutoriales - Admin | PlayChess" };

function extractYouTubeId(url: string) {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/,
  );
  return m?.[1] ?? null;
}

export default async function TutorialesAdminPage() {
  const session = await getSession();
  if (!session?.id || session.role !== "ADMIN") redirect("/login");

  const videos = await prisma.tutorialVideo.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-100">Tutoriales</h1>
        <p className="mt-2 text-slate-400">
          Agrega videos de YouTube para ayudar a los usuarios. Se muestran en la
          sección de ayuda.
        </p>
      </div>

      {/* ── Add new video ─────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold text-white">Agregar video</h2>
        <form action={createTutorialVideoAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Título *</label>
            <input
              name="title"
              required
              placeholder="Cómo agregar fondos testnet a la billetera"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/40"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Descripción</label>
            <input
              name="description"
              placeholder="Breve descripción del tutorial (opcional)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">URL de YouTube *</label>
            <input
              name="youtubeUrl"
              required
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Orden</label>
            <input
              name="sortOrder"
              type="number"
              defaultValue={0}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/40"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400"
            >
              Agregar tutorial
            </button>
          </div>
        </form>
      </section>

      {/* ── Existing videos ───────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Videos existentes ({videos.length})
        </h2>

        {videos.length === 0 ? (
          <p className="text-sm text-slate-500">No hay tutoriales aún.</p>
        ) : (
          <div className="grid gap-4">
            {videos.map((v) => {
              const ytId = extractYouTubeId(v.youtubeUrl);
              return (
                <div
                  key={v.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 lg:flex-row"
                >
                  {/* Thumbnail */}
                  {ytId && (
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                      alt={v.title}
                      className="h-28 w-48 shrink-0 rounded-xl object-cover"
                    />
                  )}

                  {/* Edit form */}
                  <form
                    action={updateTutorialVideoAction}
                    className="flex flex-1 flex-col gap-3"
                  >
                    <input type="hidden" name="id" value={v.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        name="title"
                        defaultValue={v.title}
                        required
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      />
                      <input
                        name="youtubeUrl"
                        defaultValue={v.youtubeUrl}
                        required
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      />
                      <input
                        name="description"
                        defaultValue={v.description ?? ""}
                        placeholder="Descripción"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      />
                      <div className="flex gap-3">
                        <input
                          name="sortOrder"
                          type="number"
                          defaultValue={v.sortOrder}
                          className="w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                        />
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                          <input
                            type="hidden"
                            name="isActive"
                            value="false"
                          />
                          <input
                            type="checkbox"
                            name="isActive"
                            value="true"
                            defaultChecked={v.isActive}
                            className="accent-cyan-400"
                          />
                          Activo
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                      >
                        Guardar
                      </button>
                    </div>
                  </form>

                  {/* Delete */}
                  <form action={deleteTutorialVideoAction} className="shrink-0 self-start">
                    <input type="hidden" name="id" value={v.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-red-400/30 bg-red-400/10 px-4 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-400/20"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
