import { describe, expect, it } from "vitest";
import type { CanonicalWorkbook, ChangeSet, OoxmlParts } from "@suture/contracts";
import { SutureFileError } from "@suture/contracts";
import { deriveCanonical } from "@suture/canonical";
import { compare } from "@suture/diff";
import { mergeEngine } from "@suture/merge";
import { readWorkbook, zipParts } from "@suture/ooxml-io";
import { patchWorkbook } from "@suture/ooxml-patch";
import { handleRequest, runRequest } from "./analysis-handler";
import type { AnalysisEngines } from "./analysisEngines";
import {
  deserializeError,
  isWorkerRequest,
  serializeError,
  transferablesOf,
  type OperationKind,
  type WorkerRequest,
} from "./protocol";

/**
 * The worker's message logic, exercised without a worker: the handler is a
 * pure function of (request, engines), so a fake engine set is enough
 * (SUT-N-03).
 */
function fakeEngines(overrides: Partial<AnalysisEngines> = {}): AnalysisEngines {
  const never = (): never => {
    throw new Error("unexpected engine call");
  };
  return {
    readWorkbook: never,
    deriveCanonical: never,
    compare: never,
    planMerge: never,
    resolveMerge: never,
    patchWorkbook: never,
    zipParts: never,
    ...overrides,
  };
}

const EMPTY_WORKBOOK: CanonicalWorkbook = { meta: { sheets: [], definedNames: [] }, sheets: [] };

/** Every operation with a payload the engines accept: used to prove routing. */
const ROUTING: { kind: OperationKind; payload: unknown }[] = [
  { kind: "readWorkbook", payload: { bytes: new Uint8Array([1]) } },
  { kind: "deriveCanonical", payload: { parts: [] } },
  { kind: "compare", payload: { before: EMPTY_WORKBOOK, after: EMPTY_WORKBOOK, beforeParts: {}, afterParts: {} } },
  { kind: "planMerge", payload: { origin: EMPTY_WORKBOOK, a: EMPTY_WORKBOOK, b: EMPTY_WORKBOOK } },
  { kind: "resolveMerge", payload: { plan: {}, choices: [] } },
  { kind: "patchWorkbook", payload: { parts: [], request: {} } },
  { kind: "zipParts", payload: { parts: [] } },
];

/** A fake that records which engine answered, with a minimal valid answer. */
function recordingEngines(seen: string[]): AnalysisEngines {
  return {
    readWorkbook: () => {
      seen.push("readWorkbook");
      return { parts: [], macroEnabled: false };
    },
    deriveCanonical: () => {
      seen.push("deriveCanonical");
      return EMPTY_WORKBOOK;
    },
    compare: () => {
      seen.push("compare");
      return { sheets: [], sheetChanges: [], partChanges: [], summary: emptySummary() };
    },
    planMerge: () => {
      seen.push("planMerge");
      return { carrier: "A", patches: [], disagreements: [], fallbacks: [], report: [] };
    },
    resolveMerge: () => {
      seen.push("resolveMerge");
      return { patches: [], report: [] };
    },
    patchWorkbook: () => {
      seen.push("patchWorkbook");
      return { parts: [], touchedSheets: [], calcChainRemoved: false };
    },
    zipParts: () => {
      seen.push("zipParts");
      return new Uint8Array([1]);
    },
  };
}

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

/** The smallest archive the real reader accepts. */
function fixtureParts(): OoxmlParts {
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  return [
    {
      path: "[Content_Types].xml",
      data: encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
      ),
    },
    { path: "xl/workbook.xml", data: encode("<workbook/>") },
  ];
}

function request(kind: OperationKind, payload: unknown): WorkerRequest {
  return { id: 7, kind, payload } as unknown as WorkerRequest;
}

describe("isWorkerRequest — what the worker accepts", () => {
  it("accepts a well-formed request", () => {
    expect(isWorkerRequest({ id: 1, kind: "zipParts", payload: { parts: [] } })).toBe(true);
  });

  it("rejects an unknown operation, a missing id and garbage", () => {
    expect(isWorkerRequest({ id: 1, kind: "openStore", payload: {} })).toBe(false);
    expect(isWorkerRequest({ kind: "zipParts", payload: { parts: [] } })).toBe(false);
    expect(isWorkerRequest({ id: 2, kind: "zipParts" })).toBe(false);
    expect(isWorkerRequest("zipParts")).toBe(false);
    expect(isWorkerRequest(null)).toBe(false);
  });
});

