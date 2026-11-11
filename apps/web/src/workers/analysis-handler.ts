/**
 * The logic of the analysis worker, kept free of any `self` access so it can
 * be called directly by tests (SUT-N-03).
 *
 * It never re-implements an engine: it receives the very same engine wiring the
 * app thread would use and only routes the request to the right entry point.
 */
import type { AnalysisEngines } from "./analysisEngines";
import {
  serializeError,
  transferablesOf,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol";

/** A response plus the buffers the caller may move instead of copying. */
export interface Execution {
  response: WorkerResponse;
  transfer: Transferable[];
}

/** Runs one operation; rejects only with what the engine itself threw. */
export async function runRequest(request: WorkerRequest, engines: AnalysisEngines): Promise<unknown> {
  switch (request.kind) {
    case "readWorkbook":
      return await engines.readWorkbook(request.payload.bytes);
    case "deriveCanonical":
      return await engines.deriveCanonical(request.payload.parts);
    case "compare": {
      const { before, after, beforeParts, afterParts } = request.payload;
      return await engines.compare(before, after, beforeParts, afterParts);
    }
    case "planMerge": {
      const { origin, a, b } = request.payload;
      return await engines.planMerge(origin, a, b);
    }
    case "resolveMerge":
      return await engines.resolveMerge(request.payload.plan, request.payload.choices);
    case "patchWorkbook":
      return await engines.patchWorkbook(request.payload.parts, request.payload.request);
    case "zipParts":
      return await engines.zipParts(request.payload.parts);
  }
}

/** Wraps one operation into a response, refusals included. */
export async function handleRequest(
  request: WorkerRequest,
  engines: AnalysisEngines,
): Promise<Execution> {
  try {
    const result = await runRequest(request, engines);
    return {
      response: { id: request.id, ok: true, result },
      transfer: transferablesOf(result),
    };
  } catch (error) {
    return { response: { id: request.id, ok: false, error: serializeError(error) }, transfer: [] };
  }
}
