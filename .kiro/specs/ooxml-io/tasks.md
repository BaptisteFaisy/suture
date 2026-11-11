# Tasks: ooxml-io (and canonical view derivation)

- [x] 1. Define `OoxmlArchive`, `OoxmlError`, `OOXML_LIMITS`, `CanonicalWorkbook`, `CanonicalSheet`, `CanonicalCell`, and `OriginMarker` types in `packages/contracts/src/ooxml.ts` and `canonical.ts`.
- [x] 2. Implement synthetic `.xlsx` fixture builder test helper in `packages/ooxml-io/test/helpers/xlsx-builder.ts` (≤ 150 lines) for unit and property generators.
- [x] 3. Implement `unzipWorkbook` with magic-byte checks (OLE2/PK), entry count guard, declared/actual 50 MB limit, and 100:1 compression ratio guard in `packages/ooxml-io/src/unzip.ts`.
- [x] 4. Implement deterministic `zipParts` (lexicographical entry sort, UTC epoch mtime) and archive OPC validation in `packages/ooxml-io/src/zip.ts` and `validate.ts`.
- [x] 5. Write property test `SUT-P-01` (`unzip(zip(parts)) == parts`) and limit/rejection unit tests (OLE2, encrypted, zip bomb, `.xlsb`) in `packages/ooxml-io/test/`.
- [ ] 6. Implement safe `saxes` streaming XML wrapper rejecting `<!ENTITY>` doctypes in `packages/ooxml-io/src/xml-stream.ts` + XXE unit test.
- [ ] 7. Implement `xl/sharedStrings.xml` parser (plain + rich text flattening) and `xl/styles.xml` built-in/custom number format resolver in `packages/canonical/src/shared-strings.ts` and `styles.ts`.
- [ ] 8. Implement `xl/workbook.xml` and `.rels` parser (stable `sheetId`, order, visibility, `definedNames`, deterministic TSV filename slugification) in `packages/canonical/src/workbook-meta.ts`.
- [ ] 9. Implement `docProps/custom.xml` origin-marker reader and stripper for Suture properties in `packages/canonical/src/origin-marker.ts`.
- [ ] 10. Implement streaming worksheet parser with shared-formula master/follower expansion, R1C1 conversion via `@suture/formula`, shortest number formatting, style-only cell omission, and 1,000,000-cell guard in `packages/canonical/src/worksheet-parser.ts`.
- [ ] 11. Implement deterministic TSV serializer/parser (`\`, `\t`, `\n`, `\r` escaping, row/col numeric sort) and SHA-256 non-cell part fingerprinter in `packages/canonical/src/tsv.ts` and `fingerprint.ts`.
- [ ] 12. Write property test `SUT-P-02` (order-independent deterministic derivation across shuffled ZIP entries) and `exceljs` oracle cross-check tests in `packages/canonical/test/`.
- [ ] 13. Run `scripts/check-line-limits.mjs` on touched files (< 500 lines/file, < 50 lines/function) and record initial fast-check seeds in `KIRO_JOURNAL.md`.

## Notes sur les tâches cochées

Les tâches 1 à 5 couvrent le paquet `@suture/ooxml-io`. L'implémentation
retient les contrats déjà figés dans `packages/contracts/src/ooxml.ts`
(`OoxmlPart`, `OoxmlParts`, `UnzipLimits`, `DEFAULT_UNZIP_LIMITS`,
`FileErrorCode`, `SutureFileError`, `ReadWorkbookResult`) : rien n'y a été
modifié.

Emplacements réels :

- `packages/ooxml-io/src/unzip.ts` — lecture, gardes, refus typés ;
- `packages/ooxml-io/src/zip.ts` — recompression déterministe ;
- `packages/ooxml-io/src/guards.ts` — magic bytes et limites ;
- `packages/ooxml-io/src/parts.ts` — chemins, tri, macros ;
- `packages/ooxml-io/src/index.ts` — API publique ;
- tests et aide de fixtures dans `packages/ooxml-io/src/` (`read-workbook.test.ts`,
  `zip-parts.test.ts`, `round-trip.prop.test.ts`, `test-fixtures.ts`), le
  `vitest.config.ts` de la racine les inclut.

La validation de l'archive OPC est faite dans `unzip.ts` (le spec la place
dans un fichier `validate.ts` séparé ; la séparation n'apporte rien ici et le
paquet reste sous les limites de lignes/fonctions).

Le ratio de compression n'est inspecté qu'au-dessus de 1 Mo
(`RATIO_CHECK_MIN_BYTES`), comme le prévoit SUT-N-04 : en dessous, le ratio
mesure l'overhead deflate et refuserait des parties légitimes.

Les graines fast-check sont consignées dans `packages/ooxml-io/PROPERTIES.md`.
