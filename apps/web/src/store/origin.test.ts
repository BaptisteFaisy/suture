import { describe, expect, it } from "vitest";
import type { OoxmlParts, VersionMeta } from "@suture/contracts";
import { readOriginMarker, stampOriginMarker } from "@suture/ooxml-patch";
import { translateCommon } from "../i18n/common";
import type { AdapterDeps } from "./actions";
import { EMPTY_SESSION, type SessionState } from "./actions";
import { decideReturn, describeReturn, readMarker, type Translate } from "./origin";
import type { Engines, HostPorts } from "./ports";
import { createRegistry, type Registry } from "./registry";

/** Fixed test clock — the tests never read the wall clock. */
const NOW = 1_793_500_000_000;

/** Engine double: only the members a test overrides ever run. */
function fakeEngines(overrides: Partial<Engines> = {}): Engines {
  const refuse = (): never => {
    throw new Error("unexpected engine call");
  };
  return {
    readWorkbook: refuse,
    deriveCanonical: refuse,
    compare: refuse,
    openStore: refuse,
    planMerge: refuse,
    resolveMerge: refuse,
    patchWorkbook: refuse,
    zipParts: refuse,
    ...overrides,
  };
}

function fakeHost(): HostPorts {
  const settings = new Map<string, string>();
  return {
    download: () => undefined,
    now: () => NOW,
    fetchDemoFile: async () => new Uint8Array(),
    settings: {
      get: (key) => settings.get(key) ?? null,
      set: (key, value) => {
        settings.set(key, value);
      },
    },
  };
}

function depsWith(engines: Engines): AdapterDeps {
  return { engines, host: fakeHost() };
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

/**
 * Open session on the tracked workbook "wb-1": the reference stands at
 * `referenceHead`, the scenario "Marie" at `marieHead`, and "v1" is the
 * older version of the reference the copies may have started from.
 */
function openSession(
  referenceHead: string,
  marieHead: string,
  extra: VersionMeta[] = [],
): SessionState {
  return {
    ...EMPTY_SESSION,
    workbookId: "wb-1",
    versions: [
      meta(referenceHead, "reference"),
      meta("v1", "reference"),
      meta(marieHead, "Marie"),
      ...extra,
    ],
    scenarios: [
      { name: "reference", reference: true, head: referenceHead },
      { name: "Marie", reference: false, head: marieHead },
    ],
  };
}

function trackedRegistry(): Registry {
  const registry = createRegistry(fakeHost());
  registry.add({ id: "wb-1", name: "budget-2026.xlsx", createdAt: NOW });
  return registry;
}

describe("readMarker — the stamp of a returning file", () => {
  it("reads back the marker of a stamped workbook", () => {
    const stamped = stampOriginMarker(fixtureParts(), { versionId: "v1", scenario: "Marie" });
    const deps = depsWith(
      fakeEngines({ readWorkbook: () => ({ parts: stamped, macroEnabled: false }) }),
    );
    expect(readMarker(deps, new Uint8Array())).toEqual({ versionId: "v1", scenario: "Marie" });
  });

  it("returns null when the file carries no marker", () => {
    const deps = depsWith(
      fakeEngines({ readWorkbook: () => ({ parts: fixtureParts(), macroEnabled: false }) }),
    );
    expect(readMarker(deps, new Uint8Array())).toBeNull();
    expect(readOriginMarker(fixtureParts())).toBeNull();
  });

  it("returns null when the properties survived without the Suture entries", () => {
    const washed: OoxmlParts = [
      ...fixtureParts(),
      {
        path: "docProps/custom.xml",
        data: new TextEncoder().encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties">' +
            '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Owner">' +
            "<vt:lpwstr>Marie</vt:lpwstr></property></Properties>",
        ),
      },
    ];
    const deps = depsWith(fakeEngines({ readWorkbook: () => ({ parts: washed, macroEnabled: false }) }));
    expect(readMarker(deps, new Uint8Array())).toBeNull();
  });
});

