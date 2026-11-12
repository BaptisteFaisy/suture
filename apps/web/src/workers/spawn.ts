/**
 * Spawning the analysis worker, behind a very narrow interface so tests can
 * substitute a fake (SUT-N-03).
 *
 * Vite bundles this module's `?worker` import separately and hands back a
 * constructor: no extra dependency, no manual `new Worker(new URL(...))`.
 */
import AnalysisWorker from "./analysis.worker?worker";

/** What the request queue needs from a worker — a fake satisfies it too. */
export interface WorkerPort {
  /** Posts a message, moving the listed buffers instead of copying them. */
  postMessage(message: unknown, transfer: Transferable[]): void;
  /** Registers the single responder of `message` events. */
  onMessage(listener: (data: unknown) => void): void;
  /** Registers the single responder of `error` events (crash of the worker). */
  onError(listener: (message: string) => void): void;
  /** Stops the worker for good. */
  terminate(): void;
}

/** Spawns the real worker; throws when the environment has none. */
export function spawnAnalysisWorker(): WorkerPort {
  if (typeof Worker === "undefined") {
    throw new Error("no worker support in this environment");
  }
  const worker = new AnalysisWorker();
  return {
    postMessage: (message, transfer) => worker.postMessage(message, transfer),
    onMessage: (listener) => {
      worker.addEventListener("message", (event: MessageEvent) => listener(event.data));
    },
    onError: (listener) => {
      worker.addEventListener("error", (event: ErrorEvent) => listener(event.message));
    },
    terminate: () => worker.terminate(),
  };
}
