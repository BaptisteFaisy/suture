/**
 * Shared test helpers: a temporary repository on the real file system, and
 * the demo workbooks that the fixture builder produced.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SutureStore } from "@suture/contracts";
import { createSutureStore } from "../src/store";

export const FIXTURES = path.resolve(__dirname, "../../../fixtures/generated");

export function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)));
}

export interface TempRepo {
  dir: string;
  store: SutureStore;
  cleanup(): void;
}

/** A throwaway repository, with a fixed clock for deterministic versions. */
export function tempRepo(options: { author?: string; start?: number } = {}): TempRepo {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suture-store-"));
  let clock = options.start ?? 1_700_000_000_000;
  const store = createSutureStore({
    fs: fs as never,
    dir,
    author: options.author ?? "Nadia",
    now: () => {
      clock += 1000;
      return clock;
    },
  });
  return {
    dir,
    store,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** A repository holding the demo original as its first version. */
export async function seededRepo(): Promise<TempRepo> {
  const repo = tempRepo();
  await repo.store.init("budget-2026.xlsx");
  await repo.store.commitVersion({
    file: fixtureBytes("budget-2026.xlsx"),
    note: "Original budget",
    author: "Nadia",
  });
  return repo;
}
