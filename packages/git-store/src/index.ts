/**
 * @suture/git-store — versions, scenarios, milestones, two-parent combines,
 * restore, cell history and clonable export.
 *
 * Public API: `createSutureStore(options)` returns the contract's
 * `SutureStore`. The file system is injected (`node:fs` in tests,
 * `@isomorphic-git/lightning-fs` in the browser), so nothing ever leaves the
 * machine.
 */
export { createSutureStore, type SutureStoreOptions } from "./store";
export { browserFilesystem, createBrowserStore, workbookDir, BROWSER_STORE_NAME } from "./browser";
export { createContext, storedName, versionFiles, nameOfRef, type StoreContext, type StoreOptions } from "./context";
export { versionOps, type VersionOps } from "./versions";
export { scenarioOps, type ScenarioOps } from "./scenarios";
export { historyOps, type HistoryOps } from "./history";
export { scenarioName, scenarioRef } from "./refs";
export { REFERENCE, FORMAT_PATH, WORKBOOK_JSON, WORKBOOK_META, sheetFileName, partPath, partName, isPartPath, isCellsPath, formatJson } from "./layout";
export { exportRepository, walkDirectory } from "./export";
export { commitTree, headOf, toVersionMeta, type AuthorInput } from "./commit";
export { canonicalOf, cellsOf, filesOf, partsOf, readBlob, readText, toSheetState } from "./read";
export { writeFiles, writeNode, toHierarchy, type TreeFile } from "./tree";
export type { SutureFs } from "./fs";

export const packageName = "@suture/git-store";
