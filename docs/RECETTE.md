# Recette — Suture (Kiroween 2026)

Checklist de recette du cahier des charges (section **B.18**) et du règlement du
concours. La partie automatisée vit dans `scripts/check-contest.mjs` ; la
partie manuelle est ci-dessous.

## Comment lancer la recette

```bash
pnpm install
pnpm ci:all          # types + lint + tests + construction + gardes
node scripts/check-contest.mjs   # conformité concours (dépôt, licence, .kiro, propriétés)
```

## Dépôt et concours

- [ ] Dépôt GitHub **public**, créé après le 30 octobre 2026.
- [ ] `LICENSE` MIT à la racine, licence détectée dans l'encart « About ».
- [ ] Dossier `/.kiro` à la racine, suivi par Git, **jamais** ignoré.
- [ ] `README.md` en anglais : ce que fait le projet, comment le lancer, le mode
      démonstration, les dépendances et leurs licences, le code préexistant.
- [ ] `KIRO_JOURNAL.md` à jour (surfaces, hooks, propriétés, comparaison
      « spec vs vibe coding », ce qui n'a pas marché).
- [ ] URL d'une application qui fonctionne, gratuite, sans restriction jusqu'au
      29 janvier 2027.
- [ ] Mode démonstration en un clic, sans installation ni compte.
- [ ] Vidéo de moins de 3 minutes, publique, sans musique sous droits ni
      marque tierne.
- [ ] Crédits Kiro demandés (avant le 1er décembre, 12 h, heure du Pacifique).

## Application — parcours de démonstration

- [ ] **P1** Déposer `budget_2026.xlsx` : un classeur suivi est créé, avec une
      première version.
- [ ] **P2** Déposer le fichier modifié : la comparaison s'affiche
      (« 3 saisies modifiées, 1 ligne ajoutée, 14 résultats recalculés »), la
      note est pré-remplie, l'utilisateur valide.
- [ ] **P3** Comparer deux versions : la grille montre les cellules modifiées,
      la ligne ajoutée en bande, les résultats recalculés en retrait ; filtres
      par feuille et par nature ; passage à la différence suivante au clavier.
- [ ] **P4** Ouvrir un scénario : un scénario est créé depuis la version
      courante, une copie de travail se télécharge, la référence ne bouge pas.
- [ ] **P5** Réunir un scénario : les modifications sans concurrence s'appliquent,
      un désaccord s'affiche (valeur d'origine + les deux côtés), l'utilisateur
      tranche, le fichier réuni se télécharge, une version à deux origines
      apparaît dans le graphe.
- [ ] **P6** Deux fichiers reçus par courriel : l'assistant crée les scénarios
      et lance la réunion.
- [ ] **P7** Histoire d'une cellule : quatre changements avec date, auteur,
      note et valeurs avant/après.
- [ ] **P8** Restaurer : une nouvelle version identique à l'ancienne, rien
      n'est effacé.
- [ ] **P9** Sortir de l'outil : l'archive exportée se clone avec Git et
      `git log -p -- cells/` montre des différences lisibles.

## Propriétés (fast-check)

- [ ] Les douze propriétés SUT-P-01 à SUT-P-12 passent ; les graines sont
      consignées (`packages/*/PROPERTIES.md`), avec 80 à 300 tirages par propriété, et chaque contre-exemple trouvé est
      figé par un test de régression déterministe.
- [ ] `Réunir(O, A, B)` et `Réunir(O, B, A)` donnent les mêmes cellules, aux
      désaccords près dont les côtés sont échangés.

## Fidélité du fichier

- [ ] Le cas de démonstration se réunit avec un seul désaccord, et le rapport
      liste toutes les modifications des deux côtés.
- [ ] Le fichier réuni s'ouvre dans Excel sans message, avec son graphique et
      sa mise en forme ; les totaux recalculés sont justes.
- [ ] Une version restituée est identique à l'originale, partie par partie
      (empreintes dans le journal de test).
- [ ] L'onglet réseau ne montre aucune requête après le chargement.

## Robustesse

- [ ] Un classeur chiffré, un `.xls` et une archive piégée sont refusés avec un
      message clair.
- [ ] La grille de comparaison reste fluide sur un classeur de 200 000 cellules.

## Interface

- [ ] Aucun mot de Git dans l'interface (garde `vocabulary-guard` verte).
- [ ] Contrastes AA, navigation au clavier, informations jamais portées par la
      seule couleur, `prefers-reduced-motion` respecté.
- [ ] Anglais par défaut, français disponible.
