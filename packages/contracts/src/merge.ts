/**
 * Three-way combine model — MergePlan, disagreements, fallbacks, report.
 * See spec `.kiro/specs/merge-engine` and steering `no-silent-loss.md`.
 */
import type { CanonicalWorkbook, CellRecord } from "./canonical";
import type { ChangeSummary } from "./changeset";

/** The two divergent sides of a combine. */
export type Side = "A" | "B";

/** One cell edit to apply to the carrier file. */
export interface CellPatch {
  sheetId: number;
  /** Target address in the CARRIER file. */
  ref: string;
  /** Final cell state; null deletes the cell contents. */
  record: CellRecord | null;
  /** Which side the value comes from. */
  source: Side;
  /** True when a carried formula range spans an inserted area (to review). */
  needsReview?: boolean;
}

/** A cell both sides changed differently — the user must decide (SUT-F-19). */
export interface Disagreement {
  id: string;
  sheetId: number;
  /** Address in the carrier/alignment space. */
  ref: string;
  base: CellRecord | null;
  a: CellRecord | null;
  b: CellRecord | null;
}

/** The user's answer for one disagreement. */
export type DisagreementChoice =
  | { id: string; pick: Side }
  | { id: string; pick: "custom"; record: CellRecord };

/** A sheet where automatic combine was refused (case 4, SUT-F-20). */
export interface SheetFallback {
  sheetId: number;
  reason: "structure-divergence";
  /** Side whose structure the user chose to keep; unset while pending. */
  keptSide?: Side;
  /** Changes on the side not kept — listed in the report, applied by hand. */
  discardedSummary: ChangeSummary;
}

/** Report categories of a combine (SUT-F-21). */
export type ReportCategory = "applied" | "decided" | "not-carried" | "to-review";

/** One line of the combine report. */
export interface ReportEntry {
  category: ReportCategory;
  side: Side | "both";
  sheetName: string;
  ref?: string;
  label: string;
  detail?: string;
}

/** Full plan produced before any file is written. */
export interface MergePlan {
  /** Which side's file is patched (the "carrier"). */
  carrier: Side;
  /** Cell edits applied automatically. */
  patches: CellPatch[];
  /** Open disagreements (block saving until resolved). */
  disagreements: Disagreement[];
  /** Sheets refused for automatic combine (safe fallback). */
  fallbacks: SheetFallback[];
  /** Report lines (applied / not-carried / to-review). */
  report: ReportEntry[];
}

/** Plan after the user resolved every disagreement. */
export interface ResolvedMerge {
  patches: CellPatch[];
  report: ReportEntry[];
}

/** Public API implemented by `@suture/merge`. */
export interface MergeEngine {
  /** Computes the combine plan of O (origin), A and B. */
  plan(origin: CanonicalWorkbook, a: CanonicalWorkbook, b: CanonicalWorkbook): MergePlan;
  /** Applies the user's choices; throws if any disagreement remains open. */
  resolve(plan: MergePlan, choices: DisagreementChoice[]): ResolvedMerge;
}
