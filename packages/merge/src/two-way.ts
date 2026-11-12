/**
 * Two-way combine (SUT-F-24): no common origin is known, so none is invented.
 * The two files are compared side by side and EVERY cell difference becomes a
 * disagreement the user settles by hand — nothing is applied automatically.
 *
 * What cannot become a decision (a sheet only one side has, a row or a column
 * only one side has, a defined name that differs) goes to the report, so that
 * nothing disappears silently (`no-silent-loss.md`).
 *
 * Side A is the carrier: it is the file that gets patched, and it is the side
 * the user starts from. With no origin there is nothing to arbitrate between
 * the two sides, so the first one carries and the second one is compared to
 * it. The diff is therefore computed from B to A: the addresses it reports are
 * already the carrier's, which is where the decisions are written.
 */
import type {
  CanonicalSheet,
  CanonicalWorkbook,
  CellChange,
  CellRecord,
  DefinedName,
  Disagreement,
  MergePlan,
  ReportEntry,
  SheetChange,
  SheetDiff,
  Side,
} from "@suture/contracts";
import { diffSheet, matchSheets } from "@suture/diff";
import { cellText, disagreementId } from "./cells";
import { buildCoordinateMap, type CoordinateMap } from "./coordinates";
import { nameOf } from "./plan";
import { indexOf } from "./sheet-plan";

/** A difference that could not become its own decision. */
interface Leftover {
  change: CellChange;
  /** Carrier address it would have used, when it has one. */
  target: string | null;
}

/** A decision, with the carrier address it writes to. */
interface Decision {
  ref: string;
  decision: Disagreement;
}

/** Plans a two-way combine: every difference is a manual decision. */
export function planTwoWay(a: CanonicalWorkbook, b: CanonicalWorkbook): MergePlan {
  const plan: MergePlan = {
    carrier: "A",
    patches: [],
    disagreements: [],
    fallbacks: [],
    report: [],
  };
  // Compared from B to A: `oldSheet` is B's, `newSheet` is the carrier's.
  const { pairs, changes } = matchSheets(b, a);
  for (const pair of pairs) planSheet(plan, pair.oldSheet, pair.newSheet);
  reportSheetChanges(plan, a, b, changes);
  reportDefinedNames(plan, a.meta.definedNames, b.meta.definedNames);
  return plan;
}

/** Compares one sheet pair and turns every cell difference into a decision. */
function planSheet(plan: MergePlan, bSheet: CanonicalSheet, aSheet: CanonicalSheet): void {
  const diff = diffSheet(aSheet.meta.sheetId, bSheet, aSheet);
  // B → A: the same alignment the diff just used, so the addresses agree.
  const map = buildCoordinateMap(aSheet, bSheet, aSheet);
  const { decided, leftovers } = splitCells(diff, map, aSheet);

  for (const item of decided) plan.disagreements.push(item.decision);
  for (const item of leftovers) plan.report.push(leftoverEntry(aSheet.meta.name, item, decided));
  reportLines(plan.report, diff, aSheet.meta.name);
}

/** One decision per address of the carrier; the rest is named in the report. */
function splitCells(
  diff: SheetDiff,
  map: CoordinateMap,
  aSheet: CanonicalSheet,
): { decided: Decision[]; leftovers: Leftover[] } {
  const aCells = indexOf(aSheet);
  const decided: Decision[] = [];
  const taken = new Set<string>();
  const leftovers: Leftover[] = [];

  for (const change of diff.cells) {
    const target = carrierRef(change, map);
    if (target === null || taken.has(target)) {
      leftovers.push({ change, target });
      continue;
    }
    taken.add(target);
    decided.push({
      ref: target,
      decision: twoWayDisagreement(
        aSheet.meta.sheetId,
        target,
        aCells.get(target) ?? null,
        change.before,
      ),
    });
  }
  return { decided, leftovers };
}

/** One difference, decided by hand: there is no origin, so `base` is null. */
function twoWayDisagreement(
  sheetId: number,
  ref: string,
  a: CellRecord | null,
  b: CellRecord | null,
): Disagreement {
  return {
    id: disagreementId(sheetId, ref),
    sheetId,
    ref,
    base: null,
    a,
    b: b === null ? null : { ...b, ref },
  };
}

/**
 * The address of the difference in the carrier. A cell the carrier holds keeps
 * its own address; a cell only the other side holds is moved onto the carrier's
 * grid, and has no address when the carrier has neither its row nor its column.
 */
function carrierRef(change: CellChange, map: CoordinateMap): string | null {
  return change.after === null ? map.mapRef(change.ref) : change.ref;
}

