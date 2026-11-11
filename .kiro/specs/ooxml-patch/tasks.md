# Tasks: OOXML Patch

- [ ] 1. Scaffold `packages/ooxml-patch` (package.json, tsconfig, vitest config) and add `CellPatch`, `OriginMarker`, `PatchPlan`, `PatchResult`, `PatchWarning` types to `@suture/contracts` (frozen interfaces review) — 45 min
- [ ] 2. Implement `xml-scan.ts`: minimal saxes wrapper with external entities disabled, unit test that a DOCTYPE with ENTITY is rejected — 45 min
- [ ] 3. Implement `cell-xml.ts` serialization for kind `n` (shortest round-trip decimal, style attribute preserved) with golden XML tests — 45 min
- [ ] 4. Implement `cell-xml.ts` serialization for kind `s` (inline string, XML escaping, `xml:space="preserve"`, SST untouched) with tests including `<`, `&`, newline, tab — 45 min
- [ ] 5. Implement `cell-xml.ts` serialization for kinds `b`, `e` and `f` (formula without cached `<v>`, shared-formula attributes stripped) with tests — 45 min
- [ ] 6. Implement `row-index.ts`: A1 ref parsing, ascending column insertion inside a row, ascending row insertion in `<sheetData>`, `spans` dropped on touched rows — 1 h
- [ ] 7. Implement `sheet-writer.ts` orchestrating steps 3–6 over one worksheet part; test replacing an existing valued cell, a style-only cell, and inserting into an empty row — 1 h
- [ ] 8. Implement `calc-chain.ts`: delete `xl/calcChain.xml`, strip its Override in `[Content_Types].xml`, strip its Relationship in `xl/_rels/workbook.xml.rels`; idempotent when absent — 45 min
- [ ] 9. Implement `workbook-calcpr.ts`: set/replace `fullCalcOnLoad="1"` on existing `<calcPr>`, insert schema-valid `<calcPr>` when absent; tests for both paths — 45 min
- [ ] 10. Implement `custom-props.ts` write path: create or upsert `docProps/custom.xml` with `SutureSourceVersion` + `SutureScenario`, ensure root relationship and content-type override — 1 h
- [ ] 11. Implement `custom-props.ts` read path (`readOriginMarker`): return marker, or `null` when part/properties missing; test the missing-marker fallback contract — 45 min
- [ ] 12. Implement `patchWorkbook` orchestrator in `index.ts`: group cells by sheet, pass untouched parts by reference, typed `PatchError` on missing part / malformed XML / duplicate cell patch — 1 h
- [ ] 13. Property test SUT-P-10 (fast-check): random cell patches over fixture corpus (chart, pivot, `.xlsm` carriers), assert untouched parts hash-identical; log seed handling in `KIRO_JOURNAL.md` — 1 h
- [ ] 14. Property test SUT-P-11 (fast-check): re-derive canonical view of patched output, assert every patched cell reads back exact kind/input/fmt (formulas normalized A1↔R1C1) — 1 h
- [ ] 15. Regression tests from the fixture corpus: patched `.xlsm` keeps `vbaProject.bin` and macroEnabled content type byte-identical; encrypted/OLE2 carrier rejected upstream with clear error — 45 min
- [ ] 16. Wire the `fidelity-check` Kiro hook (runs SUT-P-10 on save under `packages/ooxml-patch/**`) and verify CI stays under 5 minutes — 30 min
- [ ] 17. Smoke test: open one patched fixture with a headless office suite on the runner when available, else `exceljs` oracle read (tests only, never shipped) — 45 min
- [ ] 18. Final review: `wc -l` all touched files (< 500), functions (< 50), no duplication with `ooxml-io` helpers, run full vitest suite — 30 min
