import { AuthForm } from "@/components/auth-form";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";

export default async function RegisterPage() {
  const locale = await getLocale();
  const { register: t } = getDictionary(locale);
  return (
    <div className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
      <div className="flex items-center justify-center order-2 lg:order-1">
        <AuthForm mode="register" />
      </div>

      <div className="order-1 flex flex-col justify-center lg:order-2">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-3 text-5xl font-semibold leading-none text-white">{t.title}</h1>
        <div className="mt-8 grid gap-4">
          <article className="panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold text-white">{t.f1Title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t.f1Desc}</p>
          </article>
          <article className="panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold text-white">{t.f2Title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t.f2Desc}</p>
          </article>
          <article className="panel rounded-[1.75rem] p-6">
            <h2 className="text-xl font-semibold text-white">{t.f3Title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t.f3Desc}</p>
          </article>
        </div>
      </div>
    </div>
  );
}
