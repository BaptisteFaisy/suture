import { makeTranslator, type Lang } from "../../../i18n/lang";

/**
 * Messages of the developer-facing export panel. This is the only place in the
 * interface allowed to name the underlying format: the feature exists for the
 * counter-persona (a developer who already has Git). The file lives under a
 * path the vocabulary guard exempts (`.../workbook/export/`).
 */
export const exportMessages: Record<Lang, Record<string, string>> = {
  en: {
    "title": "Export for developers",
    "intro":
      "This produces a ZIP archive containing a clonable Git repository of the tracked workbook: the versions, the scenarios and the milestones, with a readable one-line-per-cell view under cells/.",
    "onlyPlace":
      "This panel is the only place in Suture that names the underlying format. Everything else speaks office language.",
    "action": "Produce the archive",
    "steps.title": "Read it with your own tools",
    "steps.unzip": "1. Unzip the archive: it contains a Git repository.",
    "steps.clone": "2. Clone it: git clone <unzipped-folder> suture-history",
    "steps.log": "3. Read the changes: git log -p -- cells/",
    "working": "Building the archive…",
    "done": "Archive ready. Your download should have started.",
    "error": "The export failed. Nothing was changed in the tracked workbook.",
    "unavailable":
      "The export is available once a tracked workbook is open.",
  },
  fr: {
    "title": "Export pour les développeurs",
    "intro":
      "Ceci produit une archive ZIP contenant un dépôt Git clonable du classeur suivi : les versions, les scénarios et les jalons, avec une vue lisible d'une ligne par cellule sous cells/.",
    "onlyPlace":
      "Ce panneau est le seul endroit de Suture qui nomme le format sous-jacent. Partout ailleurs, l'interface parle le langage du bureau.",
    "action": "Produire l'archive",
    "steps.title": "Le lire avec vos outils",
    "steps.unzip": "1. Décompressez l'archive : elle contient un dépôt Git.",
    "steps.clone": "2. Clonez-le : git clone <dossier-décompressé> suture-history",
    "steps.log": "3. Lisez les changements : git log -p -- cells/",
    "working": "Construction de l'archive…",
    "done": "Archive prête. Le téléchargement devrait avoir démarré.",
    "error": "L'export a échoué. Rien n'a été modifié dans le classeur suivi.",
    "unavailable":
      "L'export est disponible dès qu'un classeur suivi est ouvert.",
  },
};

export const translateExport = makeTranslator(exportMessages);
