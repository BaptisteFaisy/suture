#!/usr/bin/env node
/**
 * generate-large — builds the 200 000-cell workbook measured by the bench.
 *
 * Usage:
 *   node bench/generate-large.mjs [output.xlsx]   (default bench/data/large-200k.xlsx)
 *
 * The workbook goes through the very same descriptor → parts → ZIP pipeline as
 * the committed fixtures (`tools/fixture-builder`), so the bench measures the
 * real engines on a realistic file — no second generator is duplicated here.
 * The mix covers what a real ledger carries: shared strings, integers and
 * decimals with number formats, formatted dates, booleans, a shared formula
 * (one master + followers) and plain formulas with cached results.
 *
 * The build is deterministic: a fixed seed feeds the mix and the ZIP step uses
 * the fixed timestamp of the fixture builder, so two runs give the same bytes.
 * The generated file is preparation data — it is never committed (`.gitignore`)
 * and its build time is NOT part of the published measurements.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDescriptor } from "../tools/fixture-builder/lib/descriptor.mjs";
import { buildParts } from "../tools/fixture-builder/lib/package.mjs";
import { columnName } from "../tools/fixture-builder/lib/xml.mjs";
import { zipParts } from "../tools/fixture-builder/lib/zip.mjs";

const ROWS = 20_000;
const COLUMNS = 10;
const EXPECTED_CELLS = ROWS * COLUMNS;
const SEED = 1_234_567; // fixed: two runs produce the very same bytes
const DEFAULT_OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "data", "large-200k.xlsx");

const HEADERS = ["Poste", "Quantité", "Prix unitaire", "Date", "Catégorie", "Total", "Cumul", "Taux", "Validé", "Note"];
const LABELS = [
  "Fournitures de bureau", "Prestation de conseil", "Maintenance informatique", "Frais de déplacement",
  "Licence logicielle", "Formation du personnel", "Loyer du local", "Assurance professionnelle",
  "Affranchissement", "Téléphonie", "Électricité", "Chauffage", "Eau", "Nettoyage",
  "Petit équipement", "Outillage", "Matières premières", "Emballages", "Transport de marchandises",
  "Publicité", "Salon professionnel", "Honoraires comptables", "Frais bancaires", "Impôts et taxes",
];
const CATEGORIES = ["Achats", "Services", "Logistique", "Ressources humaines", "Fiscalité", "Investissement"];
const NOTES = ["À lettrier", "Validé par la direction", "En attente de pièce", "Rapproché du bon de commande"];

/** Deterministic pseudo-random generator (mulberry32), seeded. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Picks one entry of a pool, driven by the seeded generator. */
function pick(pool, random) {
  return pool[Math.floor(random() * pool.length)];
}

/** The header row: ten shared-string cells. */
function headerCells() {
  return HEADERS.map((text, index) => ({ ref: `${columnName(index + 1)}1`, value: text }));
}

/** The shared-formula marker of column F: master on F2, followers elsewhere. */
function sharedMarker(row) {
  return row === 2 ? { si: "0", master: true, ref: `F2:F${ROWS}` } : { si: "0" };
}

/** One data row: ten non-empty cells covering every flavour of the mix. */
function dataCells(row, random) {
  const quantity = 1 + Math.floor(random() * 500);
  const price = Math.round(random() * 20_000) / 100;
  const rate = Math.round(random() * 1_000) / 10_000;
  const serial = 45_000 + Math.floor(random() * 400); // Excel date serial
  const total = Math.round(quantity * price * 100) / 100;
  const shared = sharedMarker(row);
  const formula = row === 2
    ? { ref: `F${row}`, formula: "B2*C2", cached: total, shared }
    : { ref: `F${row}`, cached: total, shared };
  const checked = row % 2 === 0
    ? { ref: `I${row}`, value: quantity % 7 === 0 }
    : { ref: `I${row}`, value: row % 97 };
  return [
    { ref: `A${row}`, value: pick(LABELS, random) },
    { ref: `B${row}`, value: quantity },
    { ref: `C${row}`, value: price, format: "#,##0.00" },
    { ref: `D${row}`, value: serial, format: "dd/mm/yyyy" },
    { ref: `E${row}`, value: pick(CATEGORIES, random) },
    formula,
    { ref: `G${row}`, formula: `B${row}+C${row}`, cached: Math.round((quantity + price) * 100) / 100 },
    { ref: `H${row}`, value: rate, format: "0.00%" },
    checked,
    { ref: `J${row}`, value: pick(NOTES, random) },
  ];
}

/** The full descriptor: one sheet of exactly `EXPECTED_CELLS` non-empty cells. */
export function buildDescriptor() {
  const random = mulberry32(SEED);
  const cells = headerCells();
  for (let row = 2; row <= ROWS; row += 1) cells.push(...dataCells(row, random));
  if (cells.length !== EXPECTED_CELLS) {
    throw new Error(`generate-large: attendu ${EXPECTED_CELLS} cellules, obtenu ${cells.length}`);
  }
  return {
    name: "Suture — grand registre (banc de performance)",
    options: { sharedStrings: true, sharedFormulas: true },
    sheets: [{ name: "Registre", cells }],
  };
}

/** True when this module is the one the command line points at. */
function isEntryPoint() {
  if (!process.argv[1]) return false;
  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

/** Entry point: descriptor → parts → deterministic ZIP → file on disk. */
function main() {
  const started = performance.now();
  const descriptor = parseDescriptor(buildDescriptor(), "generate-large");
  const parts = buildParts(descriptor);
  const archive = zipParts(parts);
  const output = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUTPUT;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, archive);
  const digest = createHash("sha256").update(archive).digest("hex");
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`generate-large: ${output}`);
  console.log(`  ${EXPECTED_CELLS} cellules (${ROWS} lignes × ${COLUMNS} colonnes), ${(archive.length / 2 ** 20).toFixed(1)} Mo`);
  console.log(`  sha256 ${digest.slice(0, 32)}… — préparation en ${seconds} s (hors mesures publiées)`);
}

if (isEntryPoint()) main();
