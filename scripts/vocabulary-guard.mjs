#!/usr/bin/env node
/**
 * vocabulary-guard — the UI must never use a Git word (SUT-N-09).
 * Scans string literals and JSX text in UI source files for banned terms
 * (English and French). CI-enforced mirror of the Kiro hook
 * `.kiro/hooks/vocabulary-guard.json`.
 *
 * Allowed: the developer-facing export screen may name the format, and any
 * line can be exempted with a trailing `// vg-allow-line` comment.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["packages/ui/src", "apps/web/src"];
const EXTENSIONS = new Set([".ts", ".tsx"]);
const ALLOW_PATH = /(^|\/)(export|developer)(\/|\.)|\bexport\b/i;
const ALLOW_LINE = "vg-allow-line";

const BANNED = [
  // English Git vocabulary (B.4 left column)
  "git", "commit", "branch", "merge", "diff", "conflict", "repository",
  "repo", "tag", "revert", "blame", "checkout", "stash", "clone", "push",
  "pull", "rebase", "master", "fork", "upstream", "remote",
  // French Git vocabulary
  "dépôt", "dépôts", "branche", "fusion", "conflit", "étiquette",
  "blâme",
];

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, files);
    } else if (EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Mask comments (keep their length) so the scan only looks at real code:
 * a mention of a package name inside a doc comment is not user-visible text.
 */
function maskComments(source) {
  let out = "";
  let state = "code";
  let quote = "";
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1] ?? "";
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line";
        out += "  ";
        i += 1;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block";
        out += "  ";
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        state = "string";
        quote = ch;
      }
      out += ch;
      continue;
    }
    if (state === "string") {
      out += ch;
      if (ch === "\\") {
        out += next;
        i += 1;
      } else if (ch === quote) {
        state = "code";
      }
      continue;
    }
    if (state === "line") {
      if (ch === "\n") {
        state = "code";
        out += ch;
      } else {
        out += " ";
      }
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        out += "  ";
        i += 1;
      } else {
        out += ch === "\n" ? "\n" : " ";
      }
    }
  }
  return out;
}

/** Extracts string literals and JSX text chunks with their line numbers. */
function extractStrings(source) {
  const chunks = [];
  const code = maskComments(source);
  const patterns = [
    /"((?:[^"\\\n]|\\.)*)"/g, // "..." string literals
    /'((?:[^'\\\n]|\\.)*)'/g, // '...' string literals
    /`((?:[^`\\]|\\.)*)`/g, // `...` template literals
    />([^<>{}]+)</g, // JSX text nodes
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const text = match[1] ?? "";
      if (text.trim().length === 0) continue;
      const line = code.slice(0, match.index).split("\n").length;
      chunks.push({ text, line });
    }
  }
  return chunks;
}

function bannedWordsIn(text) {
  const found = [];
  for (const word of BANNED) {
    const pattern = new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, "iu");
    if (pattern.test(text)) found.push(word);
  }
  return found;
}

function checkFile(path) {
  const source = readFileSync(path, "utf8");
  const lines = source.split("\n");
  const problems = [];
  for (const chunk of extractStrings(source)) {
    if ((lines[chunk.line - 1] ?? "").includes(ALLOW_LINE)) continue;
    const words = bannedWordsIn(chunk.text);
    if (words.length > 0) {
      problems.push({ line: chunk.line, words, text: chunk.text.trim().slice(0, 60) });
    }
  }
  return problems;
}

let violations = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (ALLOW_PATH.test(relative(".", file))) continue;
    for (const problem of checkFile(file)) {
      violations += 1;
      console.error(
        `${file}:${problem.line}: mots interdits [${problem.words.join(", ")}] dans « ${problem.text} »`,
      );
    }
  }
}

if (violations > 0) {
  console.error(
    `\n${violations} violation(s) de vocabulaire : l'interface n'emploie que la colonne « Suture » (B.4 / SUT-N-09).`,
  );
  process.exit(1);
}
console.log("vocabulary-guard : OK (aucun mot de Git dans l'interface)");
