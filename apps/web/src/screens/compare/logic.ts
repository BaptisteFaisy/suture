import { formatValue } from "@suture/ui";
import type { Lang } from "../../i18n/lang";
import type { ComparisonFilter, ComparisonRow, ComparisonView } from "../../store";

/** A translate function bound to the screen dictionary. */
export type Translate = (key: string) => string;

/** The three natures of a difference (B.7). */
export type DifferenceNature = "input" | "consequence" | "format";

/** Symbol shown in the gutter, in addition to the colour (SUT-N-07). */
export type DifferenceSymbol = "+" | "−" | "~" | "≡";

/** The deterministic summary of a comparison (SUT-F-13). */
export interface ComparisonSummaryText {
  /** One sentence, read as a whole by a screen reader. */
  headline: string;
  /** Detail lines (recalculated results with their amounts). */
  details: string[];
  /** Plain-text version, copyable as-is. */
  plain: string;
}

/**
 * A row of the grid, possibly carrying the label of the cell ("Total").
 * When the engine provides one, the summary reads "Total (B14): …".
 */
export type LabelledRow = ComparisonRow & { readonly label?: string };

/** Counts of a comparison, read from the store contract (never recomputed). */
export interface SummaryCounts {
  inputsModified: number;
  rowsAdded: number;
  rowsRemoved: number;
  colsAdded: number;
  colsRemoved: number;
  consequences: number;
  formats: number;
  partsChanged: number;
}

const NATURE_ORDER: DifferenceNature[] = ["input", "consequence", "format"];

/** Order of the summary parts, fixed so that the text is deterministic. */
const SUMMARY_PARTS: { key: string; count: keyof SummaryCounts }[] = [
  { key: "summary.inputs", count: "inputsModified" },
  { key: "summary.rowsAdded", count: "rowsAdded" },
  { key: "summary.rowsRemoved", count: "rowsRemoved" },
  { key: "summary.colsAdded", count: "colsAdded" },
  { key: "summary.colsRemoved", count: "colsRemoved" },
  { key: "summary.consequences", count: "consequences" },
  { key: "summary.formats", count: "formats" },
  { key: "summary.parts", count: "partsChanged" },
];

/** Nature of a row, narrowed to the three natures of the comparison. */
export function natureOf(row: ComparisonRow): DifferenceNature {
  return NATURE_ORDER.includes(row.nature) ? row.nature : "input";
}

/** Symbol of a row: the information never relies on the colour alone. */
export function symbolFor(row: ComparisonRow): DifferenceSymbol {
  if (row.after.trim().length === 0) return "−";
  if (row.nature === "consequence") return "~";
  if (row.nature === "format") return "≡";
  return "+";
}

/** Accessible label of a symbol, in the language of the interface. */
export function symbolLabel(row: ComparisonRow, t: Translate): string {
  if (symbolFor(row) === "−") return t("symbol.removed");
  return t(`symbol.${natureOf(row)}`);
}

/** Keeps the rows matching the sheet and nature filters. */
export function applyComparisonFilter(
  rows: readonly ComparisonRow[],
  filter: ComparisonFilter,
): ComparisonRow[] {
  return rows.filter((row) => {
    if (filter.sheetId !== "all" && row.sheetId !== filter.sheetId) return false;
    if (filter.nature !== "all" && row.nature !== filter.nature) return false;
    return true;
  });
}

/** Distinct sheet identifiers present in the rows, in ascending order. */
export function sheetIdsOf(rows: readonly ComparisonRow[]): number[] {
  return [...new Set(rows.map((row) => row.sheetId))].sort((a, b) => a - b);
}

/** True when the comparison holds no difference at all. */
export function isIdentical(view: ComparisonView): boolean {
  const summary = view.summary;
  const counts =
    summary.inputsModified +
    summary.consequences +
    summary.formats +
    summary.rowsInserted +
    summary.rowsDeleted +
    summary.colsInserted +
    summary.colsDeleted +
    summary.partsChanged;
  return view.rows.length === 0 && counts === 0;
}

/** Optional label of a cell, when the engine names it (e.g. "Total"). */
function labelOf(row: ComparisonRow): string | null {
  const candidate = (row as LabelledRow).label;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

/** Detail of one recalculated result: "Total (B14): 120 000 → 131 500". */
export function detailOf(row: ComparisonRow, lang: Lang): string {
  const label = labelOf(row);
  const address = label === null ? row.ref : `${label} (${row.ref})`;
  const separator = lang === "fr" ? " : " : ": ";
  return `${address}${separator}${formatValue(row.before, lang)} → ${formatValue(row.after, lang)}`;
}

/**
 * Announces a difference to a screen reader: sheet, address, nature and the
 * two values (SUT-N-07).
 */
export function announcementOf(
  row: ComparisonRow | undefined,
  t: Translate,
  lang: Lang,
): string {
  if (row === undefined) return "";
  return t("grid.announce")
    .replace("{sheet}", String(row.sheetId))
    .replace("{cell}", row.ref)
    .replace("{nature}", t(`nature.${natureOf(row)}`))
    .replace("{before}", formatValue(row.before, lang))
    .replace("{after}", formatValue(row.after, lang));
}

/** Counts of the comparison, read from the contract summary. */
export function summaryCounts(view: ComparisonView): SummaryCounts {
  return {
    inputsModified: view.summary.inputsModified,
    rowsAdded: view.summary.rowsInserted,
    rowsRemoved: view.summary.rowsDeleted,
    colsAdded: view.summary.colsInserted,
    colsRemoved: view.summary.colsDeleted,
    consequences: view.summary.consequences,
    formats: view.summary.formats,
    partsChanged: view.summary.partsChanged,
  };
}

/** Picks the singular or plural form of a counted message. */
export function counted(t: Translate, lang: Lang, key: string, count: number): string {
  const rule = new Intl.PluralRules(lang).select(count);
  const suffix = rule === "one" ? ".one" : ".other";
  return t(key + suffix).replace("{count}", String(count));
}

/**
 * Builds the deterministic summary of a comparison: the counts come from the
 * contract, the detail lines from the recalculated results.
 */
export function buildSummary(
  view: ComparisonView,
  filteredRows: readonly ComparisonRow[],
  lang: Lang,
  t: Translate,
): ComparisonSummaryText {
  const counts = summaryCounts(view);
  const parts: string[] = [];
  for (const part of SUMMARY_PARTS) {
    const value = counts[part.count];
    if (value > 0) parts.push(counted(t, lang, part.key, value));
  }
  const headline = parts.join(", ");
  const details = filteredRows
    .filter((row) => row.nature === "consequence")
    .map((row) => detailOf(row, lang));
  const plain = [headline, ...details].filter((line) => line.length > 0).join("\n");
  return { headline, details, plain };
}
