import { translateCommon } from "../../i18n/common";
import type { Lang } from "../../i18n/lang";

/**
 * Messages of screen 6 only — each screen owns its dictionary. Shared strings
 * (actions, states) come from `i18n/common.ts` and are never duplicated here.
 */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "title": "Settings",
    "subtitle":
      "Who writes the versions, in which language, and what stays in this browser.",
    "author.title": "Author name",
    "author.label": "Name written on the versions you create",
    "author.placeholder": "Nadia",
    "author.save": "Save the name",
    "author.saved": "Author name saved. It will be written on your next versions.",
    "author.missing": "Write a name before saving.",
    "language.title": "Language",
    "language.label": "Interface language",
    "language.en": "English",
    "language.fr": "Français",
    "language.note":
      "The same choice is offered in the top bar; changing it here changes it everywhere.",
    "storage.title": "Storage",
    "storage.intro":
      "Your tracked workbooks stay in this browser. Nothing is sent anywhere.",
    "storage.usage": "Space used: {usage} of {quota} ({percent})",
    "storage.unavailable": "This browser does not report how much space is used.",
    "storage.persist": "Ask the browser to keep my data",
    "storage.persisted": "The browser agreed to keep your data.",
    "storage.persistRefused":
      "The browser may still clear the data on its own: export regularly.",
    "storage.persistUnsupported":
      "This browser cannot be asked to keep the data: export regularly.",
    "storage.reminder":
      "You are close to the space available: export your tracked workbooks now.",
    "storage.staleReminder":
      "It has been {days} days since your last export: export your tracked workbooks to keep a copy outside this browser.",
    "storage.clear": "Erase everything",
    "storage.clearTitle": "Erase everything?",
    "storage.clearHint":
      "Every tracked workbook stored in this browser will be erased. Export first if you want to keep the history.",
    "storage.clearConfirm": "Erase everything",
    "storage.cleared": "Everything stored in this browser has been erased.",
    "export.title": "Export everything",
    "export.intro":
      "One archive with every tracked workbook, so nothing depends on this browser alone.",
    "export.action": "Export everything",
    "export.working": "Preparing the archive…",
    "export.done": "Archive ready. Your download should have started.",
    "export.error": "The export failed. Nothing was erased.",
  },
  fr: {
    "title": "Réglages",
    "subtitle":
      "Qui écrit les versions, dans quelle langue, et ce qui reste dans ce navigateur.",
    "author.title": "Nom de l'auteur",
    "author.label": "Nom écrit sur les versions que vous créez",
    "author.placeholder": "Nadia",
    "author.save": "Enregistrer le nom",
    "author.saved":
      "Nom de l'auteur enregistré. Il sera écrit sur vos prochaines versions.",
    "author.missing": "Écrivez un nom avant d'enregistrer.",
    "language.title": "Langue",
    "language.label": "Langue de l'interface",
    "language.en": "English",
    "language.fr": "Français",
    "language.note":
      "Le même choix est proposé dans la barre du haut ; le changer ici le change partout.",
    "storage.title": "Stockage",
    "storage.intro":
      "Vos classeurs suivis restent dans ce navigateur. Rien n'est envoyé ailleurs.",
    "storage.usage": "Espace utilisé : {usage} sur {quota} ({percent})",
    "storage.unavailable":
      "Ce navigateur n'indique pas l'espace utilisé.",
    "storage.persist": "Demander au navigateur de garder mes données",
    "storage.persisted": "Le navigateur a accepté de garder vos données.",
    "storage.persistRefused":
      "Le navigateur peut encore effacer les données de lui-même : exportez régulièrement.",
    "storage.persistUnsupported":
      "Ce navigateur ne peut pas être prié de garder les données : exportez régulièrement.",
    "storage.reminder":
      "Vous approchez de l'espace disponible : exportez vos classeurs suivis maintenant.",
    "storage.staleReminder":
      "Cela fait {days} jours depuis votre dernier export : exportez vos classeurs suivis pour garder une copie hors de ce navigateur.",
    "storage.clear": "Tout effacer",
    "storage.clearTitle": "Tout effacer ?",
    "storage.clearHint":
      "Tous les classeurs suivis enregistrés dans ce navigateur seront effacés. Exportez d'abord si vous voulez garder l'historique.",
    "storage.clearConfirm": "Tout effacer",
    "storage.cleared": "Tout ce qui était stocké dans ce navigateur a été effacé.",
    "export.title": "Tout exporter",
    "export.intro":
      "Une archive avec tous les classeurs suivis, pour ne dépendre de ce navigateur seul.",
    "export.action": "Tout exporter",
    "export.working": "Préparation de l'archive…",
    "export.done": "Archive prête. Le téléchargement devrait avoir démarré.",
    "export.error": "L'export a échoué. Rien n'a été effacé.",
  },
};

/** Screen messages first, then the shared dictionary (no duplicated string). */
export function translateScreen(lang: Lang, key: string): string {
  return screenMessages[lang][key] ?? translateCommon(lang, key) ?? key;
}
