import { describe, expect, it, vi } from "vitest";
import type {
  CanonicalWorkbook,
  ChangeSet,
  MergePlan,
  OoxmlParts,
  PatchResult,
  ReadWorkbookResult,
  ResolvedMerge,
  SutureStore,
} from "@suture/contracts";
import { createBrowserEngines } from "./browserEngines";
import type { Engines } from "./ports";
import { createWorkerEngines, type WorkerEngines } from "./workerEngines";
import { handleRequest } from "../workers/analysis-handler";
import { createAnalysisEngines } from "../workers/analysisEngines";
import { isWorkerRequest } from "../workers/protocol";
import type { WorkerPort } from "../workers/spawn";

/** One thing a fake worker was asked to do. */
interface Posted {
  message: { id: number; kind: string; payload: unknown };
  transfer: Transferable[];
}

/**
 * A fake worker: it records every request and answers only when the test says
 * so, which is exactly what an out-of-order worker looks like.
 */
function fakeWorker() {
  const posted: Posted[] = [];
  let onMessage: (data: unknown) => void = () => undefined;
  let onError: (message: string) => void = () => undefined;
  let terminated = false;
  const port: WorkerPort = {
    postMessage: (message, transfer) => {
      posted.push({ message: message as Posted["message"], transfer });
    },
    onMessage: (listener) => {
      onMessage = listener;
    },
    onError: (listener) => {
      onError = listener;
    },
    terminate: () => {
      terminated = true;
    },
  };
  return {
    port,
    posted,
    answer: (id: number, result: unknown) => onMessage({ id, ok: true, result }),
    answerAll: (results: unknown[]) =>
      posted.forEach((entry, index) => onMessage({ id: entry.message.id, ok: true, result: results[index] })),
    refuse: (id: number, code: string, message: string) =>
      onMessage({ id, ok: false, error: { code, message } }),
    crash: (message: string) => onError(message),
    kinds: () => posted.map((entry) => entry.message.kind),
    firstId: () => posted[0]?.message.id ?? 0,
    get terminated() {
      return terminated;
    },
  };
}

/** The single-threaded engines, reduced to what these tests observe. */
function fallbackEngines(store: SutureStore | null = null): Engines {
  const never = async (): Promise<never> => {
    throw new Error("the fallback should not be called");
  };
  return {
    readWorkbook: never,
    deriveCanonical: never,
    compare: never,
    planMerge: never,
    resolveMerge: never,
    patchWorkbook: never,
    zipParts: never,
    openStore: async () => {
      if (store === null) throw new Error("the fallback has no store");
      return store;
    },
  };
}

/** Engines over a fake worker; the warnings are collected, never printed. */
function enginesOver(
  spawn: () => WorkerPort,
  store: SutureStore | null = null,
): { engines: WorkerEngines; warnings: string[] } {
  const warnings: string[] = [];
  const engines = createWorkerEngines({
    spawn,
    createFallback: () => fallbackEngines(store),
    warn: (message) => warnings.push(message),
  });
  return { engines, warnings };
}

const CANONICAL: CanonicalWorkbook = { meta: { sheets: [], definedNames: [] }, sheets: [] };
const PARTS: OoxmlParts = [{ path: "xl/workbook.xml", data: new Uint8Array([1, 2, 3]) }];
const READ: ReadWorkbookResult = { parts: PARTS, macroEnabled: false };
const PLAN: MergePlan = { carrier: "A", patches: [], disagreements: [], fallbacks: [], report: [] };
const RESOLVED: ResolvedMerge = { patches: [], report: [] };
const PATCHED: PatchResult = { parts: PARTS, touchedSheets: [], calcChainRemoved: false };

function emptySummary(): ChangeSet["summary"] {
  return {
    inputsModified: 0,
    consequences: 0,
    formats: 0,
    rowsInserted: 0,
    rowsDeleted: 0,
    colsInserted: 0,
    colsDeleted: 0,
    sheetsAdded: 0,
    sheetsRemoved: 0,
    sheetsRenamed: 0,
    partsChanged: 0,
  };
}

const CHANGES: ChangeSet = { sheets: [], sheetChanges: [], partChanges: [], summary: emptySummary() };

describe("the queue — several calls in flight", () => {
  it("answers each call with its own result, whatever the order", async () => {
    const worker = fakeWorker();
    const { engines } = enginesOver(() => worker.port);

    const reading = engines.readWorkbook(new Uint8Array([9]));
    const derivation = engines.deriveCanonical(PARTS);
    const comparison = engines.compare(CANONICAL, CANONICAL, {}, {});
    expect(worker.kinds()).toEqual(["readWorkbook", "deriveCanonical", "compare"]);

    // The last request answers first: matching is by identifier, not by rank.
    const [first, second, third] = worker.posted;
    worker.answer(third?.message.id ?? 0, CHANGES);
    worker.answer(first?.message.id ?? 0, READ);
    worker.answer(second?.message.id ?? 0, CANONICAL);

    await expect(reading).resolves.toEqual(READ);
    await expect(derivation).resolves.toEqual(CANONICAL);
    await expect(comparison).resolves.toEqual(CHANGES);
    engines.dispose();
  });

  it("moves the workbook bytes instead of copying them", async () => {
    const worker = fakeWorker();
    const { engines } = enginesOver(() => worker.port);
    const bytes = new Uint8Array([4, 5, 6]);
    const pending = engines.readWorkbook(bytes);
    expect(worker.posted[0]?.transfer).toContain(bytes.buffer);
    worker.answer(worker.firstId(), READ);
    await pending;
    engines.dispose();
  });
});

