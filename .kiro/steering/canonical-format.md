# Suture — Canonical Format Specification

_Included conditionally on `packages/canonical/**` and `packages/diff/**`._

## Directory layout inside a Git commit tree

Each version committed by Suture contains two parallel views of the same workbook:

```
ooxml/                  # Uncompressed OOXML parts, byte-for-byte fidelity
  [Content_Types].xml
  _rels/.rels
  xl/
    workbook.xml
    worksheets/
      sheet1.xml
      sheet2.xml
    sharedStrings.xml
    styles.xml
cells/                  # Canonical human- and git-readable view
  _workbook.json        # Sheets metadata (id, name, order, visibility), defined names
  01-budget.tsv         # Exactly one line per non-empty cell
  02-hypotheses.tsv
.suture/
  format.json           # {"version": 1}
```

- `ooxml/` is the source of truth for reproduction: downloading a version simply
  zips these parts back together.
- `cells/` is **derived deterministically** from `ooxml/`. It is what diff, merge
  and `git log -p` inspect.

## Format of a `cells/*.tsv` file

Tab-separated, 5 columns, UTF-8. Lines sorted by row index (numeric) then
column index (numeric):

```
ref\tkind\tinput\tcached\tfmt\n
```

| Column | Meaning | Possible values | Example |
|---|---|---|---|
| `ref` | Cell address | `A1`, `B14`, `AA3` | `B14` |
| `kind` | Data kind | `s` string, `n` number, `b` boolean, `e` error, `f` formula | `f` |
| `input` | Raw typed input | Value as typed, or formula in R1C1 notation | `=SUM(R[-12]C:R[-1]C)` |
| `cached` | Last calculated value (for formulas only; empty otherwise) | String representation of cached value | `131500` |
| `fmt` | Number format code | Omitted if General; format string otherwise | `#,##0 €` |

Special characters (`\t`, `\n`, `\\`) in string values are escaped as `\t`, `\n`, `\\`.
Cells that only have styling but no value are omitted.
Shared strings are fully dereferenced (rich text flattened to plain text).
Shared formulas are expanded into individual cells.
Suture's own custom document properties (origin marker) are stripped before derivation.
