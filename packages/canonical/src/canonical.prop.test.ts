/**
 * SUT-P-02 — deterministic derivation, invariant to the order of the archive.
 *
 * Permuting the `OoxmlParts` array must yield a byte-identical
 * `_workbook.json` and identical `cells/*.tsv`, sheet by sheet.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveCanonical, serializeCellsTsv, serializeWorkbookJson } from "./index";
import { buildWorkbookParts, text } from "../test/generators";

/** Seed recorded in `packages/canonical/PROPERTIES.md`. */
const SEED = 20261111;

/** Fisher-Yates shuffle driven by an explicit generator. */
function shuffle<T>(array: readonly T[], rng: () => number): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j]!;
    copy[j] = tmp!;
  }
  return copy;
}

/** Deterministic PRNG (LCG) so a permutation is reproducible from its seed. */
function makeRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

/** `docProps/custom.xml`, with or without Suture's origin marker. */
function customProperties(stamped: boolean): string {
  const marker = stamped
    ? '<property pid="2" fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" name="SutureSourceVersion">v-42</property>' +
      '<property pid="3" fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" name="SutureScenario">baseline</property>'
    : "";
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties">' +
    marker +
    '<property pid="9" fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" name="Client">Acme</property>' +
    "</Properties>"
  );
}

/** Sheet generator: unique ids, random visibility, a few cell shapes. */
function sheetArbitrary(index: number) {
  return fc.record({
    name: fc.stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,8}$/).map((name) => `${name}${index}`),
    sheetId: fc.integer({ min: 1, max: 999 }).map((id) => id + index * 1000),
    state: fc.constantFrom("visible" as const, "hidden" as const),
    rows: fc.constant(
      '<row r="1"><c r="A1"><v>100</v></c><c r="B1" t="s"><v>0</v></c><c r="C1" s="1"/></row>' +
        '<row r="2"><c r="A2" s="0"><v>200.50</v></c><c r="B2" t="b"><v>1</v></c></row>' +
        '<row r="10"><c r="AA10" t="s"><v>1</v></c><c r="B10"><f>SUM(B2:B2)</f><v>1</v></c></row>',
    ),
  });
}

describe("SUT-P-02 — determinism and archive order invariance", () => {
  it("derives the same workbook whatever the order of the parts", () => {
    const workbookArbitrary = fc
      .tuple(fc.integer({ min: 1, max: 3 }), fc.boolean(), fc.array(fc.stringMatching(/^[A-Z]{2,6}$/), { maxLength: 3 }))
      .chain(([count, stamped, names]) =>
        fc.tuple(
          fc.tuple(...Array.from({ length: count }, (_unused, index) => sheetArbitrary(index))),
          fc.constant(stamped),
          fc.constant(names),
        ),
      )
      .map(([sheets, stamped, names]) => ({
        sheets: [...sheets],
        sharedStrings: [{ text: "Alpha" }, { runs: ["Be", "ta"] }],
        definedNames: names,
        numberFormats: { "165": "#,##0.00 €" },
        cellFormats: [0, 165],
        extraParts: [{ path: "docProps/custom.xml", data: text(customProperties(stamped)) }],
      }));

    fc.assert(
      fc.property(workbookArbitrary, fc.integer(), (fixture, shuffleSeed) => {
        const parts = buildWorkbookParts(fixture);
        const permuted = shuffle(parts, makeRng(shuffleSeed));

        const canonicalA = deriveCanonical(parts);
        const canonicalB = deriveCanonical(permuted);

        expect(canonicalB).toEqual(canonicalA);
        expect(serializeWorkbookJson(canonicalB.meta)).toBe(serializeWorkbookJson(canonicalA.meta));
        expect(canonicalB.sheets.length).toBe(canonicalA.sheets.length);
        canonicalA.sheets.forEach((sheet, index) => {
          expect(serializeCellsTsv(canonicalB.sheets[index]!)).toBe(serializeCellsTsv(sheet));
        });
      }),
      { numRuns: 100, seed: SEED },
    );
  });
});
