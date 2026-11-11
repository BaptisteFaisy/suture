import { makeTranslator, type Lang } from "./lang";

/** Shared messages (navigation, common actions) — every screen may use them. */
export const commonMessages: Record<Lang, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.back": "Back",
    "nav.settings": "Settings",
    "action.cancel": "Cancel",
    "action.confirm": "Confirm",
    "action.download": "Download",
    "action.close": "Close",
    "state.loading": "Working…",
    "state.empty": "Nothing here yet.",
    "error.generic": "Something went wrong. The details are below.",
    "app.name": "Suture",
    "app.tagline":
      "Versions, scenarios and combines for people who exchange spreadsheets by email.",
    "footer.built":
      "Built for Kiroween 2026 — everything runs locally in your browser.",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.back": "Retour",
    "nav.settings": "Réglages",
    "action.cancel": "Annuler",
    "action.confirm": "Confirmer",
    "action.download": "Télécharger",
    "action.close": "Fermer",
    "state.loading": "Traitement en cours…",
    "state.empty": "Rien ici pour l'instant.",
    "error.generic": "Une erreur est survenue. Les détails sont ci-dessous.",
    "app.name": "Suture",
    "app.tagline":
      "Versions, scénarios et réunions pour ceux qui s'échangent des classeurs par courriel.",
    "footer.built":
      "Réalisé pour Kiroween 2026 — tout s'exécute localement dans votre navigateur.",
  },
};

export const translateCommon = makeTranslator(commonMessages);
