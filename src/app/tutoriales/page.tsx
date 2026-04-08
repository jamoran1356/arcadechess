import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function extractYouTubeId(url: string) {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/,
  );
  return m?.[1] ?? null;
}

export default async function TutorialesPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.tutorials;

  const videos = await prisma.tutorialVideo.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {/* Header */}
      <section>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
          {t.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          {t.subtitle}
        </p>
      </section>

      {/* Video grid */}
      {videos.length === 0 ? (
        <section className="panel rounded-[2rem] p-8 text-center">
          <p className="text-sm text-slate-400">{t.empty}</p>
        </section>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2">
          {videos.map((v) => {
            const ytId = extractYouTubeId(v.youtubeUrl);
            return (
              <article
                key={v.id}
                className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.02] transition hover:border-cyan-400/20"
              >
                {/* Embed */}
                {ytId ? (
                  <div className="relative aspect-video w-full">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                      title={v.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                ) : (
                  <a
                    href={v.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex aspect-video items-center justify-center bg-white/5 text-sm text-slate-500"
                  >
                    ▶ {t.watchOnYouTube}
                  </a>
                )}
                {/* Info */}
                <div className="p-5">
                  <h2 className="text-base font-semibold text-white">
                    {v.title}
                  </h2>
                  {v.description && (
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {v.description}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* CTA */}
      <section className="panel rounded-[2rem] p-8 text-center">
        <h2 className="text-xl font-bold text-white">{t.ctaTitle}</h2>
        <p className="mt-2 text-sm text-slate-400">{t.ctaDesc}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/ayuda" className="button-secondary px-6 py-3 text-sm text-white">
            {t.ctaFaq}
          </Link>
          <Link href="/lobby" className="button-primary px-6 py-3 text-sm">
            {t.ctaLobby}
          </Link>
        </div>
      </section>
    </div>
  );
}
