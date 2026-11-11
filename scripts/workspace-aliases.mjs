// Single source of truth for @suture/* → source aliases.
// Used by vitest.config.ts (root) and apps/web/vite.config.ts so that all
// packages are consumed as TypeScript sources (no per-package build step).
// Keep in sync with tsconfig.base.json "paths".
import { fileURLToPath } from "node:url";

export const PACKAGE_NAMES = [
  "contracts",
  "formula",
  "ooxml-io",
  "canonical",
  "diff",
  "merge",
  "ooxml-patch",
  "git-store",
  "ui",
];

export function workspaceAliases() {
  const aliases = {};
  for (const name of PACKAGE_NAMES) {
    aliases[`@suture/${name}`] = fileURLToPath(
      new URL(`../packages/${name}/src/index.ts`, import.meta.url),
    );
  }
  return aliases;
}
