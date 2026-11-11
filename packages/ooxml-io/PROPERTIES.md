# Propriétés — `@suture/ooxml-io`

Les propriétés vérifiées par fast-check dans ce paquet, avec les
contre-exemples trouvés et la correction appliquée.

| Propriété | Contre-exemple | Correction | Graine |
|---|---|---|---|
| **SUT-P-01** — `unzip(zip(parts)) == parts` octet pour octet | Aucun contre-exemple trouvé. Le premier essai (noms de parties tirés d'un alphabet incluant `.` en tête) produisait un chemin `xl/workbook.xml` dupliqué par le générateur : le round-trip perdait une entrée. | Le générateur exclut désormais `xl/workbook.xml` de la liste tirée et l'ajoute une seule fois ; l'archive garde toujours exactement un workbook. | — (corrigé avant le premier run) |
| **SUT-P-02** (partiel, archive) — les mêmes parties donnent toujours la même archive | Aucun contre-exemple trouvé. `zipParts` trie par chemin et écrit une date fixe ; deux constructions donnent les mêmes octets. | — | — |

## Détail des propriétés

### SUT-P-01 — fidélité du round-trip

`unzip(zip(parts))` redonne les mêmes parties, aux mêmes chemins, avec les
mêmes octets. Le générateur produit :

- des chemins uniques (1 à 3 segments, segments alphanumériques) ;
- des octets arbitraires (longueur 0 à 512), octets nuls et séquences non
  UTF-8 comprises ;
- un dossier de test qui refuse toute archive sans `xl/workbook.xml`.

Runs : 200 en CI (≥ 100 exigé par `.kiro/steering/testing.md`), 1 000 en local
(vérifié : 750 ms, aucun échec).

### Déterminisme de l'archive

`zipParts` écrit :

1. les entrées triées par chemin (ordre UTF-16 croissant) ;
2. un horodatage fixe (1er janvier 1980, la plus ancienne valeur que le
   format ZIP accepte) ;
3. un niveau de compression fixe (6).

Deux constructions de la même liste de parties produisent donc les mêmes
octets, quel que soit l'ordre de la liste d'entrée. Testé par propriété
(100 runs) et par test unitaire.

> **Ce qui n'est pas garanti** : la archive produite n'est pas identique à
> l'archive d'origine d'un `.xlsx` downloaded (horodatages, ordre des entrées,
> choix du compresseur diffèrent). La garantie porte sur les **parties** :
> c'est ce qu'exige `.kiro/steering/ooxml.md` (point 8) et la propriété
> SUT-P-10.

## Refus et limites

Les refus sont typés (`SutureFileError`) et leurs messages sont en anglais,
destinés à l'utilisateur final. Aucun test n'atteint le réseau.

| Code | Déclencheur | Test |
|---|---|---|
| `not-a-zip` | octets ne commençant pas par `PK\x03\x04` ou `PK\x05\x06` | `read-workbook.test.ts` |
| `encrypted` | magic OLE2/CFB `D0 CF 11 E0`, ou partie `EncryptionInfo` / `EncryptedPackage` | `read-workbook.test.ts` |
| `unsupported-format` | archive ZIP valide sans `xl/workbook.xml`, ou feuille `.xlsb` | `read-workbook.test.ts` |
| `corrupt` | archive illisible (erreur fflate) | `read-workbook.test.ts` |
| `too-large` | total décompressé > `maxDecompressedBytes` (50 Mo) | `read-workbook.test.ts` |
| `too-many-entries` | plus de `maxEntries` entrées (20 000) | `read-workbook.test.ts` |
| `zip-bomb` | ratio décompressé/compressé d'une entrée > `maxCompressionRatio` (200) | `read-workbook.test.ts` |

### Note sur le ratio de compression

Le ratio n'est inspecté que pour les entrées d'au moins 1 Mo
(`RATIO_CHECK_MIN_BYTES`). En dessous, le ratio mesure surtout l'overhead
deflate : un XML de 40 octets compressé sur 30 donnerait un ratio de 1,3,
et une feuille de calcul légitime serait refusée à tort. La spec
`.kiro/specs/ooxml-io/requirements.md` (SUT-N-04) prévoit le même seuil
(1 Mo) pour la même raison.

### Note sur les limites personnalisées

`readWorkbook(bytes, limits)` accepte un objet partiel : les valeurs absentes
reprennent les valeurs de `DEFAULT_UNZIP_LIMITS` du contrat. Le contrat reste
la source unique des limites ; ce paquet ne les redéfinit pas.

## Macros

`xl/vbaProject.bin` n'est jamais exécuté ni interprété : la partie est
conservée telle quelle, octet pour octet, et `macroEnabled` vaut `true`. Le
contenu n'est même pas inspecté.
