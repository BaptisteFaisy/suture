# Tasks: formula-r1c1

- [ ] 1. Define `CellPos`, `FormulaToken`, `FormulaConversionResult`, `IndexMap`, and `EXCEL_BOUNDS` in `packages/contracts/src/formula.ts`.
- [ ] 2. Implement column letter/index primitives (`lettersToCol`, `colToLetters`, `parseA1Ref`, `formatA1Ref`) with Excel bounds checks in `packages/formula/src/cell-ref.ts`.
- [ ] 3. Implement single-pass lexical `tokenizeFormula` handling string literals, quoted sheet names, external refs, structured table refs, function calls, A1/R1C1 refs, and whole-axis ranges in `packages/formula/src/tokenizer.ts`.
- [ ] 4. Implement `a1ToR1c1` converter handling relative, absolute, mixed, range, axis, and cross-sheet references while leaving non-coordinate tokens verbatim in `packages/formula/src/a1-to-r1c1.ts`.
- [ ] 5. Implement `r1c1ToA1` converter with Excel bounds validation and safe fallback (`needsCheck: true`) in `packages/formula/src/r1c1-to-a1.ts`.
- [ ] 6. Implement `remapAndToA1` for combine carrier formula placement (relative around target position, absolute via alignment `IndexMap`, inserted-span verification flagging) in `packages/formula/src/remap.ts`.
- [ ] 7. Write unit tests covering edge coordinates (`A1`, `XFD1048576`), quoted strings/sheets, `LOG10`/`ATAN2`, structured refs, external refs, out-of-bounds fallback, and range-span detection in `packages/formula/test/formula.test.ts`.
- [ ] 8. Write `fast-check` generator for synthetic Excel formulas and property test `SUT-P-03` (`r1c1ToA1(a1ToR1c1(f, pos), pos) == f`) in `packages/formula/test/formula.prop.test.ts`.
- [ ] 9. Verify line limits (< 500 lines/file, < 50 lines/function) and record `formula-r1c1` spec-vs-vibe findings and `fast-check` seeds in `KIRO_JOURNAL.md`.