describe("handleRequest — routing without a worker", () => {
  it.each(ROUTING)("routes $kind to the matching engine", async ({ kind, payload }) => {
    const seen: string[] = [];
    const { response } = await handleRequest(request(kind, payload), recordingEngines(seen));
    expect(response.ok).toBe(true);
    expect(seen).toEqual([kind]);
  });

  it("answers with the identifier of the request", async () => {
    const engines = fakeEngines({ zipParts: () => new Uint8Array([3]) });
    const { response } = await handleRequest(request("zipParts", { parts: [] }), engines);
    expect(response).toMatchObject({ id: 7, ok: true });
  });

  it("lists the buffers of the result so the caller can move them", async () => {
    const engines = fakeEngines({ zipParts: () => new Uint8Array([1, 2]) });
    const { response, transfer } = await handleRequest(
      request("zipParts", { parts: fixtureParts() }),
      engines,
    );
    expect(response.ok).toBe(true);
    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toBeInstanceOf(ArrayBuffer);
  });

  it("turns a refusal into a coded error, not a lost message", async () => {
    const engines = fakeEngines({
      readWorkbook: () => {
        throw new SutureFileError("encrypted", "This workbook is protected.");
      },
    });
    const { response, transfer } = await handleRequest(
      request("readWorkbook", { bytes: new Uint8Array([0]) }),
      engines,
    );
    expect(transfer).toEqual([]);
    expect(response).toMatchObject({
      id: 7,
      ok: false,
      error: { code: "encrypted", message: "This workbook is protected." },
    });
  });

  it("never lets a refusal escape as an unhandled rejection", async () => {
    const engines = fakeEngines({
      zipParts: () => {
        throw new Error("fflate gave up");
      },
    });
    const { response } = await handleRequest(request("zipParts", { parts: [] }), engines);
    expect(response).toMatchObject({ ok: false, error: { message: "fflate gave up" } });
  });
});

describe("the refusal makes the round trip", () => {
  it("keeps the code and the message, and rebuilds a typed error", () => {
    const rebuilt = deserializeError(serializeError(new SutureFileError("zip-bomb", "Too much.")));
    expect(rebuilt).toBeInstanceOf(SutureFileError);
    expect(rebuilt).toMatchObject({ code: "zip-bomb", message: "Too much." });
  });

  it("leaves an ordinary error uncoded", () => {
    const rebuilt = deserializeError(serializeError(new Error("boom")));
    expect(rebuilt).toBeInstanceOf(Error);
    expect(rebuilt).not.toBeInstanceOf(SutureFileError);
    expect(rebuilt.message).toBe("boom");
  });

  it("never invents a code for an unknown one", () => {
    const rebuilt = deserializeError({ code: "not-a-real-code", message: "?" });
    expect(rebuilt).not.toBeInstanceOf(SutureFileError);
    expect(rebuilt.message).toBe("?");
  });

  it("names a refusal that carries no message", () => {
    const serialized = serializeError({ code: "encrypted" });
    expect(serialized.message).toBe("Engine failure");
    expect(serialized.code).toBe("encrypted");
  });
});

describe("runRequest — the real engines, on the worker side", () => {
  const engines: AnalysisEngines = {
    readWorkbook,
    deriveCanonical,
    compare,
    planMerge: mergeEngine.plan.bind(mergeEngine),
    resolveMerge: mergeEngine.resolve.bind(mergeEngine),
    patchWorkbook,
    zipParts,
  };

  it("reads an archive and derives its canonical view", async () => {
    const bytes = zipParts(fixtureParts());
    const read = (await runRequest(request("readWorkbook", { bytes }), engines)) as {
      parts: OoxmlParts;
    };
    const canonical = (await runRequest(
      request("deriveCanonical", { parts: read.parts }),
      engines,
    )) as CanonicalWorkbook;
    expect(canonical.meta.sheets).toEqual([]);
  });

  it("compares a workbook with itself and finds nothing", async () => {
    const changes = (await runRequest(
      request("compare", {
        before: EMPTY_WORKBOOK,
        after: EMPTY_WORKBOOK,
        beforeParts: {},
        afterParts: {},
      }),
      engines,
    )) as ChangeSet;
    expect(changes.summary.inputsModified).toBe(0);
    expect(changes.sheets).toEqual([]);
  });

  it("recompresses parts into a readable archive", async () => {
    const bytes = (await runRequest(
      request("zipParts", { parts: fixtureParts() }),
      engines,
    )) as Uint8Array;
    expect(bytes.byteLength).toBeGreaterThan(0);
    const back = readWorkbook(bytes);
    expect(back.macroEnabled).toBe(false);
  });
});

describe("transferablesOf — what travels with the answer", () => {
  it("collects nested byte arrays once each", () => {
    const shared = new Uint8Array([1, 2]);
    expect(transferablesOf({ parts: [{ data: shared }, { data: shared }] })).toHaveLength(1);
  });

  it("walks maps, since the patch request uses one", () => {
    const sheetPaths = new Map<number, string>([[1, "xl/worksheets/sheet1.xml"]]);
    expect(transferablesOf({ request: { sheetPaths } })).toEqual([]);
    expect(transferablesOf({ sheetPaths: new Map([[1, new Uint8Array([9])]]) })).toHaveLength(1);
  });

  it("ignores plain data, which needs no buffer", () => {
    expect(transferablesOf({ meta: { sheets: [] }, label: "text", flag: true })).toEqual([]);
    expect(transferablesOf(null)).toEqual([]);
  });
});
