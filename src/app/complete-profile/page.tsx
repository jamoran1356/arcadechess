import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { CompleteProfileForm } from "@/components/complete-profile-form";

export default async function CompleteProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // If user already has a real profile, skip
  if (!session.email.endsWith("@wallet.playchess")) {
    redirect("/dashboard");
  }

  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-lg flex-col items-center justify-center px-4 py-12">
      <div className="panel w-full rounded-[2rem] p-8 sm:p-10">
        <p className="eyebrow">{dict.completeProfile.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{dict.completeProfile.title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">{dict.completeProfile.subtitle}</p>
        <CompleteProfileForm />
      </div>
    </div>
  );
}
