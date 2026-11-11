# Banc de performance — Suture

Chiffres **réels**, mesurés par `node bench/perf.mjs` sur le classeur
`bench/data/large-200k.xlsx` (200 000 cellules non vides). Chaque étape est
chronométrée avec `performance.now()`, après un chauffage, sur
5 passes ; le tableau donne la médiane et l'écart-type.
La génération du classeur est une **préparation** : elle n'entre dans aucun
chiffre publié. Le tas Node est borné à 8192 Mo par le banc
(l'alignement des lignes alloue une matrice quadratique, voir l'analyse).

## Environnement

| | |
|---|---|
| Classeur | `bench/data/large-200k.xlsx` — 20 000 lignes × 10 colonnes |
| Taille du fichier | 1.3 Mo (ZIP), 7.4 Mo de XML décompressé |
| Cellules canoniques | 200 000 |
| Machine | linux x64 (6.14.0-37-generic) — 12 cœurs, 11th Gen Intel(R) Core(TM) i5-11600K @ 3.90GHz, 31 Go RAM |
| Node | v26.9.0 |
| Ramasse-miettes entre les passes | oui (`--expose-gc`) |
| Date | 2026-11-11 |

## Cibles du cahier des charges

| Cible | Seuil | Mesuré (médiane) | Verdict |
|---|---|---|---|
| Import d'un classeur de 200 000 cellules (lecture + dérivation) | < 5 000 ms | 1532.2 ms | **TENU** |
| Comparaison de deux versions (quelques cellules modifiées) | < 3 000 ms | 11655.9 ms | **NON TENU** (+8656 ms, +289 %) |

## Mesures

| Étape | Médiane (ms) | Écart-type (ms) | Débit (cellules/s) | Passes |
|---|---|---|---|---|
| Lecture de l'archive (readWorkbook) | 80.2 | 10.5 | 2 495 211 | 5 |
| Dérivation canonique (deriveCanonical) | 1481.5 | 112.5 | 135 002 | 5 |
| Import total (lecture + dérivation) | 1532.2 | 137.8 | 130 533 | 5 |
| Comparaison (50 cellules modifiées) | 11655.9 | 4937.4 | 17 159 | 5 |
| Comparaison (variante structurelle : 100 lignes insérées) | 13604.8 | 3668.7 | 14 701 | 5 |
| patchWorkbook (500 cellules modifiées) | 533.0 | 53.3 | 375 246 | 5 |
| patchWorkbook + zipParts (500 cellules modifiées) | 1552.0 | 487.5 | 128 868 | 5 |

## Ce qui est mesuré

Le classeur mélange les saveurs d'un vrai registre : textes en table partagée,
entiers et décimaux formatés, dates formatées (`dd/mm/yyyy`), booléens, une
formule partagée (maître `F2` + 19 998 suiveurs) et des formules simples avec
résultat en cache. Les variantes comparées sont construites avant les passes
(préparation) : « quelques cellules » = 50 cellules ressaisies ;
« structurelle » = 100 lignes insérées en ligne 1 000, tout le dessous décalé.

## Analyse

**Comparaison — cible dépassée de 8656 ms (+289 %).**
Ce qui domine : l'alignement des lignes. `alignRows` (`packages/diff/src/align.ts`, fonction
`lcsPairs`) calcule une plus longue sous-séquence commune sur les signatures des 20 000 lignes
avec une matrice de programmation dynamique pleine : (lignes+1)² cases, soit ~400 millions de
nombres (~3,2 Go alloués, écrits puis relus) à chaque comparaison — quel que soit le nombre de
cellules réellement changées. La variante structurelle (100 lignes insérées, +0,5 % de lignes
dans la matrice) mesure 13605 ms, soit 1.17× la variante
à 50 cellules : les deux paient la même LCS pleine — le coût vient de la matrice, pas du
contenu des changements.

Pistes d'optimisation (non implémentées, non mesurées) :

1. **Ancres linéaires avant la LCS** : élaguer le préfixe et le suffixe de lignes identiques,
   puis n'exécuter la LCS que sur les segments entre ancres — le cas courant (quelques cellules
   modifiées, aucune ligne bougée) deviendrait quasi linéaire ; hacher les signatures évite en
   plus les comparaisons de chaînes dans la boucle interne.
2. **LCS bornée ou à mémoire linéaire** : remplacer la matrice pleine par un Myers borné à une
   bande autour de la diagonale (les différences réelles en restent proches) ou par Hirschberg
   (O(min(n,m)) en mémoire).