describe("the queue — what crosses the boundary", () => {
  it("routes the reading half of the port to the worker", async () => {
    const worker = fakeWorker();
    const { engines } = enginesOver(() => worker.port);
    const calls = [
      engines.readWorkbook(new Uint8Array([1])),
      engines.deriveCanonical(PARTS),
      engines.compare(CANONICAL, CANONICAL, {}, {}),
    ];
    worker.answerAll([READ, CANONICAL, CHANGES]);
    await expect(Promise.all(calls)).resolves.toHaveLength(3);
    engines.dispose();
  });

  it("routes the combine half of the port to the worker", async () => {
    const worker = fakeWorker();
    const { engines } = enginesOver(() => worker.port);
    const calls = [
      engines.planMerge(CANONICAL, CANONICAL, CANONICAL),
      engines.resolveMerge(PLAN, []),
      engines.patchWorkbook(PARTS, { patches: [], sheetPaths: new Map() }),
      engines.zipParts(PARTS),
    ];
    worker.answerAll([PLAN, RESOLVED, PATCHED, new Uint8Array([7])]);
    await expect(Promise.all(calls)).resolves.toHaveLength(4);
    engines.dispose();
  });

  it("keeps openStore on the app thread, out of the queue", async () => {
    const worker = fakeWorker();
    const store = {} as SutureStore;
    const { engines } = enginesOver(() => worker.port, store);
    await expect(engines.openStore("wb-1")).resolves.toBe(store);
    expect(worker.posted).toHaveLength(0);
    engines.dispose();
  });
});

/**
 * A fake worker that really runs the engines: the request and the answer cross
 * the whole wire format, which is the closest a node test gets to a browser.
 */
function workingWorker(): WorkerPort {
  const engines = createAnalysisEngines();
  let onMessage: (data: unknown) => void = () => undefined;
  return {
    postMessage: (message) => {
      if (!isWorkerRequest(message)) return;
      void handleRequest(message, engines).then(({ response }) => onMessage(response));
    },
    onMessage: (listener) => {
      onMessage = listener;
    },
    onError: () => undefined,
    terminate: () => undefined,
  };
}

describe("a real round trip through the wire format", () => {
  it("recompresses parts and reads them back", async () => {
    const { engines } = enginesOver(workingWorker);
    const bytes = await engines.zipParts(PARTS);
    expect(bytes).toBeInstanceOf(Uint8Array);
    await expect(engines.readWorkbook(bytes)).resolves.toMatchObject({ macroEnabled: false });
    engines.dispose();
  });

  it("carries a typed refusal back with its code", async () => {
    const { engines } = enginesOver(workingWorker);
    await expect(engines.readWorkbook(new Uint8Array([1, 2, 3]))).rejects.toMatchObject({
      code: "not-a-zip",
    });
    engines.dispose();
  });
});

describe("refusals survive the round trip", () => {
  it("rebuilds the typed error with its code", async () => {
    const worker = fakeWorker();
    const { engines } = enginesOver(() => worker.port);
    const pending = engines.readWorkbook(new Uint8Array([0]));
    worker.refuse(worker.firstId(), "encrypted", "This workbook is protected.");
    await expect(pending).rejects.toMatchObject({
      code: "encrypted",
      message: "This workbook is protected.",
    });
    engines.dispose();
  });

  it("keeps a plain error plain", async () => {
    const worker = fakeWorker();
    const { engines } = enginesOver(() => worker.port);
    const pending = engines.deriveCanonical(PARTS);
    worker.refuse(worker.firstId(), "", "boom");
    await expect(pending).rejects.toBeInstanceOf(Error);
    await expect(pending).rejects.not.toHaveProperty("code");
    engines.dispose();
  });

  it("rejects everything in flight when the worker crashes", async () => {
    const worker = fakeWorker();
    const { engines } = enginesOver(() => worker.port);
    const first = engines.readWorkbook(new Uint8Array([1]));
    const second = engines.zipParts(PARTS);
    worker.crash("out of memory");
    await expect(first).rejects.toThrow("out of memory");
    await expect(second).rejects.toThrow("out of memory");
    engines.dispose();
  });

  it("refuses new calls once disposed and terminates the worker", async () => {
    const worker = fakeWorker();
    const { engines } = enginesOver(() => worker.port);
    engines.dispose();
    expect(worker.terminated).toBe(true);
    await expect(engines.zipParts(PARTS)).rejects.toBeInstanceOf(Error);
  });
});

describe("the fallback keeps the app working", () => {
  it("falls back to the single-threaded engines when no worker can be built", async () => {
    const warnings: string[] = [];
    const engines = createWorkerEngines({
      spawn: () => {
        throw new Error("no worker support in this environment");
      },
      createFallback: () => createBrowserEngines(),
      warn: (message) => warnings.push(message),
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("analysis worker unavailable");
    await expect(engines.zipParts(PARTS)).resolves.toBeInstanceOf(Uint8Array);
    expect(() => engines.dispose()).not.toThrow();
  });

  it("falls back for real when the environment has no Worker at all", async () => {
    const warnings: string[] = [];
    const engines = createWorkerEngines({
      createFallback: () => createBrowserEngines(),
      warn: (message) => warnings.push(message),
    });
    // The node test environment has no Worker: the default spawn must refuse.
    expect(warnings).toHaveLength(1);
    await expect(engines.zipParts(PARTS)).resolves.toBeInstanceOf(Uint8Array);
    engines.dispose();
  });

  it("warns through the console by default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const engines = createWorkerEngines({
      spawn: () => {
        throw new Error("blocked");
      },
      createFallback: () => createBrowserEngines(),
    });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
    engines.dispose();
  });
});
