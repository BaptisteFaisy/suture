import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { workspaceAliases } from "../../scripts/workspace-aliases.mjs";

// GitHub Pages serves the app under /suture/.
export default defineConfig({
  base: "/suture/",
  plugins: [react()],
  resolve: {
    alias: workspaceAliases(),
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
