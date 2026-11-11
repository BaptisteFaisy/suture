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
> `_workbook.json` et des `cells/*.tsv` identiques, partie par partie.

Le générateur produit des classeurs de 1 à 3 feuilles (noms, `sheetId` et
visibilité `visible`/`hidden` aléatoires), une table de textes partagés (texte
simple et texte enrichi), des noms définis, des formats de nombre intégrés et
personnalisés, et un `docProps/custom.xml` avec ou sans marqueur d'origine
Suture. Les cellules couvrent les formes utiles : nombre, texte partagé,
booléen, cellule de style seul, formule avec valeur en cache, ligne 10 et
colonne `AA` (tri numérique, pas lexicographique).

Les parties sont ensuite permutées par un mélange de Fisher-Yates piloté par une
graine tirée au hasard, et les deux dérivations sont comparées :

1. `CanonicalWorkbook` complet (`toEqual`) ;
2. `serializeWorkbookJson(meta)` — le contenu de `cells/_workbook.json` ;
3. `serializeCellsTsv(sheet)` — le contenu de chaque `cells/*.tsv`, feuille par
   feuille, dans l'ordre de `meta.order`.

| Propriété | Contre-exemple | Correction | Graine |
|---|---|---|---|
| **SUT-P-02** | Aucun sur 100 runs. | — | `20261111` |

Un défaut réel a été trouvé et corrigé pendant la mise au point ; il est
couvert par un test déterministe (`src/canonical.test.ts`) :

| Défaut | Symptôme | Correction |
|---|---|---|
| Texte d'une cellule `t="inlineStr"` perdu | `<is><t>Inline</t></is>` donnait une valeur vide : le texte vit dans l'enfant `<t>`, pas dans `<is>` | `collectText()` recueille les `<t>` descendants en ignorant `<rPh>` — le même parcours que pour la table des textes partagés |

Le déterminisme vient de quatre choix de conception, tous testés :

- les parties sont lues **par chemin** (`normalizeParts` trie avec `sortParts`
  de `@suture/ooxml-io`), jamais par position dans l'archive ;
- les feuilles sont triées par `meta.order`, les cellules par (ligne, colonne)
  **numériques** — `A10` passe après `A2`, jamais avant ;
- la feuille est parcourue en **deux passes** : collecte des cellules et des
  maîtres de formules partagées, puis résolution — un suiveur placé avant son
  maître dans le XML est donc tout de même développé ;
- les propriétés Suture de `docProps/custom.xml` sont retirées avant
  dérivation : deux fichiers qui ne diffèrent que par leur marqueur d'origine
  produisent la même vue.

## Ce qui n'est pas couvert ici

- La conversion A1 → L1C1, le décalage des références et l'arrondi des formules
  partagées relèvent de `SUT-P-03`, propriété du paquet `@suture/formula` :
  `deriveCanonical` appelle `a1ToR1c1` et `shiftA1` de ce paquet, sans
  réimplémentation.
- La fidélité octet pour octet des parties (`SUT-P-01`) appartient à
  `@suture/ooxml-io` ; la dérivation ne relit jamais l'archive, elle ne reçoit
  que des parties déjà décompressées.
