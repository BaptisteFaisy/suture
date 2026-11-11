/**
 * The combine plan (B.8). The carrier file is never rebuilt: the plan lists
 * the cell edits to apply to it, the disagreements the user must decide, the
 * sheets refused by the safe fallback, and a report that accounts for every
 * change of both sides (no silent loss).
 */
import type {
  CanonicalSheet,
  CanonicalWorkbook,
  CellChange,
  CellPatch,
  CellRecord,
  ChangeSet,
  Disagreement,
  ReportEntry,
  SheetDiff,
  Side,
} from "@suture/contracts";
import { buildCoordinateMap, identityMap, type CoordinateMap } from "./coordinates";
import { structuralCase, type SheetStructure } from "./carrier";
import { disagreementId } from "./cells";

/** Cells of a sheet indexed by reference. */
export type CellIndex = Map<string, CellRecord>;

export function indexOf(sheet: CanonicalSheet | undefined): CellIndex {
  const index: CellIndex = new Map();
  if (sheet === undefined) return index;
  for (const cell of sheet.cells) index.set(cell.ref, cell);
  return index;
}

function sheetOf(workbook: CanonicalWorkbook, sheetId: number): CanonicalSheet | undefined {
  return workbook.sheets.find((sheet) => sheet.meta.sheetId === sheetId);
}

/** True when two cells hold the same typed input. */
export function sameInput(a: CellRecord | null, b: CellRecord | null): boolean {
  if (a === null || b === null) return a === b;
  return a.input === b.input && a.kind === b.kind;
}

/** Everything one sheet contributes to the plan. */
interface SheetPlan {
  patches: CellPatch[];
  disagreements: Disagreement[];
  report: ReportEntry[];
  fallback?: { sheetId: number; discarded: ChangeSet["summary"] };
}

/** Combines one sheet, given the carrier and the other side. */
export function combineSheet(options: {
  sheetId: number;
  sheetName: string;
  origin: CanonicalWorkbook;
  carrier: CanonicalWorkbook;
  other: CanonicalWorkbook;
  carrierSide: Side;
  otherChanges: SheetDiff | undefined;
  structure: SheetStructure;
}): SheetPlan {
  const { sheetId, sheetName, origin, carrier, other, carrierSide, otherChanges, structure } = options;
  const patches: CellPatch[] = [];
  const disagreements: Disagreement[] = [];
  const report: ReportEntry[] = [];

  if (structuralCase(structure) === 4) {
    return fallbackPlan(sheetId, sheetName, carrierSide, otherChanges);
  }

  const originSheet = sheetOf(origin, sheetId);
  const carrierSheet = sheetOf(carrier, sheetId);
  if (carrierSheet === undefined) {
    // The sheet exists only on the other side: it cannot be added without
    // rebuilding the file, so it is listed in the report instead.
    return {
      patches,
      disagreements,
      report: [
        {
          category: "not-carried",
          side: otherSide(carrierSide),
          sheetName,
          label: "Sheet present on this side only: kept out of the combined file",
        },
      ],
    };
  }
  const originCells = indexOf(originSheet);
  const carrierCells = indexOf(carrierSheet);
  const map = coordinateMapFor(originSheet, sheetOf(other, sheetId), carrierSheet, structure);

  for (const change of otherChanges?.cells ?? []) {
    const outcome = decideCell(sheetId, sheetName, change, originCells, carrierCells, map, carrierSide);
    if (outcome.patch !== undefined) patches.push(outcome.patch);
    if (outcome.disagreement !== undefined) disagreements.push(outcome.disagreement);
    if (outcome.report !== undefined) report.push(outcome.report);
  }

  reportStructure(report, sheetName, otherChanges, carrierSide);
  return { patches, disagreements, report };
}

/** The decision taken for one cell of the other side. */
function decideCell(
  sheetId: number,
  sheetName: string,
  change: CellChange,
  originCells: CellIndex,
  carrierCells: CellIndex,
  map: CoordinateMap,
  carrierSide: Side,
): { patch?: CellPatch; disagreement?: Disagreement; report?: ReportEntry } {
  const side = otherSide(carrierSide);
  // A recalculated result is not something a person typed: the combined file
  // asks the spreadsheet to recalculate on opening, so the cached value is
  // never carried. It is reported, never turned into a disagreement.
  if (change.kind === "consequence") {
    return {
      report: {
        category: "not-carried",
        side,
        sheetName,
        ref: change.ref,
        label: "Recalculated result — the spreadsheet recalculates it when the file opens",
      },
    };
  }
  if (change.kind === "format") {
    return {
      report: { category: "not-carried", side, sheetName, ref: change.ref, label: "Format change" },
    };
  }
  // A recalculated result is not something a person typed: the combined file
  // drops the calculation chain and asks the spreadsheet to recalculate on
  // opening, so the cached value is never carried — but it is reported.
  if (change.kind === "consequence") {
    return {
      report: {
        category: "not-carried",
        side,
        sheetName,
        ref: change.ref,
        label: "Recalculated result — the spreadsheet recalculates it when the file is opened",
      },
    };
  }
  const target = map.mapRef(change.ref);
  if (target === null) {
    return {
      report: {
        category: "not-carried",
        side,
        sheetName,
        ref: change.ref,
        label: `${describeChange(change)} — the row or column no longer exists on the kept side`,
      },
    };
  }
  const base = originCells.get(change.ref) ?? null;
  const kept = carrierCells.get(target) ?? null;
  const incoming = carriedRecord(change, target);
  if (sameInput(kept, incoming)) {
    return {
      report: { category: "applied", side: "both", sheetName, ref: target, label: describeChange(change) },
    };
  }
  if (sameInput(kept, base)) {
    return {
      patch: { sheetId, ref: target, record: incoming, source: side },
      report: { category: "applied", side, sheetName, ref: target, label: describeChange(change) },
    };
  }
  return {
    disagreement: disagreement(sheetId, target, base, kept, incoming, carrierSide),
  };
}

