/** Minimal i18n for the app shell — English default, French available. */

export type Lang = "en" | "fr";

export type MessageKey =
  | "app.tagline"
  | "home.workbooks.title"
  | "home.workbooks.empty"
  | "home.drop.title"
  | "home.drop.hint"
  | "home.drop.received"
  | "home.demo.load"
  | "home.demo.soon"
  | "settings.language"
  | "footer.built";

const EN: Record<MessageKey, string> = {
  "app.tagline":
    "Versions, scenarios and combines for people who exchange spreadsheets by email.",
  "home.workbooks.title": "Tracked workbooks",
  "home.workbooks.empty":
    "No tracked workbook yet. Drop a .xlsx file below to start one.",
  "home.drop.title": "Drop a workbook here",
  "home.drop.hint":
    ".xlsx and .xlsm, up to 50 MB decompressed. Nothing leaves your browser.",
  "home.drop.received":
    "File received. Tracking arrives in the next lot — the engines are landing.",
  "home.demo.load": "Load the demo workbook",
  "home.demo.soon": "Demo available in the next lot",
  "settings.language": "Language",
  "footer.built":
    "Built for Kiroween 2026 — everything runs locally in your browser.",
};

const FR: Record<MessageKey, string> = {
  "app.tagline":
    "Versions, scénarios et réunions pour ceux qui s'échangent des classeurs par courriel.",
  "home.workbooks.title": "Classeurs suivis",
  "home.workbooks.empty":
    "Aucun classeur suivi pour l'instant. Déposez un fichier .xlsx ci-dessous pour en créer un.",
  "home.drop.title": "Déposez un classeur ici",
  "home.drop.hint":
    ".xlsx et .xlsm, jusqu'à 50 Mo décompressés. Rien ne quitte votre navigateur.",
  "home.drop.received":
    "Fichier reçu. Le suivi arrive au prochain lot — les moteurs sont en cours.",
  "home.demo.load": "Charger le classeur de démonstration",
  "home.demo.soon": "Démonstration disponible au prochain lot",
  "settings.language": "Langue",
  "footer.built":
    "Réalisé pour Kiroween 2026 — tout s'exécute localement dans votre navigateur.",
};

const DICTS: Record<Lang, Record<MessageKey, string>> = { en: EN, fr: FR };

export function detectLang(): Lang {
  const nav = typeof navigator === "undefined" ? "" : navigator.language;
  return nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function translate(lang: Lang, key: MessageKey): string {
  return DICTS[lang][key];
}
