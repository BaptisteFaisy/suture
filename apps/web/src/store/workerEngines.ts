/**
 * The port implementation that runs analysis and comparison in a web worker
 * (SUT-N-03), so a large workbook never freezes the interface.
 *
 * Why the port had to become asynchronous (option chosen: widen `Engines`):
 * a worker only ever answers through an event, so `readWorkbook`,
 * `deriveCanonical`, `compare`, `planMerge`, `resolveMerge`, `patchWorkbook`
 * and `zipParts` cannot return a value on the spot. Keeping them synchronous
 * would have meant either calling the engines twice or leaving the heavy work
 * on the app thread — the worker would then have added nothing. The whole port
 * is now `Promise`-based, the engine packages are untouched, and the store
 * simply awaits.
 *
 * The version store (`openStore`) stays on the app thread — see
 * `src/workers/README.md` for the reasoning — and is served by the same
 * browser engines, so there is exactly one wiring of the packages.
 *
 * Safe by construction: if workers are missing or refuse to start, every
 * method is served by `createBrowserEngines()` and a warning is logged. The
 * app works everywhere; it is just less smooth.
 */
import { createBrowserEngines } from "./browserEngines";
import type { Engines } from "./ports";
import { createRequestQueue } from "../workers/workerQueue";
import { spawnAnalysisWorker, type WorkerPort } from "../workers/spawn";

/** The port plus the way to stop the worker for good. */
export interface WorkerEngines extends Engines {
  /** Terminates the worker and rejects what is still in flight. */
  dispose(): void;
}

export interface WorkerEnginesOptions {
  /** How the worker is obtained — replaced by a fake in tests. */
  spawn?: () => WorkerPort;
  /** The single-threaded implementation to reuse and to fall back on. */
  createFallback?: () => Engines;
  /** Where the fallback warning goes. */
  warn?: (message: string) => void;
}

/** The engines used by the application. */
export function createWorkerEngines(options: WorkerEnginesOptions = {}): WorkerEngines {
  const createFallback = options.createFallback ?? createBrowserEngines;
  const warn = options.warn ?? ((message: string) => console.warn(message));
  let fallback: Engines | null = null;
  const localEngines = (): Engines => (fallback ??= createFallback());

  const channel = startWorker(options.spawn ?? spawnAnalysisWorker, warn);
  if (channel === null) {
    return { ...localEngines(), dispose: () => undefined };
  }

  const queue = createRequestQueue(channel);
  return {
    ...workerBackedEngines(queue, localEngines),
    dispose: () => {
      queue.dispose();
      channel.terminate();
    },
  };
}

/** Returns the worker, or null (with a warning) when it cannot be started. */
function startWorker(spawn: () => WorkerPort, warn: (message: string) => void): WorkerPort | null {
  try {
    return spawn();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    warn(`[suture] analysis worker unavailable, staying on the app thread: ${reason}`);
    return null;
  }
}

/**
 * The port served by the worker, except `openStore`, which belongs to the app
 * thread: the store is one IndexedDB repository shared with the screens.
 */
function workerBackedEngines(
  queue: ReturnType<typeof createRequestQueue>,
  localEngines: () => Engines,
): Engines {
  return {
    readWorkbook: (bytes) => queue.send("readWorkbook", { bytes }),
    deriveCanonical: (parts) => queue.send("deriveCanonical", { parts }),
    compare: (before, after, beforeParts, afterParts) =>
      queue.send("compare", { before, after, beforeParts, afterParts }),
    planMerge: (origin, a, b) => queue.send("planMerge", { origin, a, b }),
    resolveMerge: (plan, choices) => queue.send("resolveMerge", { plan, choices }),
    patchWorkbook: (parts, request) => queue.send("patchWorkbook", { parts, request }),
    zipParts: (parts) => queue.send("zipParts", { parts }),
    openStore: (workbookId) => localEngines().openStore(workbookId),
  };
}
