#!/usr/bin/env node
/**
 * perf — banc de performance de Suture sur un classeur de 200 000 cellules.
 *
 * Usage :
 *   node bench/generate-large.mjs   # préparation (non mesurée)
 *   node bench/perf.mjs             # mesures ; ajouter --expose-gc est optionnel
 *
 * Étapes mesurées (médiane + écart-type sur plusieurs passes, après chauffage) :
 * lecture de l'archive, dérivation canonique, import total, comparaison de deux
 * versions (quelques cellules puis variante structurelle), et le pas optionnel
 * de patch + recompression. Cibles du cahier : import < 5 000 ms, comparaison
 * < 3 000 ms. Code de sortie 0 si les deux cibles sont tenues, 1 sinon.
 */
import "./lib/bootstrap.mjs";
import "./lib/hooks.mjs";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { heapCapMb } from "./lib/bootstrap.mjs";
import { cellsPerSecond, measure, ms } from "./lib/measure.mjs";
import { machineDescription, renderMarkdown, reportDate, TARGET_COMPARE_MS, TARGET_IMPORT_MS, verdict } from "./lib/report.mjs";

// Les moteurs du dépôt sont des sources TypeScript résolues par les hooks de
// `bench/lib/hooks.mjs` : ils doivent être importés dynamiquement, APRÈS
// l'enregistrement des hooks (un import statique serait résolu avant).
const { readWorkbook, zipParts } = await import("@suture/ooxml-io");
const { deriveCanonical } = await import("@suture/canonical");
const { compare } = await import("@suture/diff");
const { patchWorkbook } = await import("@suture/ooxml-patch");
const { buildPatchRequest, cellCount, withChangedCells, withInsertedRows } = await import("./lib/variants.mjs");

const BENCH_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(BENCH_DIR, "data", "large-200k.xlsx");
const RESULTS_PATH = resolve(BENCH_DIR, "RESULTS.md");
const PASSES = 5;
const WARMUPS = 2;
const OPTIONS = { passes: PASSES, warmups: WARMUPS };

/** Lit le classeur préparé ; refuse de deviner s'il est absent. */
function loadFixture() {
  if (!existsSync(FIXTURE_PATH)) {
    console.error("perf: classeur introuvable — bench/data/large-200k.xlsx");
    console.error("perf: lancez d'abord `node bench/generate-large.mjs` (préparation, non mesurée).");
    process.exit(2);
  }
  return new Uint8Array(readFileSync(FIXTURE_PATH));
}

/** Mesure le chemin d'import : lecture, dérivation, puis les deux ensemble. */
function measureImport(bytes) {
  const read = measure("Lecture de l'archive (readWorkbook)", () => readWorkbook(bytes), OPTIONS);
  const parts = readWorkbook(bytes).parts;
  const derive = measure("Dérivation canonique (deriveCanonical)", () => deriveCanonical(parts), OPTIONS);
  const total = measure("Import total (lecture + dérivation)", () => deriveCanonical(readWorkbook(bytes).parts), OPTIONS);
  return { read, derive, total, parts, canonical: deriveCanonical(parts) };
}

/** Mesure les comparaisons (quelques cellules, structurelle) et le patch. */
function measureCompareAndPatch(canonical, parts) {
  const changed = withChangedCells(canonical, 50);
  const inserted = withInsertedRows(canonical, { atRow: 1000, count: 100, columns: 10 });
  const few = measure("Comparaison (50 cellules modifiées)", () => compare(canonical, changed), OPTIONS);
  const structural = measure("Comparaison (variante structurelle : 100 lignes insérées)", () => compare(canonical, inserted), OPTIONS);
  const request = buildPatchRequest(canonical, 500);
  const patch = measure("patchWorkbook (500 cellules modifiées)", () => patchWorkbook(parts, request), OPTIONS);
  const patchZip = measure("patchWorkbook + zipParts (500 cellules modifiées)", () => zipParts(patchWorkbook(parts, request).parts), OPTIONS);
  return { few, structural, patch, patchZip };
}

