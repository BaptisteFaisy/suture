import { describe, expect, it } from "vitest";
import type { OoxmlParts, PatchRequest, SutureStore, VersionMeta } from "@suture/contracts";
import { readWorkbook, zipParts } from "@suture/ooxml-io";
import { patchWorkbook } from "@suture/ooxml-patch";
import type { AdapterDeps } from "./actions";
import { EMPTY_SESSION, type SessionState } from "./actions";
import { downloadWorkingCopy, workingCopyFileName } from "./downloadCopy";
import { readMarker } from "./origin";
import type { Engines, HostPorts } from "./ports";

/** Fixed test clock — the tests never read the wall clock. */
const NOW = 1_793_500_000_000;

const refuse = (): never => {
  throw new Error("unexpected call");
};

/** Engines of the real packages for the copy road; the rest refuses. */
function copyEngines(overrides: Partial<Engines> = {}): Engines {
  return {
    readWorkbook: refuse,
    deriveCanonical: refuse,
    compare: refuse,
    openStore: refuse,
    planMerge: refuse,
    resolveMerge: refuse,
    patchWorkbook,
    zipParts,
    ...overrides,
  };
}

/** Store double: only `getParts` ever runs, it answers with the fixture. */
function storeWith(parts: OoxmlParts): SutureStore {
  return {
    init: refuse,
    commitVersion: refuse,
    listVersions: refuse,
    getVersion: refuse,
    getParts: async () => parts,
    getCanonical: refuse,
    restoreFile: refuse,
    createScenario: refuse,
    listScenarios: refuse,
    commitCombine: refuse,
    restore: refuse,
    setMilestone: refuse,
    cellHistory: refuse,
    exportBundle: refuse,
  };
}

/** The smallest archive the reader accepts: content types and a workbook part. */
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

function meta(id: string, scenario: string): VersionMeta {
  return { id, note: id, author: "anne", timestamp: NOW, parents: [], scenario };
}

/** Records what the host was asked to download. */
function recordingHost(): { host: HostPorts; downloads: [string, Uint8Array][] } {
  const downloads: [string, Uint8Array][] = [];
  const host: HostPorts = {
    download: (fileName, bytes) => {
      downloads.push([fileName, bytes]);
    },
    now: () => NOW,
    fetchDemoFile: async () => new Uint8Array(),
    settings: { get: () => null, set: () => undefined },
  };
  return { host, downloads };
}

function openSession(store: SutureStore, versions: VersionMeta[] = []): SessionState {
  return { ...EMPTY_SESSION, workbookId: "wb-1", store, versions };
}

describe("downloadWorkingCopy — the copy leaves stamped (SUT-F-06)", () => {
  it("writes the marker through the patcher with zero cell edits", async () => {
    const requests: PatchRequest[] = [];
    const { host, downloads } = recordingHost();
    const deps: AdapterDeps = {
      engines: copyEngines({
        patchWorkbook: (parts, request) => {
          requests.push(request);
          return patchWorkbook(parts, request);
        },
      }),
      host,
    };
    await downloadWorkingCopy(deps, openSession(storeWith(fixtureParts())), "abc1234def", "Marie");
    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request?.patches).toEqual([]);
    expect(request?.sheetPaths.size).toBe(0);
    expect(request?.originMarker).toEqual({ versionId: "abc1234def", scenario: "Marie" });
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.[0]).toBe("working-copy-abc1234-Marie.xlsx");
  });

  it("comes back recognised: the downloaded bytes carry the marker", async () => {
    const { host, downloads } = recordingHost();
    const deps: AdapterDeps = { engines: copyEngines(), host };
    await downloadWorkingCopy(deps, openSession(storeWith(fixtureParts())), "abc1234def");
    const bytes = downloads[0]?.[1];
    expect(bytes).toBeInstanceOf(Uint8Array);
    const reading: AdapterDeps = { engines: copyEngines({ readWorkbook }), host };
    expect(readMarker(reading, bytes ?? new Uint8Array())).toEqual({ versionId: "abc1234def" });
  });

  it("takes the scenario of the version when the caller does not name one", async () => {
    const { host, downloads } = recordingHost();
    const deps: AdapterDeps = { engines: copyEngines(), host };
    const session = openSession(storeWith(fixtureParts()), [meta("abc1234def", "Marie")]);
    await downloadWorkingCopy(deps, session, "abc1234def");
    expect(downloads[0]?.[0]).toBe("working-copy-abc1234-Marie.xlsx");
    const reading: AdapterDeps = { engines: copyEngines({ readWorkbook }), host };
    expect(readMarker(reading, downloads[0]?.[1] ?? new Uint8Array())).toEqual({
      versionId: "abc1234def",
      scenario: "Marie",
    });
  });

  it("does nothing while no workbook is open", async () => {
    const { host, downloads } = recordingHost();
    const deps: AdapterDeps = { engines: copyEngines(), host };
    await downloadWorkingCopy(deps, EMPTY_SESSION, "abc1234def");
    expect(downloads).toHaveLength(0);
  });
});

describe("workingCopyFileName", () => {
  it("names the copy after the short version id", () => {
    expect(workingCopyFileName("abc1234def", undefined)).toBe("working-copy-abc1234.xlsx");
  });

  it("names the scenario when there is one", () => {
    expect(workingCopyFileName("abc1234def", "Marie")).toBe("working-copy-abc1234-Marie.xlsx");
  });
});