function coordinateMapFor(
  originSheet: CanonicalSheet | undefined,
  otherSheet: CanonicalSheet | undefined,
  carrierSheet: CanonicalSheet | undefined,
  structure: SheetStructure,
): CoordinateMap {
  if (originSheet === undefined || otherSheet === undefined || carrierSheet === undefined) {
    return identityMap();
  }
  // The same sheet on both sides: its coordinates are already the carrier's.
  if (otherSheet === carrierSheet) return identityMap();
  if (!structure.structuralA && !structure.structuralB) return identityMap();
  return buildCoordinateMap(originSheet, otherSheet, carrierSheet);
}

/**
 * The record to write, moved to its target address.
 *
 * Formulas stay in R1C1: that notation is position independent, which is
 * exactly what a carried formula needs — the patcher converts it to A1 at the
 * target cell when it writes the sheet.
 */
function carriedRecord(change: CellChange, target: string): CellRecord | null {
  const after = change.after;
  if (after === null) return null;
  return { ...after, ref: target };
}

function disagreement(
  sheetId: number,
  ref: string,
  base: CellRecord | null,
  kept: CellRecord | null,
  incoming: CellRecord | null,
  carrierSide: Side,
): Disagreement {
  const a = carrierSide === "A" ? kept : incoming;
  const b = carrierSide === "A" ? incoming : kept;
  return { id: disagreementId(sheetId, ref), sheetId, ref, base, a, b };
}

export function describeChange(change: CellChange): string {
  const before = change.before === null ? "(empty)" : change.before.input;
  const after = change.after === null ? "(empty)" : change.after.input;
  return change.kind === "consequence"
    ? `Recalculated result ${before} → ${after}`
    : `${before} → ${after}`;
}

/** Rows and columns the other side inserted or deleted, listed in the report. */
function reportStructure(
  report: ReportEntry[],
  sheetName: string,
  otherChanges: SheetDiff | undefined,
  carrierSide: Side,
): void {
  const side = otherSide(carrierSide);
  for (const row of otherChanges?.rowsChanged ?? []) {
    report.push({
      category: "not-carried",
      side,
      sheetName,
      label: `Row ${row.type} (${row.cells.length} cell(s)) — apply it by hand if needed`,
    });
  }
  for (const col of otherChanges?.colsChanged ?? []) {
    report.push({
      category: "not-carried",
      side,
      sheetName,
      label: `Column ${col.type} — apply it by hand if needed`,
    });
  }
}

function summaryOf(diff: SheetDiff | undefined) {
  return {
    inputsModified: diff?.cells.filter((change) => change.kind === "input").length ?? 0,
    consequences: diff?.cells.filter((change) => change.kind === "consequence").length ?? 0,
    formats: diff?.cells.filter((change) => change.kind === "format").length ?? 0,
    rowsInserted: diff?.rowsChanged.filter((row) => row.type === "inserted").length ?? 0,
    rowsDeleted: diff?.rowsChanged.filter((row) => row.type === "deleted").length ?? 0,
    colsInserted: diff?.colsChanged.filter((col) => col.type === "inserted").length ?? 0,
    colsDeleted: diff?.colsChanged.filter((col) => col.type === "deleted").length ?? 0,
    sheetsAdded: 0,
    sheetsRemoved: 0,
    sheetsRenamed: 0,
    partsChanged: 0,
  };
}

export function otherSide(side: Side): Side {
  return side === "A" ? "B" : "A";
}

/** Case 4 of B.8: both sides changed the structure differently. */
function fallbackPlan(
  sheetId: number,
  sheetName: string,
  carrierSide: Side,
  otherChanges: SheetDiff | undefined,
): SheetPlan {
  return {
    patches: [],
    disagreements: [],
    report: [
      {
        category: "not-carried",
        side: otherSide(carrierSide),
        sheetName,
        label:
          "Structure changed on both sides: the chosen side is kept, the other side's changes are listed here",
      },
    ],
    fallback: { sheetId, discarded: summaryOf(otherChanges) },
  };
}
