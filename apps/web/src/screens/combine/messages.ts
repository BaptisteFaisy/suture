import { makeTranslator, type Lang } from "../../i18n/lang";

/** Messages of this screen only — each screen owns its dictionary. */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "title": "Combine two versions",
    "placeholder": "The three-step assistant appears here: what applies on its own, the disagreements to decide, then the report and the download.",
  },
  fr: {
    "title": "Réunir deux versions",
    "placeholder": "L'assistant en trois temps apparaîtra ici : ce qui s'applique seul, les désaccords à trancher, puis le rapport et le téléchargement.",
  },
};

export const translateScreen = makeTranslator(screenMessages);
