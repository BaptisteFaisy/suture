# Tasks: Git Store (Quick Spec)

- [ ] 1. Scaffold `packages/git-store` and add the `contracts` types (`TrackedWorkbook`, `VersionRef`, `ScenarioRef`, `MilestoneRef`, `CellHistoryEntry`, `SaveVersionInput`) — 45 min
- [ ] 2. Implement the filesystem adapter: lightning-fs/IndexedDB for the browser, in-memory adapter for tests, injected via `createStore({ fs, dir })` — 1 h
- [ ] 3. Implement `initWorkbook`: init repo, write `ooxml/` + `cells/` + `.suture/format.json`, first commit on `reference` — 45 min
- [ ] 4. Implement `saveVersion` with canonical freshness assertion and tree-equality short-circuit returning `'unchanged'` (SUT-F-03) — 1 h
- [ ] 5. Implement `readVersion` (tree → part map + cells view) with blob caching by oid — 45 min
- [ ] 6. Implement `createScenario` (branch at oid, slug naming, clash error) and verify the Reference head never moves — 45 min
- [ ] 7. Implement `tagMilestone` (annotated tag) and `listVersions` (branch or all) — 45 min
- [ ] 8. Implement `combineCommit` with two parents and report appended to the version note (SUT-F-23) — 45 min
- [ ] 9. Implement `restore`: read oid, commit identical content on the active branch, assert no ref/commit removed (SUT-F-27) — 45 min
- [ ] 10. Implement `cellHistory`: walk the branch log, diff consecutive `cells/<sheet>.tsv` for one `ref`, return author/date/note/before/after — 1 h
- [ ] 11. Implement `exportBundle`: walk objects and refs, emit a clonable bare repo ZIP; test that `HEAD`, `refs/heads/*` and objects are present — 1 h
- [ ] 12. Implement storage persistence request, quota warning (> 80 %) and 30-day export reminder (SUT-N-05) — 45 min
- [ ] 13. Unit tests: save/unchanged, scenario isolation, milestone, restore, combine parents, cell history over three versions — 1 h
- [ ] 14. Property test SUT-P-12 (fast-check): random save/scenario/restore sequences; every oid restorable byte-identical, no ref or commit removed — 1 h
- [ ] 15. Integration test: export bundle cloned and inspected with `git log -p -- cells/` in a container (skip when git is unavailable) — 45 min
- [ ] 16. Error-path tests: quota exceeded, scenario exists, unknown version, stale canonical view — 30 min
- [ ] 17. Review: files < 500 lines, functions < 50 lines, no duplicated FS helpers, full suite < 30 s — 30 min
