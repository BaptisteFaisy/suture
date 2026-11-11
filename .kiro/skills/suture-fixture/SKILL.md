---
name: suture-fixture
description: Build a synthetic .xlsx fixture (and its variants) for tests and the demo set.
---

# Skill — build a synthetic workbook fixture

Use this procedure whenever a test or the demo set needs a `.xlsx` file.

## 1. Describe the workbook

Write a small JSON descriptor in `fixtures/descriptors/<name>.json`:

```json
{
  "sheets": [
    { "name": "Budget", "cells": [
      { "ref": "A1", "value": "Rent" },
      { "ref": "B1", "value": 13500, "format": "#,##0 €" },
      { "ref": "B14", "formula": "=SUM(B2:B13)" }
    ]}
  ]
}
```

## 2. Generate the archive

```bash
pnpm tsx tools/fixture-builder/build.ts fixtures/descriptors/<name>.json fixtures/<name>.xlsx
```

The builder writes minimal, deterministic OOXML parts (workbook.xml,
worksheets, styles, [Content_Types].xml, rels) and zips them with `fflate`.
It also accepts `variants` (same descriptor, edits applied) to produce the
demo trio: original, side A, side B.

## 3. Verify

- Read the file back with `@suture/ooxml-io` + `@suture/canonical` and assert
  the derived `cells/*.tsv` matches the descriptor.
- With the `exceljs` oracle (tests only), open the file and compare values.
- Byte determinism: two builds from the same descriptor must be identical.

## 4. Commit

Commit the descriptor and the produced `.xlsx` under `fixtures/`. Never edit a
binary fixture by hand — change the descriptor and rebuild.
