import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { ArcadeTestClient } from "@/components/arcade-test-client";

export const dynamic = "force-dynamic";

export default async function ArcadeTestPage() {
  await requireUser();
  const locale = await getLocale();
  const { arcadeTest: t } = getDictionary(locale);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">{t.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{t.desc}</p>
      </section>

      <ArcadeTestClient />
    </div>
  );
}
