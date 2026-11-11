# Properties — `@suture/canonical`

Property-based tests of this package, with the seeds used and any counterexample
found during development.

## Seeds

| Property | File | Seed | Runs |
|---|---|---|---|
| SUT-P-02 (archive order invariance) | `test/canonical.prop.test.ts` | `20261111` | 100 |

## SUT-P-02 — determinism and archive order invariance

> `deriveCanonical(parts)` is strictly deterministic and invariant to the order
> of the entries in the archive: permuting the `OoxmlParts` array yields
> byte-identical `_workbook.json` and `cells/*.tsv`.

| Property | Counterexample | Correction | Seed |
|---|---|---|---|
| **SUT-P-02** (archive order invariance) | None found across 100 random multi-sheet workbooks with shared strings, defined names and permuted parts. | — | `20261111` |
