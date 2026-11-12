/**
 * `planMerge` — the three-way combine of B.8: pick the carrier, combine each
 * sheet, and account for every change of both sides.
 */
import type {
  CanonicalWorkbook,
  ChangeSet,
  DisagreementChoice,
  MergeEngine,
  MergePlan,
  ReportEntry,
  ResolvedMerge,
  SheetFallback,
} from "@suture/contracts";
import { compare } from "@suture/diff";
import { chooseCarrier, structures, type SheetStructure } from "./carrier";
import { applyChoice } from "./cells";
import { combineSheet, describeChange, otherSide } from "./sheet-plan";

const NO_STRUCTURE: Omit<SheetStructure, "sheetId"> = {
  structuralA: false,
  structuralB: false,
  sameStructure: false,
};

/** Builds the combine plan of an origin and two divergent versions. */
export function planMerge(
  origin: CanonicalWorkbook,
  a: CanonicalWorkbook,
  b: CanonicalWorkbook,
): MergePlan {
  const deltaA = compare(origin, a);
  const deltaB = compare(origin, b);
  const sheetStructures = structures(deltaA, deltaB);
  const carrier = chooseCarrier(sheetStructures);
  const carrierView = carrier === "A" ? a : b;
  const otherView = carrier === "A" ? b : a;
  const carrierDelta = carrier === "A" ? deltaA : deltaB;
  const otherDelta = carrier === "A" ? deltaB : deltaA;

  const plan: MergePlan = { carrier, patches: [], disagreements: [], fallbacks: [], report: [] };
  const covered = new Set<string>();

  for (const sheetId of sheetIdsOf(origin, a, b)) {
    const structure = sheetStructures.find((item) => item.sheetId === sheetId) ?? {
      sheetId,
      ...NO_STRUCTURE,
    };
    const sheetName = nameOf(carrierView, otherView, origin, sheetId);
    const result = combineSheet({
      sheetId,
      sheetName,
      origin,
      carrier: carrierView,
      other: otherView,
      carrierSide: carrier,
      otherChanges: otherDelta.sheets.find((sheet) => sheet.sheetId === sheetId),
      structure,
    });
    plan.patches.push(...result.patches);
    plan.disagreements.push(...result.disagreements);
    plan.report.push(...result.report);
    for (const entry of result.report) covered.add(`${sheetId}:${entry.ref ?? ""}`);
    if (result.fallback !== undefined) {
      const fallback: SheetFallback = {
        sheetId,
        reason: "structure-divergence",
        discardedSummary: result.fallback.discarded,
      };
      plan.fallbacks.push(fallback);
    }
  }

  reportCarrierSide(plan, carrierDelta, carrierView, carrier, covered);
  reportOtherParts(plan, otherDelta, carrier);
  return plan;
}

function sheetIdsOf(...workbooks: CanonicalWorkbook[]): number[] {
  const ids = new Set<number>();
  for (const workbook of workbooks) {
    for (const sheet of workbook.sheets) ids.add(sheet.meta.sheetId);
  }
  return [...ids].sort((x, y) => x - y);
}

export function nameOf(
  first: CanonicalWorkbook,
  second: CanonicalWorkbook,
  third: CanonicalWorkbook,
  sheetId: number,
): string {
  for (const workbook of [first, second, third]) {
    const sheet = workbook.sheets.find((item) => item.meta.sheetId === sheetId);
    if (sheet !== undefined) return sheet.meta.name;
  }
  return `Sheet ${sheetId}`;
}

/** Every change of the carrier side is already in the file: say so. */
function reportCarrierSide(
  plan: MergePlan,
  carrierDelta: ChangeSet,
  carrierView: CanonicalWorkbook,
  carrier: "A" | "B",
  covered: Set<string>,
): void {
  for (const sheet of carrierDelta.sheets) {
    const name = nameOf(carrierView, carrierView, carrierView, sheet.sheetId);
    for (const change of sheet.cells) {
      if (covered.has(`${sheet.sheetId}:${change.ref}`)) continue;
      plan.report.push({
        category: "applied",
        side: carrier,
        sheetName: name,
        ref: change.ref,
        label: describeChange(change),
      });
    }
    for (const row of sheet.rowsChanged) {
      plan.report.push({
        category: "applied",
        side: carrier,
        sheetName: name,
        label: `Row ${row.type} (${row.cells.length} cell(s))`,
      });
    }
  }
  for (const change of carrierDelta.sheetChanges) {
    plan.report.push({
      category: "applied",
      side: carrier,
      sheetName: change.after ?? change.before ?? `Sheet ${change.sheetId}`,
      label: `Sheet ${change.type}`,
    });
  }
}

/** Non-cell parts and sheets only the other side has cannot be carried. */
function reportOtherParts(plan: MergePlan, otherDelta: ChangeSet, carrier: "A" | "B"): void {
  const side = otherSide(carrier);
  for (const part of otherDelta.partChanges) {
    plan.report.push({
      category: "not-carried",
      side,
      sheetName: "(workbook)",
      label: `${part.label} (${part.type})`,
      detail: part.path,
    });
  }
  for (const change of otherDelta.sheetChanges) {
    if (change.type !== "added") continue;
    plan.report.push({
      category: "not-carried",
      side,
      sheetName: change.after ?? `Sheet ${change.sheetId}`,
      label: "Sheet added on this side only: kept out of the combined file",
    });
  }
}

/** Applies the user's decisions; refuses to save while one is open. */
export function resolveMerge(
  plan: MergePlan,
  choices: DisagreementChoice[],
): ResolvedMerge {
  const byId = new Map<string, DisagreementChoice>();
  for (const choice of choices) byId.set(choice.id, choice);

  const missing = plan.disagreements.filter((item) => byId.get(item.id) === undefined);
  if (missing.length > 0) {
    throw new Error(`${missing.length} disagreement(s) still open`);
  }

  const patches = [...plan.patches];
  const report: ReportEntry[] = [...plan.report];
  for (const item of plan.disagreements) {
    const choice = byId.get(item.id);
    if (choice === undefined) continue;
    const patch = applyChoice(item, choice);
    patches.push(patch);
    report.push({
      category: "decided",
      side: choice.pick === "custom" ? plan.carrier : choice.pick,
      sheetName: `Sheet ${item.sheetId}`,
      ref: item.ref,
      label: patch.record === null ? "(cleared)" : patch.record.input,
    });
  }
  return { patches, report };
}

export const mergeEngine: MergeEngine = {
  plan: planMerge,
  resolve: resolveMerge,
};
