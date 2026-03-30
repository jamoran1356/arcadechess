import { es } from "./es";
import { en } from "./en";

export type Locale = "es" | "en";
export type Dict = typeof es;

export function getDictionary(locale: Locale): Dict {
  return locale === "en" ? (en as unknown as Dict) : es;
}
