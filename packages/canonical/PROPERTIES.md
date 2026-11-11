# Propriétés — `@suture/canonical`

Les propriétés vérifiées par fast-check dans ce paquet, avec les graines
utilisées et les contre-exemples trouvés. Les règles viennent de
`.kiro/steering/testing.md` : chaque propriété du projet est automatisée, les
graines sont imprimées en cas d'échec et consignées ici.

## Graines

| Propriété | Fichier | Graine | Runs (CI) |
|---|---|---|---|
| **SUT-P-02** — dérivation déterministe et indépendante de l'ordre de l'archive | `src/canonical.prop.test.ts` | `20261111` | 100 |

La graine est figée pour qu'un échec soit reproductible.

## SUT-P-02 — déterminisme et invariance à l'ordre des parties

> `derive(parts)` est strictement déterministe et invariant à l'ordre des
> entrées de l'archive : permuter le tableau `OoxmlParts` donne un
> `_workbook.json` et des `cells/*.tsv` identiques octet pour octet.

Le générateur produit des classeurs de 1 à 3 feuilles (noms, `sheetId`,
visibilité `visible`/`hidden` aléatoires), une table de textes partagés, des
noms définis et des parties supplémentaires (`docProps/custom.xml` avec ou sans
marqueur d'origine Suture). Les parties sont ensuite permutées par un
mélange de Fisher-Yates piloté par une graine tirée au hasard, et les deux
dérivations sont comparées :

1. `CanonicalWorkbook` complet (structure `toEqual`) ;
2. `serializeWorkbookJson(meta)` — le contenu de `cells/_workbook.json` ;
3. `serializeCellsTsv(sheet)` — le contenu de chaque `cells/*.tsv`, feuille par
   feuille, dans l'ordre de `meta.order`.

**Contre-exemple trouvé : aucun** (100 runs, graine `20261111`).

Le déterminisme vient de trois choix de conception, tous testés :

- les parties sont lues **par chemin** (`normalizeParts` trie avec
  `sortParts` de `@suture/ooxml-io`), jamais par position dans l'archive ;
- les feuilles sont triées par `meta.order`, les cellules par
  (ligne, colonne) **numériques** — `A10` passe après `A2`, jamais avant ;
- les propriétés Suture de `docProps/custom.xml` sont retirées avant
  dérivation, donc deux fichiers qui ne diffèrent que par leur marqueur
  d'origine produisent la même vue.

## Ce qui n'est pas couvert par une propriété

- La conversion A1 → L1C1 et le décalage des formules partagées relèvent de
  `SUT-P-03`, propriété du paquet `@suture/formula`. Ce paquet n'expose pas
  encore son codec dans `main` : `resolveFormulaCodec()` utilise donc le
  convertisseur interne de repli `src/fallback-formula.ts`, testé
  unitairement (`src/fallback-formula.test.ts`). Dès que `@suture/formula`
  exporte `a1ToR1c1` / `shiftA1`, l'adaptateur le préfère automatiquement et
  `fallback-formula.ts` peut être supprimé.
- La fidélité octet pour octet des parties (`SUT-P-01`) appartient à
  `@suture/ooxml-io` ; la dérivation ne relit jamais l'archive, elle ne reçoit
  que des parties déjà décompressées.
