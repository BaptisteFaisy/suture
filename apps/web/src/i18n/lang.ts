/** Language selection shared by every screen. */
import { createContext, useContext } from "react";

export type Lang = "en" | "fr";

export interface LangState {
  lang: Lang;
  setLang(lang: Lang): void;
}

export const LangContext = createContext<LangState | null>(null);

export function useLang(): LangState {
  const state = useContext(LangContext);
  if (state === null) {
    throw new Error("useLang must be used inside LangContext");
  }
  return state;
}

export function detectLang(): Lang {
  const nav = typeof navigator === "undefined" ? "" : navigator.language;
  return nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** Translator factory: each screen owns its own message dictionaries. */
export function makeTranslator<M extends Record<string, string>>(
  messages: Record<Lang, M>,
) {
  return function translate(lang: Lang, key: keyof M & string): string {
    return messages[lang][key] ?? messages.en[key] ?? key;
  };
}
