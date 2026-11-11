/**
 * The app-thread side of the worker conversation (SUT-N-03).
 *
 * Several engine calls can be in flight at once: each request carries an
 * identifier, and answers are matched by it — the worker is free to reply in
 * any order (it answers as soon as an operation finishes).
 */
import {
  deserializeError,
  isWorkerResponse,
  transferablesOf,
  type OperationKind,
  type PayloadOf,
  type ResultOf,
  type WorkerRequest,
} from "./protocol";
import type { WorkerPort } from "./spawn";

/** Requests in flight, answered by identifier. */
export interface RequestQueue {
  /** Sends one operation and settles when its answer arrives. */
  send<K extends OperationKind>(kind: K, payload: PayloadOf<K>): Promise<ResultOf<K>>;
  /** Rejects everything still in flight. */
  dispose(): void;
  /** Number of unanswered requests — used by the tests and the diagnostics. */
  readonly pending: number;
}

interface Waiting {
  settle(value: unknown): void;
  fail(reason: Error): void;
}

/** The mutable half of the queue, kept out of the factory's way. */
interface QueueState {
  waiting: Map<number, Waiting>;
  disposed: boolean;
  nextId: number;
}

const DISPOSED = "the analysis worker is no longer available";
const CRASHED = "the analysis worker stopped";

/** Settles one request from a response, ignoring anything unknown. */
function settleFrom(state: QueueState, data: unknown): void {
  if (!isWorkerResponse(data)) return;
  const entry = state.waiting.get(data.id);
  if (entry === undefined) return;
  state.waiting.delete(data.id);
  if (data.ok) entry.settle(data.result);
  else entry.fail(deserializeError(data.error));
}

/** Rejects every request still in flight — a worker that dies strands nobody. */
function failAll(state: QueueState, reason: Error): void {
  for (const entry of state.waiting.values()) entry.fail(reason);
  state.waiting.clear();
}

/** Posts one request and returns the promise settled by its answer. */
function post<K extends OperationKind>(
  state: QueueState,
  port: WorkerPort,
  kind: K,
  payload: PayloadOf<K>,
): Promise<ResultOf<K>> {
  return new Promise<ResultOf<K>>((settle, fail) => {
    if (state.disposed) {
      fail(new Error(DISPOSED));
      return;
    }
    const id = state.nextId;
    state.nextId += 1;
    state.waiting.set(id, { settle: (value) => settle(value as ResultOf<K>), fail });
    const request = { id, kind, payload } as unknown as WorkerRequest;
    try {
      port.postMessage(request, transferablesOf(payload));
    } catch (error) {
      state.waiting.delete(id);
      fail(error instanceof Error ? error : new Error(CRASHED));
    }
  });
}

/** Builds the queue over a worker port, including its error handling. */
export function createRequestQueue(port: WorkerPort): RequestQueue {
  const state: QueueState = { waiting: new Map(), disposed: false, nextId: 1 };
  port.onMessage((data) => settleFrom(state, data));
  port.onError((message) => failAll(state, new Error(message.length > 0 ? message : CRASHED)));
  return {
    send: (kind, payload) => post(state, port, kind, payload),
    dispose: () => {
      state.disposed = true;
      failAll(state, new Error(DISPOSED));
    },
    get pending() {
      return state.waiting.size;
    },
  };
}
