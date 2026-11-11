/**
 * SUT-P-02 — Deterministic derivation & ZIP entry order invariance.
 *
 * For any workbook fixture and any permutation of its OOXML parts,
 * `deriveCanonical(parts)` yields byte-identical output across:
 * - `_workbook.json`
 * - each sheet's `cells/*.tsv`
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveCanonical, serializeCellsTsv, serializeWorkbookJson } from "../src/index";
import { buildWorkbookParts } from "./generators";
import { createTestFormulaCodec } from "./test-codec";

const codec = createTestFormulaCodec();
const DEFAULT_SEED = 20261111;

/** Fisher-Yates in-place shuffle clone. */
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

/** Deterministic PRNG for shuffling part order. */
function makeRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

describe("SUT-P-02: archive order invariance & determinism", () => {
  it("derives identical canonical views regardless of part permutation (100 runs)", () => {
    const sheetArbitrary = fc.record({
      name: fc.stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,8}$/),
      sheetId: fc.integer({ min: 1, max: 20 }),
      state: fc.constantFrom<"visible" | "hidden">("visible", "hidden"),
      rows: fc.constant(
        '<row r="1"><c r="A1"><v>100</v></c><c r="B1" t="s"><v>0</v></c></row>' +
          '<row r="2"><c r="A2" s="0"><v>200</v></c><c r="B2" t="b"><v>1</v></c></row>',
      ),
    });

    const workbookArbitrary = fc.record({
      sheets: fc.array(sheetArbitrary, { minLength: 1, maxLength: 3 }),
      sharedStrings: fc.constant([{ text: "Alpha" }, { text: "Beta" }]),
      definedNames: fc.array(fc.stringMatching(/^[A-Z][A-Z0-9]{1,6}$/), { maxLength: 3 }),
    });

    fc.assert(
      fc.property(workbookArbitrary, fc.integer(), (fixture, shuffleSeed) => {
        const uniqueSheets = fixture.sheets.map((sheet, index) => ({
          ...sheet,
          sheetId: sheet.sheetId + index * 20,
        }));
        const parts = buildWorkbookParts({ ...fixture, sheets: uniqueSheets });
        const permuted = shuffle(parts, makeRng(shuffleSeed));
        const canonicalA = deriveCanonical(parts, { codec });
        const canonicalB = deriveCanonical(permuted, { codec });

        expect(serializeWorkbookJson(canonicalA.meta)).toBe(serializeWorkbookJson(canonicalB.meta));
        expect(canonicalA.sheets.length).toBe(canonicalB.sheets.length);
        for (let i = 0; i < canonicalA.sheets.length; i += 1) {
          expect(serializeCellsTsv(canonicalA.sheets[i]!)).toBe(
            serializeCellsTsv(canonicalB.sheets[i]!),
          );
        }
      }),
      { numRuns: 100, seed: DEFAULT_SEED },
    );
  });
});
