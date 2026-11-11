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
    "error.not-a-zip": "This file is not a workbook archive.",
    "error.encrypted": "This workbook is password protected. Remove the password and try again.",
    "error.unsupported-format":
      "This format is not supported: only .xlsx and .xlsm workbooks are tracked.",
    "error.corrupt": "This file could not be read: the archive is damaged.",
    "error.too-large": "This workbook is too large (over 50 MB once decompressed).",
    "error.too-many-entries": "This workbook contains too many internal parts.",
    "error.zip-bomb": "This file is compressed in a suspicious way and was refused.",
    "error.too-many-cells": "This workbook has more than one million filled cells.",
    "error.missing-workbook": "This archive does not contain a workbook.",
    "error.no-common-origin":
      "These two versions have no common starting point: pick the version they both come from.",
    "error.disagreement-open": "Every disagreement must be decided before combining.",
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
    "error.not-a-zip": "Ce fichier n'est pas une archive de classeur.",
    "error.encrypted":
      "Ce classeur est protégé par un mot de passe. Retirez le mot de passe puis réessayez.",
    "error.unsupported-format":
      "Ce format n'est pas pris en charge : seuls les classeurs .xlsx et .xlsm sont suivis.",
    "error.corrupt": "Ce fichier n'a pas pu être lu : l'archive est endommagée.",
    "error.too-large": "Ce classeur est trop volumineux (plus de 50 Mo une fois décompressé).",
    "error.too-many-entries": "Ce classeur contient trop de parties internes.",
    "error.zip-bomb": "Ce fichier est compressé de façon suspecte et a été refusé.",
    "error.too-many-cells": "Ce classeur contient plus d'un million de cellules renseignées.",
    "error.missing-workbook": "Cette archive ne contient pas de classeur.",
    "error.no-common-origin":
      "Ces deux versions n'ont pas de point de départ commun : choisissez la version dont elles proviennent toutes les deux.",
    "error.disagreement-open": "Chaque désaccord doit être tranché avant la réunion.",
    "app.name": "Suture",
    "app.tagline":
      "Versions, scénarios et réunions pour ceux qui s'échangent des classeurs par courriel.",
    "footer.built":
      "Réalisé pour Kiroween 2026 — tout s'exécute localement dans votre navigateur.",
  },
};

export const translateCommon = makeTranslator(commonMessages);
