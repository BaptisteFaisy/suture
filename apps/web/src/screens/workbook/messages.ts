import { makeTranslator, type Lang } from "../../i18n/lang";

/** Messages of this screen only — each screen owns its dictionary. */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "title": "Versions and scenarios",
    "placeholder": "The history graph, the scenarios and the milestones appear here once the version store is wired.",
  },
  fr: {
    "title": "Versions et scénarios",
    "placeholder": "Le graphe d'historique, les scénarios et les jalons apparaîtront ici une fois le magasin de versions câblé.",
  },
};

export const translateScreen = makeTranslator(screenMessages);
