# PROPERTIES — `@suture/diff`

Record of the properties verified with fast-check, and of every counterexample
they found (the seeds are what the submission form asks for).

| Property | Statement | Runs | Status |
|---|---|---|---|
| **SUT-P-04** | Comparing a workbook to itself yields an empty change set: no modified input, no consequence, no format, no row or column movement. | 200 | Verified |
| **SUT-P-05** | Inserting `k` rows into a sheet yields exactly `k` inserted rows, **zero** modified inputs and zero deleted rows. | 200 | Verified |
| Summary coherence | `summary.inputsModified` always equals the number of `input` changes listed in the sheets. | 100 | Verified |

## Counterexamples found and fixed

1. **Row signature included the cell address.** The first implementation signed a
   row with `ref:kind:input`, so shifting a row down (which is exactly what an
   insertion does) changed every signature below it: the alignment reported a
   deletion plus an insertion per row instead of a single insertion, and the
   shifted cells appeared as modified inputs.
   **Fix:** the signature is keyed by the **cross index** (the column, for a
   row) and never by the address — `lineSignature(cells, columnOf)`. Property
   SUT-P-05 went from 0/100 to 200/200.
2. **Cells were compared by address across the whole sheet.** With a row
   inserted, every cell below it looked "deleted here, added there".
   **Fix:** cell comparison is driven by the row alignment: only rows matched as
   `same` or `modified` are compared, and their cells are matched by column.
   Inserted and deleted rows are reported as row changes only.
3. **An external-workbook pattern swallowed R1C1 offsets** (`[-12]` looked like
   a bracketed reference). Found while sharing the protection code with
   `@suture/formula`; the pattern now requires a file name with an extension.
