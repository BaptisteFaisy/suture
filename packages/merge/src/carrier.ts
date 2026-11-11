import type { CanonicalSheet, ChangeSet, SheetDiff, Side } from "@suture/contracts";

/** The structural situation of one sheet, per the four cases of B.8. */
export type StructuralCase = 1 | 2 | 3 | 4;

/** Structural state of the two sides for one sheet. */
export interface SheetStructure {
  sheetId: number;
  structuralA: boolean;
  structuralB: boolean;
  /** Case 3 only: both sides made the same structural changes. */
  sameStructure: boolean;
}

function diffOf(changeSet: ChangeSet, sheetId: number): SheetDiff | undefined {
  return changeSet.sheets.find((sheet) => sheet.sheetId === sheetId);
}

/**
 * Two structural change sets are "the same" when they insert and delete the
 * same rows and the same columns. Compared on the origin-side indices, which
 * is what makes the check independent of the resulting positions.
 */
export function sameStructuralChanges(a: SheetDiff | undefined, b: SheetDiff | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const key = (diff: SheetDiff) =>
    [
      ...diff.rowsChanged.map((change) => `r${change.type}${change.rowIndex}`),
      ...diff.colsChanged.map((change) => `c${change.type}${change.colIndex}`),
    ]
      .sort()
      .join(",");
  return key(a) === key(b);
}

/** Describes the structural situation of every sheet present in either side. */
export function structures(deltaA: ChangeSet, deltaB: ChangeSet): SheetStructure[] {
  const ids = new Set<number>([
    ...deltaA.sheets.map((sheet) => sheet.sheetId),
    ...deltaB.sheets.map((sheet) => sheet.sheetId),
  ]);
  const result: SheetStructure[] = [];
  for (const sheetId of [...ids].sort((x, y) => x - y)) {
    const a = diffOf(deltaA, sheetId);
    const b = diffOf(deltaB, sheetId);
    const structuralA = a?.structural ?? false;
    const structuralB = b?.structural ?? false;
    result.push({
      sheetId,
      structuralA,
      structuralB,
      sameStructure: sameStructuralChanges(a, b),
    });
  }
  return result;
}

/** The case of B.8 that applies to one sheet. */
export function structuralCase(structure: SheetStructure): StructuralCase {
  if (!structure.structuralA && !structure.structuralB) return 1;
  if (structure.structuralA && structure.structuralB) {
    return structure.sameStructure ? 3 : 4;
  }
  return 2;
}

/**
 * Chooses the carrier file (B.8: "the file is never rebuilt, one side is
 * patched"). The side that carries the structural changes wins, because its
 * file already has the right shape; otherwise side A carries.
 */
export function chooseCarrier(structures_: SheetStructure[]): Side {
  let aStructural = 0;
  let bStructural = 0;
  for (const structure of structures_) {
    if (structure.structuralA) aStructural += 1;
    if (structure.structuralB) bStructural += 1;
  }
  return bStructural > aStructural ? "B" : "A";
}

/** The sheet of one workbook, by identifier. */
export function sheetById(
  sheets: readonly CanonicalSheet[],
  sheetId: number,
): CanonicalSheet | undefined {
  return sheets.find((sheet) => sheet.meta.sheetId === sheetId);
}
