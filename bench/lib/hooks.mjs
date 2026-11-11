/**
 * Loader hooks — lets plain Node run the TypeScript sources of the workspace.
 *
 * The monorepo has no per-package build step: `@suture/*` is consumed as
 * TypeScript sources (see `scripts/workspace-aliases.mjs`). To measure the real
 * engines from a plain `.mjs` script, this module installs two hooks:
 *
 * - `resolve`: maps `@suture/<name>` to `packages/<name>/src/index.ts` and adds
 *   the `.ts` extension the sources omit on relative imports;
 * - `load`: transpiles the TypeScript sources with the TypeScript compiler
 *   already in the repository's devDependencies (no new dependency).
 *
 * Node's own type stripping cannot be used: it only accepts erasable syntax and
 * `packages/canonical/src/xml.ts` uses a constructor parameter property.
 */
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TS_FORMAT = "ts-source";

/** Maps a workspace package name to the path of its entry point. */
function packageEntry(name) {
  return resolvePath(ROOT, "packages", name, "src", "index.ts");
}

/** Resolves a relative import of a TypeScript source to an existing file. */
function resolveRelative(specifier, parentURL) {
  const base = dirname(fileURLToPath(parentURL));
  const candidates = [resolvePath(base, `${specifier}.ts`), resolvePath(base, specifier, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@suture/")) {
      const entry = packageEntry(specifier.slice("@suture/".length));
      return { url: pathToFileURL(entry).href, shortCircuit: true, format: TS_FORMAT };
    }
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const found = resolveRelative(specifier, context.parentURL);
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true, format: TS_FORMAT };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    // Tout `.ts` passe par le transpilateur du dépôt : la syntaxe non effaçable
    // (paramètres de constructeur, énumérations) existe dans les sources.
    if (context.format !== TS_FORMAT && !url.endsWith(".ts")) return nextLoad(url, context);
    const source = readFileSync(fileURLToPath(url), "utf8");
    const output = ts.transpileModule(source, {
      fileName: url,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    return { format: "module", source: output.outputText, shortCircuit: true };
  },
});