/** A difference that is reported instead of decided: still named, never lost. */
function leftoverEntry(
  sheetName: string,
  leftover: Leftover,
  decided: Decision[],
): ReportEntry {
  const { change, target } = leftover;
  const decidedHere = decided.some((item) => item.ref === change.ref);
  const entry: ReportEntry = {
    category: "not-carried",
    side: "B",
    sheetName,
    label: leftoverLabel(change, target),
  };
  // The address stays in the report when it is not already somebody's decision.
  if (!decidedHere) entry.ref = change.ref;
  else entry.detail = `already decided at « ${target ?? change.ref} »`;
  return entry;
}

/** Why a difference could not become a decision of its own. */
function leftoverLabel(change: CellChange, target: string | null): string {
  const value = `« ${cellText(change.before)} »`;
  if (target === null) {
    return `Cell ${value} only on this side: the carrier has neither its row nor its column`;
  }
  return `Cell ${value} only on this side: its address is already decided in this sheet`;
}

/** Rows and columns only one side has: reported, never applied silently. */
function reportLines(report: ReportEntry[], diff: SheetDiff, sheetName: string): void {
  for (const row of diff.rowsChanged) {
    const side: Side = row.type === "inserted" ? "A" : "B";
    report.push({
      ...lineEntry(side, sheetName),
      label: `Row ${row.rowIndex + 1} only on this side (${row.cells.length} cell(s))`,
    });
  }
  for (const col of diff.colsChanged) {
    const side: Side = col.type === "inserted" ? "A" : "B";
    report.push({
      ...lineEntry(side, sheetName),
      label: `Column ${col.colIndex + 1} only on this side`,
    });
  }
}

/** A row or column the carrier keeps (side A) or does not carry (side B). */
function lineEntry(side: Side, sheetName: string): Omit<ReportEntry, "label"> {
  return {
    category: side === "A" ? "applied" : "not-carried",
    side,
    sheetName,
    detail:
      side === "A"
        ? "kept as it is in the carried file"
        : "kept out of the combined file — apply it by hand",
  };
}

/** Sheets and sheet metadata that differ: the carrier's shape is the one kept. */
function reportSheetChanges(
  plan: MergePlan,
  a: CanonicalWorkbook,
  b: CanonicalWorkbook,
  changes: SheetChange[],
): void {
  for (const change of changes) {
    plan.report.push(sheetEntry(change, nameOf(a, b, a, change.sheetId)));
  }
}

/** A sheet only one side has, renamed, or shown differently. */
function sheetEntry(change: SheetChange, sheetName: string): ReportEntry {
  if (change.type === "removed") {
    return {
      category: "not-carried",
      side: "B",
      sheetName: change.before ?? sheetName,
      label: "Sheet only on this side: kept out of the combined file — add it by hand",
    };
  }
  if (change.type === "added") {
    return {
      category: "applied",
      side: "A",
      sheetName: change.after ?? sheetName,
      label: "Sheet only on this side: kept as it is in the combined file",
    };
  }
  return {
    category: "not-carried",
    side: "both",
    sheetName,
    label: sheetMetaLabel(change, sheetName),
  };
}

/** The sheet metadata the combined file cannot take from the other side. */
function sheetMetaLabel(change: SheetChange, sheetName: string): string {
  return change.type === "renamed"
    ? `Name differs: the combined file keeps « ${change.after ?? sheetName} »`
    : "Visibility differs: the combined file keeps the carried file's visibility";
}

/** Defined names are workbook-level parts: they are reported, never carried. */
function reportDefinedNames(
  plan: MergePlan,
  namesOfA: DefinedName[],
  namesOfB: DefinedName[],
): void {
  const kept = new Map(namesOfA.map((item) => [item.name, item]));
  const other = new Map(namesOfB.map((item) => [item.name, item]));
  for (const [name, item] of other) {
    const mine = kept.get(name);
    if (mine !== undefined && mine.formula === item.formula && mine.sheetId === item.sheetId) {
      continue;
    }
    plan.report.push(definedNameEntry("not-carried", "B", `« ${name} » differs: not carried over`));
  }
  for (const name of kept.keys()) {
    if (other.has(name)) continue;
    plan.report.push(
      definedNameEntry("applied", "A", `« ${name} » only on this side: kept as it is`),
    );
  }
}

function definedNameEntry(
  category: ReportEntry["category"],
  side: Side,
  label: string,
): ReportEntry {
  return { category, side, sheetName: "(workbook)", label: `Defined name ${label}` };
}
