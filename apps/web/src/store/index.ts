/**
 * Store adapter — the single place where the UI meets the engines.
 *
 * The real implementation (`./realStore.ts`) wires `@suture/git-store`
 * (versions, scenarios, export) over `@suture/ooxml-io` + `@suture/canonical`.
 * Until the engines land, `createStubStore()` keeps the UI honest: empty
 * states, a disabled demo, and the same contract.
 *
 * Every screen talks to the store through this interface only — never to the
 * engines directly. That keeps the screens testable and the wiring in one
 * place.
 */
import { createContext, useContext } from "react";
import type {
  CellHistoryEntry,
  DisagreementChoice,
  ReportEntry,
  Side,
} from "@suture/contracts";

export interface WorkbookSummary {
  id: string;
  name: string;
  versions: number;
  scenarios: string[];
  updatedAt: number;
}

export interface VersionSummary {
  id: string;
  note: string;
  author: string;
  timestamp: number;
  scenario: string;
  milestone?: string;
  parents: number;
}

/** One row of the comparison grid. */
export interface ComparisonRow {
  sheetId: number;
  ref: string;
  nature: "input" | "consequence" | "format";
  before: string;
  after: string;
}

/** Filters of the comparison screen (sheet and nature). */
export interface ComparisonFilter {
  sheetId: number | "all";
  nature: "all" | "input" | "consequence" | "format";
}

export interface ComparisonView {
  rows: ComparisonRow[];
  summary: {
    inputsModified: number;
    consequences: number;
    formats: number;
    rowsInserted: number;
    rowsDeleted: number;
    colsInserted: number;
    colsDeleted: number;
    partsChanged: number;
  };
  /** Non-cell parts changed on one side (charts, macros...). */
  otherParts: string[];
  filter: ComparisonFilter;
}

/** State of the combine assistant (screen 4). */
export interface CombineView {
  /** Patches that apply on their own. */
  automatic: { sheetName: string; ref: string; value: string; source: Side }[];
  /** Open disagreements awaiting the user. */
  disagreements: {
    id: string;
    sheetName: string;
    ref: string;
    base: string;
    a: string;
    b: string;
  }[];
  /** Sheets where automatic combine was refused (safe fallback). */
  fallbacks: { sheetName: string; keptSide?: Side }[];
  /** Choices already made, by disagreement id. */
  choices: Record<string, DisagreementChoice>;
  /** Report lines (available once the combine is done). */
  report: ReportEntry[];
  /** True when every disagreement has an answer. */
  ready: boolean;
}

export interface StoreAdapter {
  workbooks: WorkbookSummary[];
  status: "idle" | "loading" | "error";
  error: string | null;
  /** True once the demo workbook can be loaded. */
  demoAvailable: boolean;
  /** True once a workbook is open (screens 2 to 5). */
  hasWorkbook: boolean;

  // Screen 1 — home
  openWorkbook(id: string): void;
  trackFile(file: File): Promise<void>;
  loadDemo(): Promise<void>;

  // Screen 2 — workbook (versions, scenarios, milestones)
  versions: VersionSummary[];
  scenarios: { name: string; reference: boolean; head: string }[];
  createScenario(name: string): Promise<void>;
  setMilestone(versionId: string, name: string): Promise<void>;
  restoreVersion(versionId: string): Promise<void>;
  exportBundle(): Promise<void>;

  // Screen 3 — compare
  comparison: ComparisonView | null;
  compare(fromVersion: string, toVersion: string): Promise<void>;
  setComparisonFilter(filter: Partial<ComparisonFilter>): void;

  // Screen 4 — combine
  combine: CombineView | null;
  startCombine(sideA: string, sideB: string): Promise<void>;
  chooseDisagreement(id: string, choice: DisagreementChoice): void;
  finalizeCombine(): Promise<void>;

  // Screen 5 — cell history
  cellHistory: CellHistoryEntry[] | null;
  showCellHistory(sheetId: number, ref: string): Promise<void>;

  // Screen 6 — settings
  authorName: string;
  setAuthorName(name: string): void;
  exportEverything(): Promise<void>;
  clearStorage(): Promise<void>;
}

export const StoreContext = createContext<StoreAdapter | null>(null);

export function useStore(): StoreAdapter {
  const store = useContext(StoreContext);
  if (store === null) {
    throw new Error("useStore must be used inside StoreContext");
  }
  return store;
}

/** Stub adapter: keeps every screen renderable before the engines land. */
export function createStubStore(): StoreAdapter {
  return {
    workbooks: [],
    status: "idle",
    error: null,
    demoAvailable: false,
    hasWorkbook: false,
    openWorkbook: () => undefined,
    trackFile: async () => undefined,
    loadDemo: async () => undefined,
    versions: [],
    scenarios: [],
    createScenario: async () => undefined,
    setMilestone: async () => undefined,
    restoreVersion: async () => undefined,
    exportBundle: async () => undefined,
    comparison: null,
    compare: async () => undefined,
    setComparisonFilter: () => undefined,
    combine: null,
    startCombine: async () => undefined,
    chooseDisagreement: () => undefined,
    finalizeCombine: async () => undefined,
    cellHistory: null,
    showCellHistory: async () => undefined,
    authorName: "",
    setAuthorName: () => undefined,
    exportEverything: async () => undefined,
    clearStorage: async () => undefined,
  };
}

export { useRealStore } from "./useRealStore";
export { createBrowserHost } from "./browserHost";
export { createBrowserEngines } from "./browserEngines";
