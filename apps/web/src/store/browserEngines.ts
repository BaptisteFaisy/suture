/**
 * The engines as the browser uses them: the real packages, wired together.
 */
import { deriveCanonical } from "@suture/canonical";
import { compare } from "@suture/diff";
import { createBrowserStore } from "@suture/git-store";
import { mergeEngine } from "@suture/merge";
import { readWorkbook, zipParts } from "@suture/ooxml-io";
import { patchWorkbook } from "@suture/ooxml-patch";
import type { Engines } from "./ports";

/** The engine set used by the application. */
export function createBrowserEngines(): Engines {
  return {
    readWorkbook,
    deriveCanonical,
    compare,
    planMerge: mergeEngine.plan.bind(mergeEngine),
    resolveMerge: mergeEngine.resolve.bind(mergeEngine),
    patchWorkbook,
    zipParts,
    openStore: async (workbookId) => createBrowserStore(workbookId),
  };
}
