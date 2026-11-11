/**
 * `@suture/git-store` — versions, scenarios, milestones, two-parent combines,
 * restore, cell history and clonable export, over isomorphic-git.
 *
 * The file system is injected: `node:fs` in tests, lightning-fs in the
 * browser. Nothing ever leaves the machine (SUT-N-01).
 */
import type { SutureStore } from "@suture/contracts";
import { createContext, type StoreOptions } from "./context";
import { historyOps } from "./history";
import { scenarioOps } from "./scenarios";
import { versionOps } from "./versions";

export type SutureStoreOptions = StoreOptions;

/** Creates a store for one tracked workbook. */
export function createSutureStore(options: SutureStoreOptions): SutureStore {
  const ctx = createContext(options);
  return {
    ...versionOps(ctx),
    ...scenarioOps(ctx),
    ...historyOps(ctx),
  };
}