/** Ajoute le débit (cellules traitées par seconde) à chaque mesure. */
function withThroughput(metrics, cells) {
  return metrics.map((metric) => ({ ...metric, cellsPerSecond: cells > 0 ? Math.round(cells / (metric.medianMs / 1000)) : null }));
}

/** Affiche le tableau des mesures sur la console. */
function printTable(metrics) {
  const header = ["Étape", "Médiane", "Écart-type", "Débit"];
  const rows = metrics.map((metric) => [
    metric.label,
    ms(metric.medianMs),
    ms(metric.stdevMs),
    metric.cellsPerSecond === null ? "—" : cellsPerSecond(metric.cellsPerSecond),
  ]);
  const widths = header.map((title, index) => Math.max(title.length, ...rows.map((row) => row[index].length)));
  const line = (cells) => cells.map((cell, index) => cell.padEnd(widths[index])).join("  ");
  console.log("");
  console.log(line(header));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) console.log(line(row));
}

/** Verdict des deux cibles du cahier ; vrai quand les deux sont tenues. */
function printVerdict(importMetric, compareMetric) {
  const results = [
    { label: `import (< ${TARGET_IMPORT_MS} ms)`, ...verdict(importMetric.medianMs, TARGET_IMPORT_MS), medianMs: importMetric.medianMs },
    { label: `comparaison (< ${TARGET_COMPARE_MS} ms)`, ...verdict(compareMetric.medianMs, TARGET_COMPARE_MS), medianMs: compareMetric.medianMs },
  ];
  console.log("\nVerdict du cahier des charges :");
  for (const result of results) {
    const state = result.ok ? "TENU" : `CIBLE DÉPASSÉE de ${Math.round(result.overMs)} ms (+${result.overPct.toFixed(0)} %)`;
    console.log(`  ${result.label} : mesuré ${result.medianMs.toFixed(1)} ms → ${state}`);
  }
  return results.every((result) => result.ok);
}

/** Point d'entrée : préparation lue, mesures prises, rapport écrit. */
function main() {
  const bytes = loadFixture();
  const fixtureMb = (statSync(FIXTURE_PATH).size / 2 ** 20).toFixed(1);
  const importSteps = measureImport(bytes);
  const cells = cellCount(importSteps.canonical);
  const xmlMb = (importSteps.parts.reduce((total, part) => total + part.data.length, 0) / 2 ** 20).toFixed(1);
  const steps = measureCompareAndPatch(importSteps.canonical, importSteps.parts);
  const metrics = withThroughput(
    [importSteps.read, importSteps.derive, importSteps.total, steps.few, steps.structural, steps.patch, steps.patchZip],
    cells,
  );
  printTable(metrics);
  printVariantChecks(steps);
  const ok = printVerdict(importSteps.total, steps.few);
  const report = renderMarkdown({
    date: reportDate(),
    machine: machineDescription(),
    node: process.version,
    heapMb: heapCapMb(),
    gc: typeof global.gc === "function",
    fixtureMb,
    xmlMb,
    cells,
    metrics,
    importTotal: importSteps.total,
    compareFew: steps.few,
    compareStructural: steps.structural,
  });
  writeFileSync(RESULTS_PATH, report);
  console.log(`\nperf: résultats écrits dans bench/RESULTS.md (${cells.toLocaleString("fr-FR")} cellules mesurées)`);
  process.exit(ok ? 0 : 1);
}

/** Vérifie que les variantes produisent bien les changements annoncés. */
function printVariantChecks(steps) {
  const few = steps.few.value.summary;
  const structural = steps.structural.value.summary;
  console.log(`\nVariantes : « quelques cellules » → ${few.inputsModified} saisies modifiées ;`);
  console.log(`  « structurelle » → ${structural.rowsInserted} lignes insérées, ${structural.inputsModified} saisies modifiées.`);
}

main();
