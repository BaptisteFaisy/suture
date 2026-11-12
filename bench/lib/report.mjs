/**
 * Rendu des résultats du banc — tableau console et `bench/RESULTS.md`.
 *
 * Les chiffres publiés viennent exclusivement des passes mesurées par
 * `bench/perf.mjs` (`performance.now()`, médiane et écart-type sur plusieurs
 * passes). La préparation du classeur n'entre jamais dans ces chiffres.
 */
import { arch, cpus, platform, release, totalmem } from "node:os";

/** Cibles du cahier des charges (section performance). */
export const TARGET_IMPORT_MS = 5_000;
export const TARGET_COMPARE_MS = 3_000;

/** Borne du concours : aucune date antérieure n'est publiée. */
const CUTOFF_MS = Date.UTC(2026, 9, 26);

/** Date ISO du jour, uniquement si elle est postérieure à la borne. */
export function reportDate() {
  const now = new Date();
  return now.getTime() > CUTOFF_MS ? now.toISOString().slice(0, 10) : null;
}

/** Description de la machine (sans nom d'hôte : le rapport est publié). */
export function machineDescription() {
  const cpu = cpus()[0]?.model ?? "CPU inconnu";
  const memoryGb = Math.round(totalmem() / 2 ** 30);
  return `${platform()} ${arch()} (${release()}) — ${cpus().length} cœurs, ${cpu}, ${memoryGb} Go RAM`;
}

/** Confronte une médiane mesurée à sa cible. */
export function verdict(medianMs, targetMs) {
  const overMs = medianMs - targetMs;
  return { ok: medianMs <= targetMs, overMs, overPct: (overMs / targetMs) * 100 };
}

/** Ligne « cible » du tableau Markdown. */
function targetRow(label, targetMs, medianMs) {
  const result = verdict(medianMs, targetMs);
  const state = result.ok ? "**TENU**" : `**NON TENU** (+${Math.round(result.overMs)} ms, +${result.overPct.toFixed(0)} %)`;
  return `| ${label} | < ${targetMs.toLocaleString("fr-FR")} ms | ${medianMs.toFixed(1)} ms | ${state} |`;
}

/** Ligne « mesure » du tableau Markdown. */
function metricRow(metric) {
  const cells = metric.cellsPerSecond === null ? "—" : `${metric.cellsPerSecond.toLocaleString("fr-FR")}`;
  return `| ${metric.label} | ${metric.medianMs.toFixed(1)} | ${metric.stdevMs.toFixed(1)} | ${cells} | ${metric.passes} |`;
}

/** Section « Analyse » : ce qui domine, et des pistes — sans les implémenter. */
function analysisSection(context) {
  const lines = [];
  const compareResult = verdict(context.compareFew.medianMs, TARGET_COMPARE_MS);
  const importResult = verdict(context.importTotal.medianMs, TARGET_IMPORT_MS);
  if (importResult.ok && compareResult.ok) {
    lines.push(
      "Les deux cibles du cahier sont tenues sur cette machine. Le point de tension connu reste",
      "l'alignement des lignes : `@suture/diff` calcule une plus longue sous-séquence commune sur",
      "les signatures de lignes, avec une matrice de programmation dynamique en O(lignes²) — à",
      "20 000 lignes, ~3,2 Go. La croissance est quadratique en nombre de lignes : un classeur",
      "deux fois plus haut casserait la cible de comparaison.",
    );
  }
  if (!compareResult.ok) {
    lines.push(...compareAnalysis(context, compareResult));
  }
  if (!importResult.ok) {
    lines.push(...importAnalysis(context, importResult));
  }
  return lines;
}

/** Analyse chiffrée de l'échec de la cible de comparaison. */
function compareAnalysis(context, result) {
  const ratio = context.compareStructural.medianMs / context.compareFew.medianMs;
  return [
    `**Comparaison — cible dépassée de ${Math.round(result.overMs)} ms (+${result.overPct.toFixed(0)} %).**`,
    "Ce qui domine : l'alignement des lignes. `alignRows` (`packages/diff/src/align.ts`, fonction",
    "`lcsPairs`) calcule une plus longue sous-séquence commune sur les signatures des 20 000 lignes",
    "avec une matrice de programmation dynamique pleine : (lignes+1)² cases, soit ~400 millions de",
    "nombres (~3,2 Go alloués, écrits puis relus) à chaque comparaison — quel que soit le nombre de",
    `cellules réellement changées. La variante structurelle (100 lignes insérées, +0,5 % de lignes`,
    `dans la matrice) mesure ${context.compareStructural.medianMs.toFixed(0)} ms, soit ${ratio.toFixed(2)}× la variante`,
    "à 50 cellules : les deux paient la même LCS pleine — le coût vient de la matrice, pas du",
    "contenu des changements.",
    "",
    "Pistes d'optimisation (non implémentées, non mesurées) :",
    "",
    "1. **Ancres linéaires avant la LCS** : élaguer le préfixe et le suffixe de lignes identiques,",
    "   puis n'exécuter la LCS que sur les segments entre ancres — le cas courant (quelques cellules",
    "   modifiées, aucune ligne bougée) deviendrait quasi linéaire ; hacher les signatures évite en",
    "   plus les comparaisons de chaînes dans la boucle interne.",
    "2. **LCS bornée ou à mémoire linéaire** : remplacer la matrice pleine par un Myers borné à une",
    "   bande autour de la diagonale (les différences réelles en restent proches) ou par Hirschberg",
    "   (O(min(n,m)) en mémoire).",
  ];
}

