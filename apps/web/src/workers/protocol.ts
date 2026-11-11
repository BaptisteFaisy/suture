/**
 * Wire protocol shared by the app thread and the analysis worker (SUT-N-03).
 *
 * One request per engine call, tagged with an identifier so several calls can
 * be in flight at once. Byte payloads are carried as `ArrayBuffer`s listed in
 * the transfer list: the buffers move instead of being copied, so a large
 * workbook does not cross the boundary twice.
 *
 * Ownership rule: passing bytes to the worker hands their buffers over. A
 * caller that needs the same bytes afterwards must pass a copy (the engines
 * themselves always allocate fresh buffers for their results).
 */
import { SutureFileError } from "@suture/contracts";
import type {
  CanonicalWorkbook,
  ChangeSet,
  DisagreementChoice,
  FileErrorCode,
  MergePlan,
  OoxmlParts,
  PatchRequest,
  PatchResult,
  ReadWorkbookResult,
  ResolvedMerge,
} from "@suture/contracts";
import { hasErrorCode } from "../store/errors";
import type { PartsByPath } from "../store/ports";

/** Every operation the worker answers. `openStore` is deliberately absent. */
export const OPERATION_KINDS = [
  "readWorkbook",
  "deriveCanonical",
  "compare",
  "planMerge",
  "resolveMerge",
  "patchWorkbook",
  "zipParts",
] as const;

export type OperationKind = (typeof OPERATION_KINDS)[number];

/** Arguments of each operation, as they travel on the wire. */
export interface OperationPayloads {
  readWorkbook: { bytes: Uint8Array };
  deriveCanonical: { parts: OoxmlParts };
  compare: {
    before: CanonicalWorkbook;
    after: CanonicalWorkbook;
    beforeParts: PartsByPath;
    afterParts: PartsByPath;
  };
  planMerge: { origin: CanonicalWorkbook; a: CanonicalWorkbook; b: CanonicalWorkbook };
  resolveMerge: { plan: MergePlan; choices: DisagreementChoice[] };
  patchWorkbook: { parts: OoxmlParts; request: PatchRequest };
  zipParts: { parts: OoxmlParts };
}

/** Value each operation answers with. */
export interface OperationResults {
  readWorkbook: ReadWorkbookResult;
  deriveCanonical: CanonicalWorkbook;
  compare: ChangeSet;
  planMerge: MergePlan;
  resolveMerge: ResolvedMerge;
  patchWorkbook: PatchResult;
  zipParts: Uint8Array;
}

export type PayloadOf<K extends OperationKind> = OperationPayloads[K];
export type ResultOf<K extends OperationKind> = OperationResults[K];

/** A request is a discriminated union, so the worker narrows on `kind`. */
export type WorkerRequest = {
  [K in OperationKind]: { id: number; kind: K; payload: OperationPayloads[K] };
}[OperationKind];

/** A typed refusal that survives the round trip: `code` is what the UI shows. */
export interface SerializedError {
  code?: string;
  message: string;
}

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: SerializedError };

/** Codes of `FileErrorCode` (the contract type has no runtime mirror). */
const FILE_ERROR_CODES = new Set<string>([
  "not-a-zip",
  "encrypted",
  "unsupported-format",
  "corrupt",
  "too-large",
  "too-many-entries",
  "zip-bomb",
  "too-many-cells",
  "missing-workbook",
]);

/** Turns a thrown value into something structured clone can carry. */
export function serializeError(error: unknown): SerializedError {
  const message =
    error instanceof Error && error.message.length > 0 ? error.message : "Engine failure";
  return hasErrorCode(error) ? { code: error.code, message } : { message };
}

/**
 * Rebuilds the refusal on the calling side: without this, a rejected file
 * ("encrypted", "zip-bomb"…) would reach the UI as a generic error.
 */
export function deserializeError(serialized: SerializedError): Error {
  const { code, message } = serialized;
  if (code !== undefined && FILE_ERROR_CODES.has(code)) {
    return new SutureFileError(code as FileErrorCode, message);
  }
  return new Error(message);
}

/** True when the message looks like a worker response. */
export function isWorkerResponse(data: unknown): data is WorkerResponse {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as { id?: unknown; ok?: unknown };
  return typeof candidate.id === "number" && typeof candidate.ok === "boolean";
}

/** True when the message looks like a worker request. */
export function isWorkerRequest(data: unknown): data is WorkerRequest {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as { id?: unknown; kind?: unknown; payload?: unknown };
  if (typeof candidate.id !== "number") return false;
  if (typeof candidate.payload !== "object" || candidate.payload === null) return false;
  return OPERATION_KINDS.some((kind) => kind === candidate.kind);
}

/** Usable buffers of a payload or a result, with no duplicate. */
export function transferablesOf(value: unknown): Transferable[] {
  const buffers = new Set<ArrayBuffer>();
  collectBuffers(value, buffers);
  return [...buffers];
}

function collectBuffers(value: unknown, buffers: Set<ArrayBuffer>): void {
  if (value instanceof Uint8Array) {
    buffers.add(value.buffer as ArrayBuffer);
    return;
  }
  if (value instanceof Map) {
    for (const entry of value.values()) collectBuffers(entry, buffers);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectBuffers(item, buffers);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) collectBuffers(item, buffers);
  }
}
