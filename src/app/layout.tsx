import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import "./globals.css";
import { getLocale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { LocaleProvider } from "@/components/locale-provider";
import { InterwovenKitProviders } from "@/components/interwovenkit-providers";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "PlayChess Arena",
  description: "Chess with captures resolved by arcade duels and onchain stakes.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#1a120b] text-stone-100">
        <InterwovenKitProviders>
          <LocaleProvider locale={locale} dict={dict}>
            <div className="relative min-h-screen overflow-hidden">
          {/* Background layers */}
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(251,191,36,0.06),transparent)]" />
          <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />

          <Navbar session={session} logoutAction={logoutAction} />

          <main className="relative z-10 min-h-[calc(100vh-8rem)]">{children}</main>

          <Footer />
            </div>
          </LocaleProvider>
        </InterwovenKitProviders>
      </body>
    </html>
  );
}