/** Analyse chiffrée de l'échec de la cible d'import. */
function importAnalysis(context, result) {
  return [
    `**Import — cible dépassée de ${Math.round(result.overMs)} ms (+${result.overPct.toFixed(0)} %).**`,
    `Ce qui domine : l'analyse XML. La feuille fait ${context.xmlMb} Mo décompressée et`,
    "`deriveCanonical` la matérialise d'abord en arbre générique complet (`parseXml`,",
    "`packages/canonical/src/xml.ts`) — un objet par élément et par attribut — avant d'en tirer les",
    "cellules ; le tri final relit chaque référence avec un comparateur à base d'expressions",
    "rationnelles (`cellRefSortKey` appelé à chaque comparaison).",
    "",
    "Pistes d'optimisation (non implémentées, non mesurées) :",
    "",
    "1. **Analyse événementielle de la feuille** : parcourir le XML de `sheetData` sans construire",
    "   l'arbre intermédiaire et émettre les `CellRecord` au fil de l'eau.",
    "2. **Clé de tri numérique calculée une fois** : pré-calculer (ligne, colonne) par cellule au",
    "   lieu de re-analyser la référence à chaque comparaison du tri.",
  ];
}

/** Section « Environnement » du rapport. */
function environmentSection(context) {
  const dateLine = context.date ? `| Date | ${context.date} |` : "";
  return `## Environnement

| | |
|---|---|
| Classeur | \`bench/data/large-200k.xlsx\` — 20 000 lignes × 10 colonnes |
| Taille du fichier | ${context.fixtureMb} Mo (ZIP), ${context.xmlMb} Mo de XML décompressé |
| Cellules canoniques | ${context.cells.toLocaleString("fr-FR")} |
| Machine | ${context.machine} |
| Node | ${context.node} |
| Ramasse-miettes entre les passes | ${context.gc ? "oui (\`--expose-gc\`)" : "non (sans \`--expose-gc\`)"} |
${dateLine}
`;
}

/** Le rapport complet, en Markdown. */
export function renderMarkdown(context) {
  const rows = context.metrics.map(metricRow).join("\n");
  const analysis = analysisSection(context);
  return `# Banc de performance — Suture

Chiffres **réels**, mesurés par \`node bench/perf.mjs\` sur le classeur
\`bench/data/large-200k.xlsx\` (200 000 cellules non vides). Chaque étape est
chronométrée avec \`performance.now()\`, après un chauffage, sur
${context.metrics[0].passes} passes ; le tableau donne la médiane et l'écart-type.
La génération du classeur est une **préparation** : elle n'entre dans aucun
chiffre publié. Le tas Node est borné à ${context.heapMb} Mo par le banc
(l'alignement des lignes alloue une matrice quadratique, voir l'analyse).

${environmentSection(context)}
## Cibles du cahier des charges

| Cible | Seuil | Mesuré (médiane) | Verdict |
|---|---|---|---|
${targetRow("Import d'un classeur de 200 000 cellules (lecture + dérivation)", TARGET_IMPORT_MS, context.importTotal.medianMs)}
${targetRow("Comparaison de deux versions (quelques cellules modifiées)", TARGET_COMPARE_MS, context.compareFew.medianMs)}

## Mesures

| Étape | Médiane (ms) | Écart-type (ms) | Débit (cellules/s) | Passes |
|---|---|---|---|---|
${rows}

## Ce qui est mesuré

Le classeur mélange les saveurs d'un vrai registre : textes en table partagée,
entiers et décimaux formatés, dates formatées (\`dd/mm/yyyy\`), booléens, une
formule partagée (maître \`F2\` + 19 998 suiveurs) et des formules simples avec
résultat en cache. Les variantes comparées sont construites avant les passes
(préparation) : « quelques cellules » = 50 cellules ressaisies ;
« structurelle » = 100 lignes insérées en ligne 1 000, tout le dessous décalé.

## Analyse

${analysis.join("\n")}
`;
}
