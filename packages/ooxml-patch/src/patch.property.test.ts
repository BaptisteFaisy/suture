import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { OoxmlParts, PatchRequest } from "@suture/contracts";
import { patchWorkbook } from "./index";
import { readSheetCells } from "./sheet-reader";
import { buildCarrier, carrierOptionsArb, patchArb } from "../test/generators";

/** Parts the patcher is allowed to rewrite. */
const ALLOWED = new Set([
  "xl/worksheets/sheet1.xml",
  "xl/workbook.xml",
  "[Content_Types].xml",
  "xl/_rels/workbook.xml.rels",
  "xl/calcChain.xml",
]);

const SEED = Number(process.env["SUTURE_FC_SEED"] ?? 20261111);

type Patch = PatchRequest["patches"][number];

function request(patches: Patch[]): PatchRequest {
  return { patches, sheetPaths: new Map([[1, "xl/worksheets/sheet1.xml"]]) };
}

/** The patcher refuses two patches for the same cell: the plan must be clean. */
function uniquePatches(patches: Patch[]): Patch[] {
  const seen = new Set<string>();
  const result: Patch[] = [];
  for (const patch of patches) {
    const key = `${patch.sheetId}:${patch.ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(patch);
  }
  return result;
}

describe("SUT-P-10 — untouched parts stay byte-for-byte identical", () => {
  it("holds for random cell patches over random carriers", () => {
    fc.assert(
      fc.property(carrierOptionsArb, fc.array(patchArb, { maxLength: 8 }), (options, patches) => {
        const parts: OoxmlParts = buildCarrier(options);
        const result = patchWorkbook(parts, request(uniquePatches(patches)));
        for (const part of parts) {
          if (ALLOWED.has(part.path)) continue;
          const after = result.parts.find((candidate) => candidate.path === part.path);
          expect(after).toBeDefined();
          expect(after?.data).toBe(part.data);
        }
      }),
      { numRuns: 200, seed: SEED, endOnFailure: true },
    );
  });
});

describe("SUT-P-11 — the patched cells read back exactly as requested", () => {
  it("holds for random cell patches", () => {
    fc.assert(
      fc.property(fc.array(patchArb, { maxLength: 8 }), (patches) => {
        const parts = buildCarrier({});
        const clean = uniquePatches(patches);
        const result = patchWorkbook(parts, request(clean));
        const cells = new Map(readSheetCells(sheetXml(result.parts)).map((cell) => [cell.ref, cell]));
        for (const patch of clean) {
          const cell = cells.get(patch.ref);
          if (patch.record === null) {
            expect(cell).toBeUndefined();
            continue;
          }
          expect(cell).toBeDefined();
          expect(cell?.kind).toBe(patch.record?.kind);
          expect(cell?.input).toBe(expectedInput(patch.record?.kind ?? "n", patch.record?.input ?? "", patch.ref));
        }
      }),
      { numRuns: 200, seed: SEED, endOnFailure: true },
    );
  });
});

describe("SUT-P-10 — the part list of the carrier never changes", () => {
  it("keeps the same part paths", () => {
    fc.assert(
      fc.property(carrierOptionsArb, fc.array(patchArb, { maxLength: 5 }), (options, patches) => {
        const parts = buildCarrier(options);
        const result = patchWorkbook(parts, request(uniquePatches(patches)));
        const before = parts.map((part) => part.path).sort();
        const after = result.parts.map((part) => part.path).sort();
        const removed = before.filter((path) => path !== "xl/calcChain.xml" && !after.includes(path));
        expect(removed).toEqual([]);
      }),
      { numRuns: 200, seed: SEED, endOnFailure: true },
    );
  });
});

describe("SUT-P-10 — the untouched parts keep the very same buffer", () => {
  it("hands back the same Uint8Array instance", () => {
    fc.assert(
      fc.property(carrierOptionsArb, fc.array(patchArb, { maxLength: 5 }), (options, patches) => {
        const parts = buildCarrier(options);
        const result = patchWorkbook(parts, request(uniquePatches(patches)));
        for (const part of parts) {
          if (ALLOWED.has(part.path)) continue;
          const after = result.parts.find((candidate) => candidate.path === part.path);
          expect(after?.data).toBe(part.data);
        }
      }),
      { numRuns: 200, seed: SEED, endOnFailure: true },
    );
  });
});

describe("SUT-P-10 — the marker only touches the marker parts", () => {
  it("leaves every other part identical when the origin marker is stamped", () => {
    const allowed = new Set([...ALLOWED, "docProps/custom.xml", "_rels/.rels"]);
    fc.assert(
      fc.property(carrierOptionsArb, fc.array(patchArb, { maxLength: 4 }), (options, patches) => {
        const parts = buildCarrier(options);
        const result = patchWorkbook(parts, {
          ...request(uniquePatches(patches)),
          originMarker: { versionId: "abc123", scenario: "reference" },
        });
        for (const part of parts) {
          if (allowed.has(part.path)) continue;
          const after = result.parts.find((candidate) => candidate.path === part.path);
          expect(after?.data).toBe(part.data);
        }
      }),
      { numRuns: 200, seed: SEED, endOnFailure: true },
    );
  });
});

function expectedInput(kind: string, input: string, ref: string): string {
  void ref;
  if (kind === "n") return String(Number(input));
  if (kind === "b") return ["true", "1", "vrai"].includes(input.trim().toLowerCase()) ? "true" : "false";
  if (kind === "f") return input.replace(/^=/, "");
  return input;
}

function sheetXml(parts: OoxmlParts): string {
  const part = parts.find((candidate) => candidate.path === "xl/worksheets/sheet1.xml");
  return new TextDecoder().decode(part?.data ?? new Uint8Array());
}
