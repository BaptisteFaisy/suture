/**
 * The analysis worker (SUT-N-03): unzip, canonical derivation, comparison,
 * combine planning and carrier patching run here instead of on the app thread.
 *
 * What is NOT here: the version store. `openStore` needs isomorphic-git and
 * `@isomorphic-git/lightning-fs` over IndexedDB; a second store instance in a
 * worker would mean two caches over one database for no visible gain, so the
 * store stays on the app thread (see `src/workers/README.md`).
 *
 * The heavy bytes travel in the transfer list, and the logic itself lives in
 * `analysis-handler.ts` so tests can exercise it without a real worker.
 */
import { handleRequest } from "./analysis-handler";
import { createAnalysisEngines } from "./analysisEngines";
import { isWorkerRequest } from "./protocol";

/** The part of the worker scope we use (the DOM lib lacks its type here). */
interface WorkerScope {
  postMessage(message: unknown, transfer: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

const scope = self as unknown as WorkerScope;
const engines = createAnalysisEngines();

async function respond(data: unknown): Promise<void> {
  if (!isWorkerRequest(data)) return;
  const { response, transfer } = await handleRequest(data, engines);
  scope.postMessage(response, transfer);
}

scope.addEventListener("message", (event) => {
  void respond(event.data);
});
