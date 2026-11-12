/**
 * Ports — the seams through which the app meets the engines.
 *
 * The store adapter depends on these interfaces only, never on a concrete
 * package. That keeps the wiring testable with fakes and makes the browser
 * boundary (file system, download, clock) explicit.
 *
 * Every method answers with a promise, even the ones a worker computes
 * instantly: the heavy half of them runs in a web worker (SUT-N-03), and the
 * store must not be allowed to assume a synchronous answer. The engine
 * packages themselves stay synchronous; the asynchrony lives at the seam.
 */
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
  SutureStore,
} from "@suture/contracts";

/** Parts indexed by path, as the compare engine wants them. */
export type PartsByPath = Record<string, Uint8Array>;

/** Everything the app needs from the engine packages. */
export interface Engines {
  /** Opens a workbook archive, with the contest limits and typed refusals. */
  readWorkbook(bytes: Uint8Array): Promise<ReadWorkbookResult>;
  /** Derives the canonical cell view of an archive's parts. */
  deriveCanonical(parts: OoxmlParts): Promise<CanonicalWorkbook>;
  /** Compares two canonical views; raw parts give the non-cell fingerprints. */
  compare(
    before: CanonicalWorkbook,
    after: CanonicalWorkbook,
    beforeParts: PartsByPath,
    afterParts: PartsByPath,
  ): Promise<ChangeSet>;
  /** Creates (or reopens) the version store of one tracked workbook. */
  openStore(workbookId: string): Promise<SutureStore>;
  /** Three-way combine plan. */
  planMerge(
    origin: CanonicalWorkbook,
    a: CanonicalWorkbook,
    b: CanonicalWorkbook,
  ): Promise<MergePlan>;
  /** Applies the user's decisions to a plan. */
  resolveMerge(plan: MergePlan, choices: DisagreementChoice[]): Promise<ResolvedMerge>;
  /** Patches the carrier archive at cell level. */
  patchWorkbook(parts: OoxmlParts, request: PatchRequest): Promise<PatchResult>;
  /** Recompresses parts into a workbook file. */
  zipParts(parts: OoxmlParts): Promise<Uint8Array>;
}

/** The version store of the currently open workbook is the contract's
 * `SutureStore` itself — no second interface is needed. */

/** Browser boundaries, injectable for tests. */
export interface HostPorts {
  /** Offers a file to the user (download). */
  download(fileName: string, bytes: Uint8Array): void;
  /** Current time in milliseconds. */
  now(): number;
  /** Reads one of the published demo workbooks. */
  fetchDemoFile(path: string): Promise<Uint8Array>;
  /** Persistent key/value storage for the workbook registry and settings. */
  settings: {
    get(key: string): string | null;
    set(key: string, value: string): void;
  };
}
