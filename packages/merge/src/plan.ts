import type {
  CanonicalSheet,
  CanonicalWorkbook,
  CellPatch,
  CellRecord,
  Disagreement,
  DisagreementChoice,
  MergeEngine,
  MergePlan,
  ReportEntry,
  ResolvedMerge,
  SheetFallback,
  Side,
} from "@suture/contracts";
import { compare, type PartsByPath } from "@suture/diff";
import { applyChoice, resolveCell } from "./cells";

/** Index of cells of one sheet by their A1 ref. */
export type SheetCellMap = Map<string, CellRecord>;

export function mapOf(sheet: CanonicalSheet | undefined): SheetCellMap {
  const map = new Map<string, CellRecord>();
  if (sheet === undefined) return map;
  for (const cell of sheet.cells) map.set(cell.ref, cell);
  return map;
}

/** Three-way combine plan computation (B.8). */
export function planMerge(
  origin: CanonicalWorkbook,
  a: CanonicalWorkbook,
  b: CanonicalWorkbook,
  partsA: PartsByPath = {},
  partsB: PartsByPath = {},
): MergePlan {
  const deltaA = compare(origin, a);
  const deltaB = compare(origin, b);
  const patches: CellPatch[] = [];
  const disagreements: Disagreement[] = [];
  const fallbacks: SheetFallback[] = [];
  const report: ReportEntry[] = [];

  // Sheet matching: union of all sheets across O, A, B.
  const sheetIds = new Set<number>([
    ...origin.sheets.map((s) => s.meta.sheetId),
    ...a.sheets.map((s) => s.meta.sheetId),
    ...b.sheets.map((s) => s.meta.sheetId),
  ]);

  for (const sheetId of [...sheetIds].sort((x, y) => x - y)) {
    const sheetO = origin.sheets.find((s) => s.meta.sheetId === sheetId);
    const sheetA = a.sheets.find((s) => s.meta.sheetId === sheetId);
    const sheetB = b.sheets.find((s) => s.meta.sheetId === sheetId);

    const diffA = deltaA.sheets.find((s) => s.sheetId === sheetId);
    const diffB = deltaB.sheets.find((s) => s.sheetId === sheetId);
    const structA = diffA?.structural ?? false;
    const structB = diffB?.structural ?? false;

    // Case 4: both sides made divergent structural changes -> safe fallback.
    if (structA && structB) {
      fallbacks.push({
        sheetId,
        reason: "structure-divergence",
        discardedSummary: diffB?.summary ?? deltaB.summary,
      });
      report.push({
        category: "not-carried",
        side: "B",
        sheetName: sheetA?.meta.name ?? sheetB?.meta.name ?? String(sheetId),
        label: "Sheet structure changed on both sides; keep chosen side manually",
      });
      continue;
    }

    // Combine cells of this sheet.
    const mapO = mapOf(sheetO);
    const mapA = mapOf(sheetA);
    const mapB = mapOf(sheetB);
    const allRefs = new Set<string>([...mapO.keys(), ...mapA.keys(), ...mapB.keys()]);
    const sheetName = sheetA?.meta.name ?? sheetB?.meta.name ?? "Sheet";

    for (const ref of allRefs) {
      const cellO = mapO.get(ref) ?? null;
      const cellA = mapA.get(ref) ?? null;
      const cellB = mapB.get(ref) ?? null;
      const outcome = resolveCell(sheetId, ref, cellO, cellA, cellB);

      if (outcome.patch !== undefined) {
        patches.push(outcome.patch);
        report.push({
          category: "applied",
          side: outcome.patch.source,
          sheetName,
          ref,
          label: outcome.patch.record?.input ?? "(empty)",
        });
      } else if (outcome.disagreement !== undefined) {
        disagreements.push(outcome.disagreement);
      } else if (outcome.appliedSame === true) {
        report.push({
          category: "applied",
          side: "both",
          sheetName,
          ref,
          label: cellA?.input ?? "(empty)",
        });
      }
    }
  }

  // Non-cell parts changed on B: reported as not carried over (carrier is A).
  const nonCellB = compare(origin, b, {}, partsB).partChanges;
  for (const part of nonCellB) {
    report.push({
      category: "not-carried",
      side: "B",
      sheetName: "(workbook)",
      label: `${part.label} (${part.type})`,
      detail: part.path,
    });
  }

  return {
    carrier: "A",
    patches,
    disagreements,
    fallbacks,
    report,
  };
}

/** Applies user choices to the plan. Throws if any disagreement is unanswered. */
export function resolveMerge(
  plan: MergePlan,
  choices: DisagreementChoice[],
): ResolvedMerge {
  const choiceMap = new Map<string, DisagreementChoice>();
  for (const c of choices) choiceMap.set(c.id, c);

  for (const d of plan.disagreements) {
    if (!choiceMap.has(d.id)) {
      throw new Error(`Unresolved disagreement at ${d.ref}`);
    }
  }

  const patches = [...plan.patches];
  const report = [...plan.report];

  for (const d of plan.disagreements) {
    const choice = choiceMap.get(d.id)!;
    const patch = applyChoice(d, choice);
    patches.push(patch);
    report.push({
      category: "decided",
      side: patch.source,
      sheetName: String(d.sheetId),
      ref: d.ref,
      label: patch.record?.input ?? "(empty)",
    });
  }

  return { patches, report };
}

export const mergeEngine: MergeEngine = {
  plan: planMerge,
  resolve: resolveMerge,
};
