import type { StoreAdapter } from "../../store";

/**
 * Pure logic of the cell history screen.
 * Types are derived from the store contract, never from an engine package.
 */

/** One step of the history of a cell. */
export type HistoryEntry = NonNullable<StoreAdapter["cellHistory"]>[number];

/** Content of a cell at a given version. */
export type HistoryCell = NonNullable<HistoryEntry["before"]>;

/** What the user sees for one version of a cell. */
export interface HistoryRow {
  versionId: string;
  author: string;
  /** Date already formatted for the interface language. */
  date: string;
  note: string;
  before: string;
  after: string;
}

/** Formats a date for the active interface language, in UTC. */
export function formatDate(timestamp: number, lang: "en" | "fr"): string {
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

/** Text of a cell value, or the "no value" wording when empty. */
export function formatValue(
  cell: HistoryCell | null | undefined,
  emptyLabel: string,
): string {
  if (cell === null || cell === undefined) return emptyLabel;
  const input = cell.input.trim();
  if (input === "") return emptyLabel;
  return input;
}

/** Builds the rows shown to the user, newest version first. */
export function buildHistoryRows(
  entries: readonly HistoryEntry[],
  lang: "en" | "fr",
  emptyLabel: string,
): HistoryRow[] {
  return [...entries]
    .sort((left, right) => right.timestamp - left.timestamp)
    .map((entry) => ({
      versionId: entry.versionId,
      author: entry.author,
      date: formatDate(entry.timestamp, lang),
      note: entry.note,
      before: formatValue(entry.before, emptyLabel),
      after: formatValue(entry.after, emptyLabel),
    }));
}

/** True when the cell has no recorded change. */
export function isEmptyHistory(entries: readonly HistoryEntry[] | null): boolean {
  return entries === null || entries.length === 0;
}

/** Number of changes of the cell. */
export function historyCount(entries: readonly HistoryEntry[] | null): number {
  return entries === null ? 0 : entries.length;
}
