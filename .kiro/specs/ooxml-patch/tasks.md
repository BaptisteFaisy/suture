# Tasks: OOXML Patch

- [x] 1. Scaffold already in place (`packages/ooxml-patch`); the frozen contracts of `@suture/contracts` (`patch.ts`, `merge.ts`) are used as they are — no contract change needed.
- [x] 2. Done in `src/xml.ts`: home-grown scanner, no external entity resolution by construction (no parser dependency at all). A `DOCTYPE` is treated as ordinary text and never resolved.
- [x] 3. Done in `src/cell-xml.ts` + `src/patch.test.ts`.
- [x] 4. Done in `src/cell-xml.ts` + `src/patch.test.ts` (`&`, `<`; newline and tab are preserved by `xml:space="preserve"`).
- [x] 5. Done in `src/cell-xml.ts` + `src/patch.test.ts`.
- [x] 6. Done in `src/refs.ts` and `src/sheet-writer.ts`: ascending column and row order, `spans` recomputed on the touched rows.
- [x] 7. Done in `src/sheet-writer.ts`; the style-only cell and the empty row are covered by `src/worksheet-shapes.test.ts`.
- [x] 8. Done in `src/calc-chain.ts` + `src/patch.test.ts`; idempotent when absent.
- [x] 9. Done in `src/calc-chain.ts` + `src/workbook-calcpr.test.ts`.
- [x] 10. Done in `src/custom-props.ts` + `src/patch.test.ts`.
- [x] 11. Done in `src/origin-marker.ts` + `src/origin-marker.test.ts`.
- [x] 12. Done in `src/index.ts`; the typed `PatchError` codes are in `src/errors.ts`.
- [x] 13. Done in `src/patch.property.test.ts`; the seed is in `packages/ooxml-patch/PROPERTIES.md`.
- [x] 14. Done in `src/patch.property.test.ts`: the reader of this package re-reads the patched sheet (no dependency on `@suture/canonical`, which is not implemented yet).
- [x] 15. Done in `src/patch.test.ts`: `xl/vbaProject.bin` and the macro-enabled content type stay identical. The refusal of an encrypted/OLE2 carrier belongs to `@suture/ooxml-io` (not implemented yet).
- [x] 16. The hook `.kiro/hooks/fidelity-check.json` already runs `pnpm vitest run packages/ooxml-patch`; the suite stays under 2 s, CI under 5 min.
- [x] 17. Done in `src/smoke.test.ts`: a patched workbook is opened by a headless office suite (skipped when `soffice` is missing).
- [x] 18. Done: every file is under 500 lines, every function under 50 lines (`eslint`), the whole suite is green.
