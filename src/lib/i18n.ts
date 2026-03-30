import { cookies } from "next/headers";
import type { Locale } from "@/dictionaries";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get("NEXT_LOCALE")?.value;
  return value === "en" ? "en" : "es";
}
