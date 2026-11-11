import { makeTranslator, type Lang } from "../../i18n/lang";

/** Messages of this screen only — each screen owns its dictionary. */
export const screenMessages: Record<Lang, Record<string, string>> = {
  en: {
    "title": "Cell history",
    "subtitle": "Who changed this cell, when, and what it was before.",
    "placeholder": "Choose a cell in the comparison grid to see its history.",
    "empty": "This cell has never been changed since the first version.",
    "loading": "Reading the history of this cell…",
    "error": "The history of this cell could not be read: {reason}",
    "cell": "Cell",
    "sheet": "Sheet",
    "author": "Author",
    "date": "Date",
    "note": "Version note",
    "before": "Before",
    "after": "After",
    "version": "Version",
    "entry": "{count} changes of this cell",
    "unchanged": "no value",
    "aria.list": "History of the cell",
    "aria.entry": "Change of {ref} on {date} by {author}",
    "close": "Close the history",
  },
  fr: {
    "title": "Histoire de la cellule",
    "subtitle": "Qui a changé cette cellule, quand, et ce qu'elle valait avant.",
    "placeholder": "Choisissez une cellule dans la grille de comparaison pour voir son histoire.",
    "empty": "Cette cellule n'a jamais été modifiée depuis la première version.",
    "loading": "Lecture de l'histoire de cette cellule…",
    "error": "L'histoire de cette cellule n'a pas pu être lue : {reason}",
    "cell": "Cellule",
    "sheet": "Feuille",
    "author": "Auteur",
    "date": "Date",
    "note": "Note de version",
    "before": "Avant",
    "after": "Après",
    "version": "Version",
    "entry": "{count} modifications de cette cellule",
    "unchanged": "aucune valeur",
    "aria.list": "Histoire de la cellule",
    "aria.entry": "Modification de {ref} le {date} par {author}",
    "close": "Fermer l'histoire",
  },
};

export const translateScreen = makeTranslator(screenMessages);
