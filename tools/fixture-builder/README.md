# Fixture builder

Builds synthetic `.xlsx` / `.xlsm` workbooks from a JSON descriptor. The
procedure it follows is written down in `.kiro/skills/suture-fixture/SKILL.md`.

```bash
node tools/fixture-builder/build.mjs fixtures/descriptors/<name>.json fixtures/generated/<name>.xlsx
node tools/fixture-builder/build-all.mjs
```

## The descriptor

```json
{
  "name": "Budget 2026",
  "output": "budget-2026.xlsx",
  "options": { "sharedStrings": true },
  "sheets": [
    {
      "name": "Budget",
      "cells": [
        { "ref": "A1", "value": "Poste" },
        { "ref": "B2", "value": 13500, "format": "#,##0 €" },
        { "ref": "B6", "formula": "SUM(B2:B5)", "cached": 76500 }
      ]
    }
  ]
}
```

A cell carries a `value` (text, number, boolean), a `formula` (with an
optional `cached` result), an `error` (`#DIV/0!` and friends), or nothing at
all with `styleOnly: true` (a styled but empty cell). A `format` gives the
cell its number format.

### Options

| Option | Effect |
|---|---|
| `sharedStrings` | Texts go to the shared string table (`t="s"`). When off, they are written inline (`t="inlineStr"`). |
| `sharedFormulas` | Allows the `shared` marker of a cell (master with a `ref` range, followers with only a `si`). |
| `hiddenSheet` | Hides the last sheet of the workbook. A sheet may also state `hidden` explicitly. |
| `chart` | Adds a chart part and its drawing to the first sheet. |
| `macro` | Produces a `.xlsm` carrying `xl/vbaProject.bin` (never interpreted). |

## Determinism

Two builds of the same descriptor produce the same bytes:

- the ZIP entries carry a fixed modification date, never the build clock;
- the time zone is forced to UTC, so the date does not shift with the machine;
- the parts are written in a fixed order and the XML has no variable content.

`packages/contracts/src/fixtures.test.ts` rebuilds the whole corpus and
compares the bytes with the committed files.

## Layout

| File | Role |
|---|---|
| `build.mjs` | Command line: descriptor → workbook. |
| `build-all.mjs` | Rebuilds every descriptor of `fixtures/descriptors`. |
| `lib/descriptor.mjs` | Parses and validates the descriptor. |
| `lib/styles.mjs` | Number formats and cell formats (`xl/styles.xml`). |
| `lib/sheet.mjs` | The grid (`xl/worksheets/sheetN.xml`). |
| `lib/package.mjs` | The OPC parts of the workbook. |
| `lib/xml.mjs` | XML escaping and reference helpers. |
| `lib/zip.mjs` | The deterministic ZIP step (`fflate`). |
