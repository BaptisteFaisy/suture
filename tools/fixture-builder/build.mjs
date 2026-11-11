#!/usr/bin/env node
/**
 * fixture-builder — build a synthetic `.xlsx` (or `.xlsm`) from a JSON descriptor.
 *
 * Usage:
 *   node tools/fixture-builder/build.mjs fixtures/descriptors/<name>.json fixtures/generated/<name>.xlsx
 *
 * The output is deterministic: two builds of the same descriptor give the very
 * same bytes (no timestamp of the build clock inside the archive).
 * See `.kiro/skills/suture-fixture/SKILL.md` for the procedure.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDescriptor } from "./lib/descriptor.mjs";
import { buildParts } from "./lib/package.mjs";
import { zipParts } from "./lib/zip.mjs";

// The ZIP entries carry a DOS timestamp read in the local time zone: forcing
// UTC keeps the bytes identical whatever the machine that builds them.
process.env.TZ = "UTC";

/** Reads and validates a descriptor file. */
function readDescriptor(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return parseDescriptor(raw, path);
}

/** Builds the archive of a descriptor and writes it to `outputPath`. */
export function buildFixture(descriptorPath, outputPath) {
  const descriptor = readDescriptor(descriptorPath);
  const parts = buildParts(descriptor);
  const archive = zipParts(parts);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, archive);
  return { parts, archive };
}

/** Prints the usage when the command line is wrong. */
function usage(message) {
  console.error(message);
  console.error("usage: node tools/fixture-builder/build.mjs <descriptor.json> <output.xlsx>");
  process.exit(2);
}

/** Entry point of the command line. */
function main(argv) {
  const [descriptorPath, outputPath] = argv;
  if (!descriptorPath || !outputPath) usage("fixture-builder: two arguments are required.");
  const { parts } = buildFixture(descriptorPath, outputPath);
  console.log(`fixture-builder: ${outputPath} (${parts.length} parts)`);
}

/** True when this module is the one the command line points at. */
function isEntryPoint() {
  if (!process.argv[1]) return false;
  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  main(process.argv.slice(2));
}
