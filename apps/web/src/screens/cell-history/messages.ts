import { makeTranslator, type Lang } from "../../i18n/lang";

/** Messages of this screen only — each screen owns its dictionary. */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "title": "Cell history",
    "placeholder": "Who changed this number, when, and what it was before.",
  },
  fr: {
    "title": "Histoire de la cellule",
    "placeholder": "Qui a changé ce chiffre, quand, et quelle était la valeur avant.",
  },
};

export const translateScreen = makeTranslator(screenMessages);
