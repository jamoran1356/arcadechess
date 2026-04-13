import { AuthForm } from "@/components/auth-form";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";

export default async function LoginPage() {
  const locale = await getLocale();
  const { login: t } = getDictionary(locale);
  return (
    <div className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
      <div className="flex flex-col justify-center">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="mt-3 text-5xl font-semibold leading-none text-white">{t.title}</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">{t.subtitle}</p>
      </div>

      <div className="flex items-center justify-center">
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
