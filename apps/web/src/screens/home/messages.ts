import { makeTranslator, type Lang } from "../../i18n/lang";

/** Messages of this screen only — each screen owns its dictionary. */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "workbooks.title": "Tracked workbooks",
    "workbooks.empty": "No tracked workbook yet. Drop a .xlsx file below to start one.",
    "drop.title": "Drop a workbook here",
    "drop.hint": ".xlsx and .xlsm, up to 50 MB decompressed. Nothing leaves your browser.",
    "drop.received": "File received. Tracking arrives with the version store.",
    "demo.load": "Load the demo workbook",
    "demo.soon": "Demo available once the engines are wired",
  },
  fr: {
    "workbooks.title": "Classeurs suivis",
    "workbooks.empty": "Aucun classeur suivi pour l'instant. Déposez un fichier .xlsx ci-dessous pour en créer un.",
    "drop.title": "Déposez un classeur ici",
    "drop.hint": ".xlsx et .xlsm, jusqu'à 50 Mo décompressés. Rien ne quitte votre navigateur.",
    "drop.received": "Fichier reçu. Le suivi arrive avec le magasin de versions.",
    "demo.load": "Charger le classeur de démonstration",
    "demo.soon": "Démonstration disponible une fois les moteurs câblés",
  },
};

export const translateScreen = makeTranslator(screenMessages);
