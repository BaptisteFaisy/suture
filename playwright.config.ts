import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration for Suture.
 * Runs against the built static app (`apps/web/dist`) via Vite preview.
 * Runs on `main` only (dedicated workflow, outside PR CI budget).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173/suture/",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm --filter @suture/web preview --port 4173",
    url: "http://localhost:4173/suture/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