describe("decideReturn — the reference and the scenarios", () => {
  it("records a new version when the reference did not move", () => {
    const session = openSession("v2", "m1");
    const decision = decideReturn({ versionId: "v2" }, trackedRegistry(), session);
    expect(decision).toEqual({ kind: "new-version", workbookId: "wb-1" });
  });

  it("asks for a combine when the reference advanced since the copy left", () => {
    const session = openSession("v2", "m1");
    const decision = decideReturn({ versionId: "v1" }, trackedRegistry(), session);
    expect(decision).toEqual({
      kind: "combine-needed",
      workbookId: "wb-1",
      baseVersionId: "v1",
      scenario: undefined,
    });
  });

  it("follows the scenario of the marker, not the reference, when it names one", () => {
    const session = openSession("v2", "m1");
    // Marie's copy left from her own head: her scenario did not move, even
    // though the reference advanced to "v2" in the meantime.
    expect(decideReturn({ versionId: "m1", scenario: "Marie" }, trackedRegistry(), session)).toEqual(
      { kind: "new-version", workbookId: "wb-1" },
    );
  });

  it("asks for a combine when the scenario of the marker advanced", () => {
    const session = openSession("v2", "m2", [meta("m1", "Marie")]);
    const decision = decideReturn({ versionId: "m1", scenario: "Marie" }, trackedRegistry(), session);
    expect(decision).toEqual({
      kind: "combine-needed",
      workbookId: "wb-1",
      baseVersionId: "m1",
      scenario: "Marie",
    });
  });

  it("falls back to unknown when the file carries no marker", () => {
    const decision = decideReturn(null, trackedRegistry(), openSession("v2", "m1"));
    expect(decision).toEqual({ kind: "unknown" });
  });
});

describe("decideReturn — when nothing matches", () => {
  it("falls back to unknown when the version belongs to no open workbook", () => {
    const decision = decideReturn({ versionId: "elsewhere" }, trackedRegistry(), openSession("v2", "m1"));
    expect(decision).toEqual({ kind: "unknown" });
  });

  it("falls back to unknown when the tracked workbook disappeared", () => {
    const empty = createRegistry(fakeHost());
    const decision = decideReturn({ versionId: "v2" }, empty, openSession("v2", "m1"));
    expect(decision).toEqual({ kind: "unknown" });
  });

  it("falls back to unknown when no workbook is open", () => {
    const decision = decideReturn({ versionId: "v2" }, trackedRegistry(), EMPTY_SESSION);
    expect(decision).toEqual({ kind: "unknown" });
  });

  it("offers a combine when the scenario of the marker is gone", () => {
    const session = openSession("v2", "m1");
    const decision = decideReturn({ versionId: "v1", scenario: "Paul" }, trackedRegistry(), session);
    expect(decision).toEqual({
      kind: "combine-needed",
      workbookId: "wb-1",
      baseVersionId: "v1",
      scenario: "Paul",
    });
  });
});

describe("describeReturn — the sentence shown to the user", () => {
  const keys: string[] = [];
  const spy: Translate = (key) => {
    keys.push(key);
    return key;
  };

  it("takes every word from the dictionary, one key per decision", () => {
    expect(describeReturn({ kind: "new-version", workbookId: "wb-1" }, spy)).toBe(
      "origin.return.new-version",
    );
    expect(
      describeReturn(
        { kind: "combine-needed", workbookId: "wb-1", baseVersionId: "v1" },
        spy,
      ),
    ).toBe("origin.return.combine-needed");
    expect(describeReturn({ kind: "unknown" }, spy)).toBe("origin.return.unknown");
    expect(keys).toEqual([
      "origin.return.new-version",
      "origin.return.combine-needed",
      "origin.return.unknown",
    ]);
  });

  it("is translated in both languages", () => {
    const decision = { kind: "combine-needed", workbookId: "wb-1", baseVersionId: "v1" } as const;
    const english = describeReturn(decision, (key) => translateCommon("en", key));
    const french = describeReturn(decision, (key) => translateCommon("fr", key));
    expect(english).toContain("combine is needed");
    expect(french).toContain("réunion est nécessaire");
    expect(english).not.toEqual(french);
  });
});
