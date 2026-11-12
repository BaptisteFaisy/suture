/**
 * The engines as the browser uses them: the real packages, wired together,
 * without leaving the app thread.
 *
 * This is the reference implementation of the port — the fallback used when
 * web workers are unavailable (`store/workerEngines.ts`) and the baseline the
 * worker-backed version is measured against.
 */
import { createBrowserStore } from "@suture/git-store";
import { createAnalysisEngines } from "../workers/analysisEngines";
import type { Engines } from "./ports";

/** The engine set used by the application when it stays on one thread. */
export function createBrowserEngines(): Engines {
  const analysis = createAnalysisEngines();
  return {
    readWorkbook: async (bytes) => analysis.readWorkbook(bytes),
    deriveCanonical: async (parts) => analysis.deriveCanonical(parts),
    compare: async (before, after, beforeParts, afterParts) =>
      analysis.compare(before, after, beforeParts, afterParts),
    planMerge: async (origin, a, b) => analysis.planMerge(origin, a, b),
    resolveMerge: async (plan, choices) => analysis.resolveMerge(plan, choices),
    patchWorkbook: async (parts, request) => analysis.patchWorkbook(parts, request),
    zipParts: async (parts) => analysis.zipParts(parts),
    openStore: async (workbookId) => createBrowserStore(workbookId),
  };
}
