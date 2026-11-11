/**
 * Version store contract — versions, scenarios, milestones, combine commits,
 * restore, cell history, export. See spec `.kiro/specs/git-store`.
 */
import type { CanonicalWorkbook, CellRecord } from "./canonical";
import type { OoxmlParts } from "./ooxml";

/** Metadata of one committed version. */
export interface VersionMeta {
  /** Commit hash (full). */
  id: string;
  /** Version note (commit message). */
  note: string;
  author: string;
  /** Unix epoch milliseconds. */
  timestamp: number;
  /** Parent version ids; two parents for a combine (SUT-F-23). */
  parents: string[];
  /** Scenario (branch) the version belongs to. */
  scenario: string;
  /** Milestone (tag) name when the version carries one (SUT-F-28). */
  milestone?: string;
}

/** A scenario (branch). Exactly one scenario is the reference. */
export interface ScenarioInfo {
  name: string;
  /** Head version id. */
  head: string;
  reference: boolean;
}

/** Outcome of a commit attempt: a new version, or "unchanged" (SUT-F-03). */
export interface CommitOutcome {
  version?: VersionMeta;
  unchanged?: true;
}

/** Input for a new version. */
export interface NewVersionInput {
  /** Raw .xlsx/.xlsm bytes. */
  file: Uint8Array;
  note: string;
  author: string;
  /** Target scenario; defaults to the reference. */
  scenario?: string;
}

/** One step of a cell's history (SUT-F-26). */
export interface CellHistoryEntry {
  versionId: string;
  author: string;
  timestamp: number;
  note: string;
  before: CellRecord | null;
  after: CellRecord | null;
}

/** Input for a combine commit (two parents, SUT-F-23). */
export interface CombineInput extends NewVersionInput {
  parents: [string, string];
  /** Markdown report attached to the version note (SUT-F-21). */
  report: string;
}

/**
 * Public API implemented by `@suture/git-store`.
 * Backed by isomorphic-git over lightning-fs (browser) or an in-memory
 * filesystem (tests). Canonical derivation is injected by the caller so the
 * store stays testable standalone.
 */
export interface SutureStore {
  /** Initialises the repository (idempotent). */
  init(name: string): Promise<void>;
  /** Commits a new version of the tracked workbook. */
  commitVersion(input: NewVersionInput): Promise<CommitOutcome>;
  /** Lists versions, newest first; optional scenario filter. */
  listVersions(scenario?: string): Promise<VersionMeta[]>;
  /** Metadata of one version. */
  getVersion(id: string): Promise<VersionMeta>;
  /** Raw parts of one version (for restore, SUT-F-05). */
  getParts(versionId: string): Promise<OoxmlParts>;
  /** Canonical view of one version. */
  getCanonical(versionId: string): Promise<CanonicalWorkbook>;
  /** Re-zipped workbook of one version (byte-faithful at part level). */
  restoreFile(versionId: string): Promise<Uint8Array>;
  /** Creates a scenario (branch) from a version (SUT-F-16). */
  createScenario(name: string, fromVersion: string): Promise<ScenarioInfo>;
  /** Lists scenarios, reference first. */
  listScenarios(): Promise<ScenarioInfo[]>;
  /** Commits the combined workbook as a two-parent version. */
  commitCombine(input: CombineInput): Promise<CommitOutcome>;
  /** Restores a version as a NEW version (never deletes history, SUT-F-27). */
  restore(versionId: string, note: string, author: string): Promise<VersionMeta>;
  /** Names a version (milestone/tag). */
  setMilestone(versionId: string, name: string): Promise<void>;
  /** Versions where a cell's input changed (SUT-F-26). */
  cellHistory(sheetId: number, ref: string): Promise<CellHistoryEntry[]>;
  /** ZIP archive containing a clonable Git repository (SUT-F-29). */
  exportBundle(): Promise<Uint8Array>;
}
