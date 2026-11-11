import type { CellPatch, CellRecord, Disagreement, DisagreementChoice } from "@suture/contracts";

/** Stabilises an identifier for a cell disagreement. */
export function disagreementId(sheetId: number, ref: string): string {
  return `${sheetId}:${ref}`;
}

/** Formats a cell value for human reading. */
export function cellText(cell: CellRecord | null): string {
  return cell === null ? "" : cell.input;
}

/** Applies cell-by-cell three-way rules on aligned inputs. */
export function resolveCell(
  sheetId: number,
  ref: string,
  base: CellRecord | null,
  a: CellRecord | null,
  b: CellRecord | null,
): { patch?: CellPatch; disagreement?: Disagreement; appliedSame?: boolean } {
  const sameInput = (x: CellRecord | null, y: CellRecord | null) =>
    (x === null && y === null) || (x !== null && y !== null && x.input === y.input && x.kind === y.kind);

  // Neither side changed this cell.
  if (sameInput(a, base) && sameInput(b, base)) return {};

  // Side A changed it, B did not: already in carrier A.
  if (!sameInput(a, base) && sameInput(b, base)) {
    return { appliedSame: true };
  }

  // Side B changed it, A did not: patch carrier A with B's change.
  if (sameInput(a, base) && !sameInput(b, base)) {
    return { patch: { sheetId, ref, record: b, source: "B" } };
  }

  // Both sides changed it to the exact same input: take it, nothing to patch.
  if (sameInput(a, b)) return { appliedSame: true };

  // Disagreement: both changed it differently. User must decide.
  return {
    disagreement: {
      id: disagreementId(sheetId, ref),
      sheetId,
      ref,
      base,
      a,
      b,
    },
  };
}

/** Turns a user's choice into a concrete CellPatch. */
export function applyChoice(
  disagreement: Disagreement,
  choice: DisagreementChoice,
): CellPatch {
  if (choice.pick === "A") {
    return {
      sheetId: disagreement.sheetId,
      ref: disagreement.ref,
      record: disagreement.a,
      source: "A",
    };
  }
  if (choice.pick === "B") {
    return {
      sheetId: disagreement.sheetId,
      ref: disagreement.ref,
      record: disagreement.b,
      source: "B",
    };
  }
  return {
    sheetId: disagreement.sheetId,
    ref: disagreement.ref,
    record: choice.record,
    source: "A",
  };
}
