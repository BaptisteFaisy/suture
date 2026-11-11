import { makeTranslator, type Lang } from "../../i18n/lang";

/** Messages of this screen only — each screen owns its dictionary. */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "title": "Settings",
    "placeholder": "Author name, language, storage and export.",
  },
  fr: {
    "title": "Réglages",
    "placeholder": "Nom de l'auteur, langue, stockage et export.",
  },
};

export const translateScreen = makeTranslator(screenMessages);
