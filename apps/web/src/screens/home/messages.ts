import { makeTranslator, type Lang } from "../../i18n/lang";

/** Messages of this screen only — each screen owns its dictionary. */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "workbooks.title": "Tracked workbooks",
    "workbooks.empty": "No tracked workbook yet. Drop a .xlsx file below to start one.",
    "drop.title": "Drop a workbook here",
    "drop.hint": ".xlsx and .xlsm, up to 50 MB decompressed. Nothing leaves your browser.",
    "drop.picker": "or choose a file",
    "drop.tracking": "Tracking {name}…",
    "drop.tracked": "{name} is now a tracked workbook.",
    "demo.load": "Load the demo workbook",
    "demo.soon": "Demo available once the engines are wired",
    "demo.loading": "Loading the demo workbook…",
    "demo.error": "The demo workbook could not be loaded.",
  },
  fr: {
    "workbooks.title": "Classeurs suivis",
    "workbooks.empty": "Aucun classeur suivi pour l'instant. Déposez un fichier .xlsx ci-dessous pour en créer un.",
    "drop.title": "Déposez un classeur ici",
    "drop.hint": ".xlsx et .xlsm, jusqu'à 50 Mo décompressés. Rien ne quitte votre navigateur.",
    "drop.picker": "ou choisissez un fichier",
    "drop.tracking": "Suivi de {name}…",
    "drop.tracked": "{name} est maintenant un classeur suivi.",
    "demo.load": "Charger le classeur de démonstration",
    "demo.soon": "Démonstration disponible une fois les moteurs câblés",
    "demo.loading": "Chargement du classeur de démonstration…",
    "demo.error": "Le classeur de démonstration n'a pas pu être chargé.",
  },
};

export const translateScreen = makeTranslator(screenMessages);
