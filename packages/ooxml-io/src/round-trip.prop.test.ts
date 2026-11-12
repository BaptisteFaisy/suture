/**
 * Property SUT-P-01 — `unzip(zip(parts)) == parts`, byte for byte.
 *
 * Generated part names are unique and the bytes are arbitrary (null bytes,
 * non-UTF-8 sequences). The archive always carries a workbook part, since a
 * spreadsheet without one is refused before the round-trip.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { OoxmlPart } from "@suture/contracts";
import { readWorkbook } from "./unzip";
import { zipParts } from "./zip";

/** Characters used to build part paths. */
const PATH_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-";

/** Characters allowed as the first character of a path segment. */
const FIRST_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Arbitrary bytes, including null bytes and non-UTF-8 sequences. */
const arbBytes = fc.uint8Array({ maxLength: 512 });

/** One path segment: never starts with a dot, never ends with a slash. */
const arbSegment = fc
  .tuple(
    fc.constantFrom(...FIRST_CHARS.split("")),
    fc.array(fc.constantFrom(...PATH_CHARS.split("")), { maxLength: 20 }),
  )
  .map(([first, rest]) => first + rest.join(""));

/** A path of one to three segments, separated by slashes. */
const arbPath = fc
  .array(arbSegment, { minLength: 1, maxLength: 3 })
  .map((segments) => segments.join("/"));

/** A set of unique part paths, excluding the workbook part itself. */
const arbPaths = fc.uniqueArray(arbPath, { minLength: 1, maxLength: 12 }).map((paths) =>
  paths.filter((path) => path !== "xl/workbook.xml"),
);

/** A list of unique parts, plus the mandatory workbook part. */
const arbParts: fc.Arbitrary<OoxmlPart[]> = arbPaths.chain((paths) =>
  fc
    .tuple(...paths.map(() => arbBytes))
    .map((payloads) => [
      { path: "xl/workbook.xml", data: new TextEncoder().encode("<workbook/>") },
      ...paths.map((path, index) => ({ path, data: payloads[index] ?? new Uint8Array(0) })),
    ]),
);

/** Sort parts the way the reader does: ascending path. */
function sorted(parts: OoxmlPart[]): OoxmlPart[] {
  return [...parts].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

describe("property SUT-P-01 — round-trip fidelity", () => {
  it("unzip(zip(parts)) gives back the same parts, byte for byte", () => {
    fc.assert(
      fc.property(arbParts, (parts) => {
        const expected = sorted(parts);
        const result = readWorkbook(zipParts(parts));
        expect(result.parts.map((part) => part.path)).toEqual(expected.map((part) => part.path));
        for (const [index, part] of result.parts.entries()) {
          expect(Array.from(part.data)).toEqual(Array.from(expected[index]?.data ?? []));
        }
      }),
      { numRuns: 200 },
    );
  });

  it("the same parts always give the same archive bytes", () => {
    fc.assert(
      fc.property(arbParts, (parts) => {
        const first = zipParts(parts);
        const second = zipParts(parts);
        expect(Array.from(first)).toEqual(Array.from(second));
      }),
      { numRuns: 100 },
    );
  });
});
