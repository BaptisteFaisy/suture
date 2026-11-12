#!/usr/bin/env node
/**
 * build-all — rebuild every fixture from its descriptor.
 *
 * The generated `.xlsx` files are committed next to their descriptors: this
 * script is the only way they are produced (never edited by hand).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFixture } from "./build.mjs";

const HERE = resolve(fileURLToPath(import.meta.url), "..");
const ROOT = resolve(HERE, "..", "..");
const DESCRIPTORS = join(ROOT, "fixtures", "descriptors");
const OUTPUT = join(ROOT, "fixtures", "generated");

/** Reads the output name declared by a descriptor. */
function declaredOutput(descriptorPath, fileName) {
  const raw = JSON.parse(readFileSync(descriptorPath, "utf8"));
  return raw.output ?? fileName.replace(/\.json$/, ".xlsx");
}

/** Rebuilds every descriptor of the folder. */
function main() {
  const files = readdirSync(DESCRIPTORS)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const fileName of files) {
    const descriptorPath = join(DESCRIPTORS, fileName);
    const output = join(OUTPUT, declaredOutput(descriptorPath, fileName));
    const { parts } = buildFixture(descriptorPath, output);
    console.log(`${fileName} -> ${output.split("/").pop()} (${parts.length} parts)`);
  }
}

main();
