import type { CellPatch, CellRecord, Disagreement, DisagreementChoice } from "@suture/contracts";

/** Stabilises an identifier for a cell disagreement. */
export function disagreementId(sheetId: number, ref: string): string {
  return `${sheetId}:${ref}`;
}

/** Formats a cell value for human reading. */
export function cellText(cell: CellRecord | null): string {
  return cell === null ? "" : cell.input;
}

/** Turns a user's choice into a concrete CellPatch. */
export function applyChoice(
  disagreement: Disagreement,
  choice: DisagreementChoice,
): CellPatch {
  if (choice.pick === "custom") {
    return {
      sheetId: disagreement.sheetId,
      ref: disagreement.ref,
      record: choice.record,
      source: "A",
    };
  }
  return {
    sheetId: disagreement.sheetId,
    ref: disagreement.ref,
    record: choice.pick === "A" ? disagreement.a : disagreement.b,
    source: choice.pick,
  };
}
