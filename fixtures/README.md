# Fixtures — synthetic workbooks

Every `.xlsx` in `generated/` is produced by the fixture builder from the
descriptor that sits next to it in `descriptors/`. **Never edit a workbook by
hand**: change the descriptor and rebuild.

```bash
node tools/fixture-builder/build.mjs fixtures/descriptors/budget-2026-original.json fixtures/generated/budget-2026.xlsx
node tools/fixture-builder/build-all.mjs   # rebuilds the whole corpus
```

The build is deterministic: two builds of the same descriptor give the very
same bytes, so a rebuild never shows up as a change in the history.

## The demo trio

The scenario of the demo (Nadia, the volunteer treasurer):

| File | What it contains |
|---|---|
| `budget-2026.xlsx` | The reference workbook sent on Monday. |
| `budget-2026-paul.xlsx` | Paul corrected three amounts (Énergie, Fournitures, Salaires) and added a `Transport` row. |
| `budget-2026-v2-marie-FINAL.xlsx` | Marie changed one hypothesis (Croissance 3 % → 5 %) and corrected `Salaires` differently from Paul. |

`Salaires` is the cell where the two sides disagree: 60 000 in the reference,
61 000 for Paul, 62 000 for Marie. It is the single disagreement of the demo.

## The edge-case corpus

| Fixture | What it exercises |
|---|---|
| `shared-strings.xlsx` | Texts stored in the shared string table, with repeats and special characters. |
| `inline-strings.xlsx` | The same texts written inline (`t="inlineStr"`), the flavour a patch produces. |
| `shared-formulas.xlsx` | A shared formula: one master with a `ref` range, followers with only a `si`. |
| `dates-formats.xlsx` | Dates stored as serial numbers with date number formats, plus percentage, currency and thousands formats. |
| `booleans-errors.xlsx` | Booleans (`t="b"`) and error values (`t="e"`: `#DIV/0!`, `#REF!`, `#VALUE!`, `#N/A`, `#NAME?`). |
| `hidden-sheet.xlsx` | A workbook whose second sheet is hidden. |
| `chart-part.xlsx` | A chart part with its drawing, to check that non-cell content travels as-is. |
| `macro-xlsm.xlsm` | A macro-enabled workbook carrying `xl/vbaProject.bin` (carried, never interpreted). |
| `empty.xlsx` | A workbook with an empty sheet. |
