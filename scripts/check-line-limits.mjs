#!/usr/bin/env node
/**
 * check-line-limits — every source file stays under 500 lines
 * (workspace rule; functions are guarded by eslint max-lines-per-function).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["packages", "apps", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js"]);
const MAX_LINES = 500;
const SKIP = /node_modules|dist|coverage|\.vite/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (SKIP.test(path)) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, files);
    } else if (EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) {
      files.push(path);
    }
  }
  return files;
}

let violations = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const count = readFileSync(file, "utf8").split("\n").length;
    if (count >= MAX_LINES) {
      violations += 1;
      console.error(`${file}: ${count} lignes (limite ${MAX_LINES})`);
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} fichier(s) au-dessus de la limite : découper, ne pas laisser grossir.`);
  process.exit(1);
}
console.log(`check-line-limits : OK (< ${MAX_LINES} lignes par fichier)`);
