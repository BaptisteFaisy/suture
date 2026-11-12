# Banc de performance — Suture

Mesure reproductible des deux cibles de performance du cahier des charges
(Kiroween 2026) sur un classeur de **200 000 cellules non vides** :

| Cible | Seuil |
|---|---|
| Import d'un classeur de 200 000 cellules (lecture + dérivation canonique) | **< 5 000 ms** |
| Comparaison de deux versions de ce classeur | **< 3 000 ms** |

## Rejouer le banc en local

```bash
pnpm install                        # une fois : les hooks chargent les sources TS du dépôt
node bench/generate-large.mjs       # préparation : bench/data/large-200k.xlsx (~2 s, non mesurée)
node bench/perf.mjs                 # mesures ; code de sortie 0 si les deux cibles sont tenues
```

`node --expose-gc bench/perf.mjs` est pris en charge (ramasse-miettes explicite
entre les passes, chiffres un peu plus stables) ; sans l'option, le banc tourne
quand même. Le banc se relance lui-même avec un tas Node élargi (la moitié de
la mémoire de la machine, plafond 8 Go) : l'alignement des lignes alloue une
matrice quadratique d'environ 3,2 Go à 20 000 lignes.

Le classeur généré n'est **jamais committé** (`bench/data/` est ignoré) : c'est
une donnée de préparation, régénérable à l'octet près.

## Ce qui est mesuré

Le classeur `large-200k.xlsx` (20 000 lignes × 10 colonnes) est construit par
le générateur de fixtures du dépôt (`tools/fixture-builder`) — même pipeline
descripteur → parties → ZIP, donc mêmes moteurs à la lecture. Il mélange les
saveurs d'un vrai registre : textes en table partagée, entiers et décimaux
formatés, dates formatées, booléens, une formule partagée (maître + 19 998
suiveurs) et des formules simples avec résultat en cache.

| Étape | Moteur mesuré |
|---|---|
| Lecture de l'archive | `readWorkbook` (`@suture/ooxml-io`) |
| Dérivation canonique | `deriveCanonical` (`@suture/canonical`) |
| **Import total** | lecture + dérivation, mesurés ensemble → cible 5 000 ms |
| Comparaison (50 cellules modifiées) | `compare` (`@suture/diff`) → cible 3 000 ms |
| Comparaison (variante structurelle) | `compare` sur 100 lignes insérées en ligne 1 000 |
| Patch + recompression (optionnel) | `patchWorkbook` (`@suture/ooxml-patch`) + `zipParts` sur 500 cellules |

Règles de mesure :

- chaque durée vient de `performance.now()` (horloge monotone), jamais de `Date.now()` ;
- chaque étape est chauffée (2 passes hors mesure) puis mesurée sur 5 passes ;
  le rapport publie la **médiane** et l'**écart-type** ;
- la génération du classeur et la construction des variantes sont de la
  **préparation** : elles n'entrent dans aucun chiffre publié ;
- rien n'est écrit sur la console pendant une passe mesurée.

## Résultats

Les derniers résultats mesurés sont dans [`RESULTS.md`](RESULTS.md) — régénéré
à chaque exécution du banc, et téléversé comme artefact par la recette
nocturne (`.github/workflows/recette.yml`, étape « Banc de performance »,
`continue-on-error: true` : un seuil dépassé ne casse pas la recette, mais le
verdict s'affiche dans le journal et dans le rapport).

Aucune dépendance nouvelle : Node ≥ 24, les paquets du dépôt et le
transpilateur TypeScript déjà présent en `devDependencies`.
