import { translateCommon } from "../../i18n/common";
import type { Lang } from "../../i18n/lang";

/**
 * Messages of screen 2 only — each screen owns its dictionary. Shared strings
 * (actions, states) come from `i18n/common.ts` and are never duplicated here.
 */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "title": "Versions and scenarios",
    "subtitle":
      "Every version stays on the thread. Nothing is erased: restoring adds a new version.",
    "noWorkbook":
      "Open a tracked workbook to see its thread, its versions and its scenarios.",
    "graph.label": "History thread",
    "graph.caption":
      "One continuous thread: each point is a version, each parallel thread a scenario, each suture a combine of two versions.",
    "graph.point": "Version point",
    "versions.title": "Versions",
    "versions.empty": "No version yet. Track a workbook to create the first one.",
    "versions.rank": "Version",
    "versions.untitled": "No version note",
    "versions.oneOrigin": "1 origin",
    "versions.twoOrigins": "2 origins (a combine)",
    "versions.milestone": "Set a milestone",
    "versions.restore": "Restore",
    "versions.selected": "Selected version",
    "scenarios.title": "Scenarios",
    "scenarios.empty": "No scenario yet. Create one to test an assumption.",
    "scenarios.create": "New scenario",
    "scenarios.submit": "Create",
    "scenarios.fromVersion": "Starting from:",
    "scenarios.pickVersionFirst": "Select a version first.",
    "scenarios.reference": "Reference",
    "scenarios.makeReference": "Make this the reference",
    "scenarios.referenceUnavailable":
      "Changing the reference is not offered by the version store yet.",
    "milestone.title": "Name this version",
    "milestone.hint":
      "A milestone marks an important version on the thread, for example the budget adopted before the board meeting.",
    "milestone.inputLabel": "Milestone name",
    "milestone.save": "Set the milestone",
    "restore.title": "Restore this version?",
    "restore.hint":
      "A new version is added, with exactly the content of the one you picked.",
    "restore.reassurance":
      "No version is erased: the whole thread stays readable afterwards.",
    "restore.confirm": "Restore",
    "status.milestoneSet": "Milestone set.",
    "status.restored": "Version restored. A new version was added.",
    "status.scenarioCreated": "Scenario created.",
    "status.referenceSet": "The reference has changed.",
  },
  fr: {
    "title": "Versions et scénarios",
    "subtitle":
      "Chaque version reste sur le fil. Rien n'est effacé : une restauration ajoute une nouvelle version.",
    "noWorkbook":
      "Ouvrez un classeur suivi pour voir son fil, ses versions et ses scénarios.",
    "graph.label": "Fil de l'historique",
    "graph.caption":
      "Un fil continu : chaque point est une version, chaque fil parallèle un scénario, chaque suture une réunion de deux versions.",
    "graph.point": "Point de version",
    "versions.title": "Versions",
    "versions.empty":
      "Aucune version pour l'instant. Suivez un classeur pour créer la première.",
    "versions.rank": "Version",
    "versions.untitled": "Sans note de version",
    "versions.oneOrigin": "1 origine",
    "versions.twoOrigins": "2 origines (une réunion)",
    "versions.milestone": "Mettre un jalon",
    "versions.restore": "Restaurer",
    "versions.selected": "Version sélectionnée",
    "scenarios.title": "Scénarios",
    "scenarios.empty":
      "Aucun scénario pour l'instant. Créez-en un pour tester une hypothèse.",
    "scenarios.create": "Nouveau scénario",
    "scenarios.submit": "Créer",
    "scenarios.fromVersion": "À partir de :",
    "scenarios.pickVersionFirst": "Sélectionnez d'abord une version.",
    "scenarios.reference": "Référence",
    "scenarios.makeReference": "En faire la référence",
    "scenarios.referenceUnavailable":
      "Changer la référence n'est pas encore proposé par le magasin de versions.",
    "milestone.title": "Nommer cette version",
    "milestone.hint":
      "Un jalon marque une version importante sur le fil, par exemple le budget voté avant le conseil.",
    "milestone.inputLabel": "Nom du jalon",
    "milestone.save": "Mettre le jalon",
    "restore.title": "Restaurer cette version ?",
    "restore.hint":
      "Une nouvelle version est ajoutée, avec exactement le contenu de celle que vous avez choisie.",
    "restore.reassurance":
      "Aucune version n'est effacée : tout le fil reste lisible ensuite.",
    "restore.confirm": "Restaurer",
    "status.milestoneSet": "Jalon posé.",
    "status.restored": "Version restaurée. Une nouvelle version a été ajoutée.",
    "status.scenarioCreated": "Scénario créé.",
    "status.referenceSet": "La référence a changé.",
  },
};

/** Screen messages first, then the shared dictionary (no duplicated string). */
export function translateScreen(lang: Lang, key: string): string {
  return screenMessages[lang][key] ?? translateCommon(lang, key) ?? key;
}
