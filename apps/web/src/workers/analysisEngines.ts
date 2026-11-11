/**
 * The engine set that runs the heavy work, wired to the real packages.
 *
 * One single wiring for both threads: the app thread wraps it behind the
 * asynchronous port (`store/browserEngines.ts`, plus the version store) and the
 * worker calls it directly (`workers/analysis.worker.ts`). The version store is
 * deliberately outside: it only makes sense on the app thread.
 */
import { deriveCanonical } from "@suture/canonical";
import { compare } from "@suture/diff";
import { mergeEngine } from "@suture/merge";
import { readWorkbook, zipParts } from "@suture/ooxml-io";
import { patchWorkbook } from "@suture/ooxml-patch";
import type {
  CanonicalWorkbook,
  ChangeSet,
  DisagreementChoice,
  MergePlan,
  OoxmlParts,
  PatchRequest,
  PatchResult,
  ReadWorkbookResult,
  ResolvedMerge,
} from "@suture/contracts";
import type { PartsByPath } from "../store/ports";

/**
 * The heavy engine operations, in their natural (synchronous) shape — the one
 * the packages implement. The app thread only ever sees the asynchronous port
 * built on top of it.
 */
export interface AnalysisEngines {
  /** Opens a workbook archive, with the contest limits and typed refusals. */
  readWorkbook(bytes: Uint8Array): ReadWorkbookResult;
  /** Derives the canonical cell view of an archive's parts. */
  deriveCanonical(parts: OoxmlParts): CanonicalWorkbook;
  /** Compares two canonical views; raw parts give the non-cell fingerprints. */
  compare(
    before: CanonicalWorkbook,
    after: CanonicalWorkbook,
    beforeParts: PartsByPath,
    afterParts: PartsByPath,
  ): ChangeSet;
  /** Three-way combine plan. */
  planMerge(origin: CanonicalWorkbook, a: CanonicalWorkbook, b: CanonicalWorkbook): MergePlan;
  /** Applies the user's decisions to a plan. */
  resolveMerge(plan: MergePlan, choices: DisagreementChoice[]): ResolvedMerge;
  /** Patches the carrier archive at cell level. */
  patchWorkbook(parts: OoxmlParts, request: PatchRequest): PatchResult;
  /** Recompresses parts into a workbook file. */
  zipParts(parts: OoxmlParts): Uint8Array;
}

/** Wires the real packages. No caching, no state: pure functions. */
export function createAnalysisEngines(): AnalysisEngines {
  return {
    readWorkbook,
    deriveCanonical,
    compare,
    planMerge: mergeEngine.plan.bind(mergeEngine),
    resolveMerge: mergeEngine.resolve.bind(mergeEngine),
    patchWorkbook,
    zipParts,
  };
}
