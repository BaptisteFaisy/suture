#!/usr/bin/env node
/**
 * check-contest — automated part of the Kiroween acceptance list (B.18).
 * Verifies, from the working tree and the GitHub API (when available):
 *   - the repository is public and created inside the submission window;
 *   - the MIT licence is at the root and detected by GitHub;
 *   - the .kiro folder is at the root, tracked by Git and never ignored;
 *   - the KIRO_JOURNAL is present and not empty;
 *   - the CI has its four controls (types, lint, tests, build);
 *   - no UI string carries a Git word;
 *   - every property SUT-P-01..SUT-P-12 has a test.
 *
 * Usage: node scripts/check-contest.mjs [--offline]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OFFLINE = process.argv.includes("--offline");
const REPO = "BaptisteFaisy/suture";
const failures = [];
const notes = [];

function check(label, ok, detail = "") {
  const line = `${ok ? "OK  " : "KO  "} ${label}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  if (!ok) failures.push(label);
}

function git(args, cwd = ".") {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

// 1. Licence MIT à la racine.
try {
  const licence = readFileSync("LICENSE", "utf8");
  check("MIT licence at the repository root", /MIT License/i.test(licence));
} catch {
  check("MIT licence at the repository root", false, "LICENSE missing");
}

// 2. Dossier .kiro présent, suivi, jamais ignoré.
const kiroTracked = git(["ls-files", ".kiro"]).split("\n").filter(Boolean);
check(".kiro folder tracked by Git", kiroTracked.length > 0, `${kiroTracked.length} files`);
let ignored = false;
try {
  git(["check-ignore", "-q", ".kiro"]);
  ignored = true;
} catch {
  ignored = false;
}
check(".kiro never ignored", !ignored);

// 3. Journal Kiro.
try {
  const journal = readFileSync("KIRO_JOURNAL.md", "utf8");
  check("KIRO_JOURNAL.md filled", journal.trim().length > 500);
} catch {
  check("KIRO_JOURNAL.md filled", false, "missing");
}

// 4. Les quatre contrôles de la CI.
try {
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  const has = (needle) => ci.includes(needle);
  check(
    "CI has the four controls (types, lint, tests, build)",
    has("pnpm typecheck") && has("pnpm lint") && has("pnpm test:run") && has("pnpm build"),
  );
  check("CI budget respected (timeout-minutes <= 5)", !/timeout-minutes:\s*([6-9]|\d{2,})/.test(ci));
} catch {
  check("CI workflow present", false);
}

// 5. Vocabulaire : la garde passe.
try {
  execFileSync("node", ["scripts/vocabulary-guard.mjs"], { stdio: "pipe" });
  check("Vocabulary guard passes (no Git word in the interface)", true);
} catch {
  check("Vocabulary guard passes (no Git word in the interface)", false);
}

// 6. Chaque propriété SUT-P-01..SUT-P-12 est citée dans un test.
function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(test|prop\.test)\.tsx?$/.test(entry)) files.push(path);
  }
  return files;
}
const testFiles = walk("packages").concat(walk("apps"));
const corpus = testFiles.map((f) => readFileSync(f, "utf8")).join("\n");
for (let index = 1; index <= 12; index += 1) {
  const id = `SUT-P-${String(index).padStart(2, "0")}`;
  check(`${id} covered by a test`, corpus.includes(id));
}

// 7. API GitHub (hors mode hors ligne).
if (!OFFLINE) {
  try {
    const api = (path) =>
      JSON.parse(
        execFileSync("gh", ["api", path], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
      );
    const repo = api(`repos/${REPO}`);
    check("Repository is public", !repo.private);
    check("License detected by GitHub", (repo.license?.spdx_id ?? "") === "MIT", repo.license?.spdx_id ?? "none");
    const created = new Date(repo.created_at).getTime();
    const start = new Date("2026-10-30T16:00:00Z").getTime();
    const end = new Date("2026-12-04T22:00:00Z").getTime();
    check("Repository created inside the submission window", created > start && created < end, repo.created_at);
    const runners = api(`repos/${REPO}/actions/runners`).runners ?? [];
    check("Self-hosted runners registered", runners.length > 0, `${runners.length} runners`);
    notes.push(`${runners.filter((r) => r.status === "online").length} runner(s) online`);
  } catch (error) {
    notes.push(`GitHub API unavailable (${String(error.message).split("\n")[0]})`);
  }
}

console.log("");
for (const note of notes) console.log(`note: ${note}`);
console.log(
  failures.length === 0
    ? "check-contest : OK (tous les points automatisés sont conformes)"
    : `check-contest : ${failures.length} point(s) non conformes`,
);
process.exit(failures.length === 0 ? 0 : 1);
