# Tasks: merge-engine

- [ ] 1. Define `MergePlan`, `SheetPlan`, `CellWrite`, `Disagreement`, `DisagreementResolution`, `ReportEntry`, `MergeResult`, `CombineReport`, `StructuralCase`, and `MergeError` in `packages/contracts/src/merge.ts`.
- [ ] 2. Implement structural classification per sheet (Cases 1–4) from both `SheetAlignment`s, including normalized structural signatures and `structuralDivergence` handling in `packages/merge/src/structural-case.ts`.
- [ ] 3. Implement carrier selection (Case 1/3 -> A, Case 2 -> restructuring side, Case 4 -> user choice) in `packages/merge/src/carrier.ts`.
- [ ] 4. Implement the per-cell three-way rule (identical, single-side, disagreement, add/remove) with R1C1-normalized comparison tuples in `packages/merge/src/cell-rule.ts`.
- [ ] 5. Implement formula transfer for non-carrier writes via `remapAndToA1` (relative re-anchor at target, absolute remap through alignment, span check -> `toVerify`) in `packages/merge/src/formula-transfer.ts`.
- [ ] 6. Implement sheet-level operations (add/remove/rename carry, conflict -> `SheetDisagreement`) in `packages/merge/src/sheet-ops.ts`.
- [ ] 7. Implement non-cell part handling (carrier wins, other side -> `notCarried` with plain sentence) in `packages/merge/src/part-handling.ts`.
- [ ] 8. Implement `buildMergePlan(O, A, B)` orchestrator with deterministic ordering in `packages/merge/src/build-plan.ts`.
- [ ] 9. Implement `applyMergePlan(plan, resolutions)` (unresolved -> `UNRESOLVED_DISAGREEMENT`, resolved cells materialized, report partitioned) in `packages/merge/src/apply-plan.ts`.
- [ ] 10. Implement the no-silent-loss audit (`ΔA ∪ ΔB` vs `applied ∪ decided ∪ notCarried ∪ toVerify`, residue -> `SILENT_LOSS`) in `packages/merge/src/audit.ts`.
- [ ] 11. Implement two-way degraded mode (no origin: every difference is a disagreement) in `packages/merge/src/two-way.ts`.
- [ ] 12. Write unit tests for the four structural cases, disagreement resolution (A/B/custom), formula transfer with inserted rows, report partitioning, and degraded mode in `packages/merge/test/merge.test.ts`.
- [ ] 13. Write property test `SUT-P-06` (identity laws `combine(O,A,O)=A`, `combine(O,O,B)=B`, `combine(O,X,X)=X`) in `packages/merge/test/merge.prop.test.ts`.
- [ ] 14. Write property test `SUT-P-07` (disjoint edits, unchanged structure -> zero disagreements) in `packages/merge/test/merge.prop.test.ts`.
- [ ] 15. Write property test `SUT-P-08` (no silent loss audit over generated workbooks and a resolving decision strategy) in `packages/merge/test/merge.prop.test.ts`.
- [ ] 16. Write property test `SUT-P-09` (symmetry of `combine(O,A,B)` and `combine(O,B,A)` up to swapped sides) in `packages/merge/test/merge.prop.test.ts`.
- [ ] 17. Wire the `merge-properties` Kiro hook (run SUT-P-04..09 on save in `packages/diff/**` and `packages/merge/**`) and confirm it passes.
- [ ] 18. Verify line limits (< 500 lines/file, < 50 lines/function) and record seeds plus counterexamples in `KIRO_JOURNAL.md`.
