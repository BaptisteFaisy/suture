# suture

Suture — version control for spreadsheets, without the word Git. Kiroween 2026 (Frankenstein).

## Pipeline

File de merge Mergify (rebase, historique linéaire) + balayeur `pr-auto-merge` :
checks requis `ci`, `ci-budget` (jobs ≤ 5 min), `couche0` (garde `## Scope`).

- Runners self-hosted r630 : `r630-suture-01..NN` (label `__WORKER__`).
- Toute PR porte une section `## Scope` (puces `- `fichier``) listant ses
  fichiers ; les workflows sont des fichiers de garde (`SAMVISION_ALLOW_GUARD_BUMP`).
- Conflits : agent Fireworks ; tests rouges : agent zeroclaw `fw` via `triage-rouge`.
- `main` est protégée (ruleset) : tout passe par PR + file, jamais de push direct.
