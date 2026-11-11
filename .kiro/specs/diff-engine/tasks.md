# Tasks: diff-engine

- [ ] 1. Define `ChangeSet`, `SheetDiff`, `SheetAlignment`, `CellChange`, `RowChange`, `ColumnChange`, `SheetChange`, `PartChange`, `ChangeSummary`, and `ChangeNature` types in `packages/contracts/src/diff.ts`.
- [ ] 2. Implement sheet matching (sheetId first, then name, rename detection with content-overlap heuristic) in `packages/diff/src/sheet-match.ts`.
- [ ] 3. Implement row signature builder (inputs + kind + fmt only, `cached` excluded, FNV-1a hashing) in `packages/diff/src/row-signature.ts`.
- [ ] 4. Implement LCS alignment (two-row DP with `4e8` cap and unique-signature anchor fallback) producing anchors, `rowMap`, `insertedRows`, `deletedRows` in `packages/diff/src/lcs-align.ts`.
- [ ] 5. Implement half-overlap modified-row pairing between anchors (deterministic greedy, ≥ 50% shared cells, `structuralDivergence` flag) in `packages/diff/src/row-pairing.ts`.
- [ ] 6. Implement feature-flagged column alignment (signatures restricted to paired rows, same LCS + half-overlap method, `colMap`) in `packages/diff/src/col-align.ts`.
- [ ] 7. Implement cell comparison on the aligned grid with the three natures (`input`, `consequence`, `format`), cell add/remove, and R1C1 formula-shift invariance in `packages/diff/src/cell-compare.ts`.
- [ ] 8. Implement non-cell part fingerprint comparison (`partChanged` / `partIdentical`, sorted by path) in `packages/diff/src/part-compare.ts`.
- [ ] 9. Implement `diffWorkbooks` orchestrator with deterministic ordering and `ChangeSummary` counters in `packages/diff/src/diff.ts`.
- [ ] 10. Write unit tests: rename detection, half-overlap accept/reject at the 50% boundary, natures classification, formula shift invariance, deterministic ordering, fingerprint-only part reporting in `packages/diff/test/diff.test.ts`.
- [ ] 11. Write synthetic workbook + edit-sequence `fast-check` generators in `packages/diff/test/generators.ts` (shared with merge tests).
- [ ] 12. Write property test `SUT-P-04` (`diffWorkbooks(W, W) == emptyChangeSet`) in `packages/diff/test/diff.prop.test.ts`.
- [ ] 13. Write property test `SUT-P-05` (inserting `k` rows yields exactly `k` `rowInserted` and zero modified inputs) in `packages/diff/test/diff.prop.test.ts`.
- [ ] 14. Benchmark 200,000-cell comparison (< 3 s target, SUT-N-03) in `packages/diff/test/bench.test.ts` (skipped in PR CI, run on main workflow).
- [ ] 15. Verify line limits (< 500 lines/file, < 50 lines/function) and record seeds + any counterexamples in `KIRO_JOURNAL.md`.
