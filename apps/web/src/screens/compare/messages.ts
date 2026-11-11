import { makeTranslator, type Lang } from "../../i18n/lang";

/** Messages of this screen only — each screen owns its dictionary. */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "title": "Compare two versions",
    "placeholder": "The change grid, the summary and the filters appear here.",
  },
  fr: {
    "title": "Comparer deux versions",
    "placeholder": "La grille des changements, le résumé et les filtres apparaîtront ici.",
  },
};

export const translateScreen = makeTranslator(screenMessages);
