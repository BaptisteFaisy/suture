# Properties — `@suture/ooxml-patch`

Property-based tests of this package, with the seeds used to run them.
The rules come from `.kiro/steering/testing.md`: every property of the project
is automated with fast-check, seeds are printed on failure and recorded here.

## Seeds

| Property | File | Seed | Runs (CI) |
|---|---|---|---|
| SUT-P-10 (untouched parts) | `src/patch.property.test.ts` | `20261111` | 200 |
| SUT-P-11 (exact re-reading) | `src/patch.property.test.ts` | `20261111` | 200 |
| SUT-P-10 (part list) | `src/patch.property.test.ts` | `20261111` | 200 |
| SUT-P-10 (same buffer) | `src/patch.property.test.ts` | `20261111` | 200 |
| SUT-P-10 (marker parts) | `src/patch.property.test.ts` | `20261111` | 200 |

The seed is fixed so a failure is reproducible. Override it with the
environment variable `SUTURE_FC_SEED` (for example
`SUTURE_FC_SEED=42 pnpm vitest run packages/ooxml-patch`).

## SUT-P-10 — byte-for-byte invariance of the untouched parts

> After a patch, every OOXML part except the touched worksheets,
> `xl/workbook.xml`, the calculation chain and the marker parts is
> byte-for-byte identical to the carrier.

The property is checked over a corpus of synthetic carriers (plain workbook,
macro-enabled `.xlsm` with `xl/vbaProject.bin`, workbook with a chart and a
drawing, workbook with a calculation chain, workbook with custom properties)
and random cell patches (numbers, texts, booleans, errors, formulas,
deletions). Parts that are not allowed to change are compared **by identity**
of their `Uint8Array`: the patcher must hand back the very same buffer.

Parts allowed to change: the touched worksheets, `xl/workbook.xml`,
`[Content_Types].xml`, `xl/_rels/workbook.xml.rels`, `xl/calcChain.xml`
(removed), `docProps/custom.xml` and `_rels/.rels`.

## SUT-P-11 — exact re-reading of the patched cells

> Reading a patched file back gives exactly the cells that were asked for.

The patched worksheet is parsed again by the reader of this package and every
patched cell is compared with the request: same kind, same value, and the
cell is absent when the patch asked for a deletion.

## Smoke test

`src/smoke.test.ts` patches a workbook, re-zips it and opens it with a
headless office suite (`soffice`): the file must open without a repair
prompt and hold the written values. The test is skipped when `soffice`,
`unzip` or `zip` are missing.

## Counterexamples found

The counterexamples below were found while writing the properties and are now
covered by deterministic unit tests:

- a patch that deletes a cell in a row that does not exist yet used to create
  an empty `<row>`; it is now ignored (`src/patch.test.ts`);
- two patches for the same cell are refused with a typed error, so the
  properties generate unique cells only (`src/patch.test.ts`);
- the `<calcPr>` rewrite truncated the workbook XML after the element when it
  was not self-closing — found by the headless office smoke test, which then
  refused to open the file (`src/workbook-calcpr.test.ts`);
- a formula such as `SUM(A1:R5)` was mistaken for an R1C1 reference and
  rewritten; the detection now requires the column part (`src/refs.test.ts`);
- the `<dimension>` element was looked up under the wrong attribute name, so
  it never widened (`src/worksheet-shapes.test.ts`).
