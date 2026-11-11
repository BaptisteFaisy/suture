import { defineConfig } from "vitest/config";
import { workspaceAliases } from "./scripts/workspace-aliases.mjs";

export default defineConfig({
  resolve: {
    alias: workspaceAliases(),
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "apps/web/src/**/*.test.{ts,tsx}",
    ],
    environment: "node",
    passWithNoTests: true,
    testTimeout: 20_000,
  },
});
