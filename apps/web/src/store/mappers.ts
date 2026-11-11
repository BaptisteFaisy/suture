/**
 * Mappers from the engines' typed results to the view models of the store
 * contract. Pure functions, no engine import: they only read the contracts,
 * which keeps them testable without any workbook.
 */
import type {
  CellRecord,
  ChangeSet,
  DisagreementChoice,
  MergePlan,
  ReportEntry,
  Side,
  VersionMeta,
} from "@suture/contracts";
import type {
  ComparisonFilter,
  ComparisonRow,
  ComparisonView,
  CombineView,
  VersionSummary,
} from "./index";

/** Human-readable text of a cell: what the person sees in the grid. */
export function cellText(record: CellRecord | null): string {
  if (record === null) return "";
  if (record.kind === "b") return record.input === "1" ? "TRUE" : "FALSE";
  return record.input;
}

/** Names of the sheets, by identifier, for readable labels. */
export type SheetNames = Map<number, string>;

function passes(row: ComparisonRow, filter: ComparisonFilter): boolean {
  if (filter.sheetId !== "all" && row.sheetId !== filter.sheetId) return false;
  if (filter.nature !== "all" && row.nature !== filter.nature) return false;
  return true;
}

/** Cell differences of one sheet, as grid rows. */
function cellRows(changeSet: ChangeSet): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  for (const sheet of changeSet.sheets) {
    for (const change of sheet.cells) {
      rows.push({
        sheetId: sheet.sheetId,
        ref: change.ref,
        nature: change.kind,
        before: cellText(change.before),
        after: cellText(change.after),
      });
    }
  }
  return rows;
}

/**
 * Added and deleted rows, as grid rows: an added row shows an empty "before",
 * a deleted row an empty "after". The grid already draws the symbol from that.
 */
function structureRows(changeSet: ChangeSet): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  for (const sheet of changeSet.sheets) {
    for (const change of sheet.rowsChanged) {
      const added = change.type === "inserted";
      for (const cell of change.cells) {
        rows.push({
          sheetId: sheet.sheetId,
          ref: cell.ref,
          nature: "input",
          before: added ? "" : cellText(cell),
          after: added ? cellText(cell) : "",
        });
      }
    }
  }
  return rows;
}

/** Builds the comparison view model from a typed change set. */
export function toComparisonView(
  changeSet: ChangeSet,
  filter: ComparisonFilter,
): ComparisonView {
  const all = [...cellRows(changeSet), ...structureRows(changeSet)];
  const summary = changeSet.summary;
  return {
    rows: all.filter((row) => passes(row, filter)),
    summary: {
      inputsModified: summary.inputsModified,
      consequences: summary.consequences,
      formats: summary.formats,
      rowsInserted: summary.rowsInserted,
      rowsDeleted: summary.rowsDeleted,
      partsChanged: summary.partsChanged,
    },
    otherParts: changeSet.partChanges.map((part) => part.label),
    filter,
  };
}

/** Version list of the store, as the history screen needs it. */
export function toVersionSummaries(versions: VersionMeta[]): VersionSummary[] {
  return versions.map((version) => ({
    id: version.id,
    note: version.note,
    author: version.author,
    timestamp: version.timestamp,
    scenario: version.scenario,
    milestone: version.milestone,
    parents: version.parents.length,
  }));
}

/** One automatic patch, labelled for the first step of the assistant. */
function automaticOf(plan: MergePlan, names: SheetNames) {
  return plan.patches.map((patch) => ({
    sheetName: names.get(patch.sheetId) ?? String(patch.sheetId),
    ref: patch.ref,
    value: cellText(patch.record),
    source: patch.source,
  }));
}

/** One disagreement, labelled for the second step of the assistant. */
function disagreementsOf(plan: MergePlan, names: SheetNames) {
  return plan.disagreements.map((item) => ({
    id: item.id,
    sheetName: names.get(item.sheetId) ?? String(item.sheetId),
    ref: item.ref,
    base: cellText(item.base),
    a: cellText(item.a),
    b: cellText(item.b),
  }));
}

/** Builds the combine view model from a plan and the user's choices. */
export function toCombineView(
  plan: MergePlan,
  names: SheetNames,
  choices: Record<string, DisagreementChoice>,
  report: ReportEntry[],
): CombineView {
  const answered = plan.disagreements.every((item) => choices[item.id] !== undefined);
  const fallbacksChosen = plan.fallbacks.every((item) => item.keptSide !== undefined);
  return {
    automatic: automaticOf(plan, names),
    disagreements: disagreementsOf(plan, names),
    fallbacks: plan.fallbacks.map((item) => ({
      sheetName: names.get(item.sheetId) ?? String(item.sheetId),
      keptSide: item.keptSide,
    })),
    choices,
    report: report.length > 0 ? report : plan.report,
    ready: answered && fallbacksChosen,
  };
}

/** Which side a report entry came from, as a readable marker. */
export function sideOf(entry: ReportEntry): Side | "both" {
  return entry.side;
}
