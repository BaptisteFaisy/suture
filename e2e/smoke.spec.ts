import { expect, test } from "@playwright/test";

test.describe("Suture end-to-end suite", () => {
  test("home screen renders the title, the drop zone and the demo button", async ({
    page,
  }) => {
    await page.goto("/suture/");
    await expect(page).toHaveTitle(/Suture/);
    await expect(page.locator("h1")).toHaveText("Suture");
    await expect(page.locator(".tagline")).toBeVisible();
    await expect(page.locator(".dropzone")).toBeVisible();
    await expect(page.locator(".demo-button")).toBeVisible();
  });

  test("language switch toggles English and French across the interface", async ({
    page,
  }) => {
    await page.goto("/suture/");
    const select = page.locator(".lang-picker select");
    await select.selectOption("fr");
    await expect(page.locator("#workbooks-title")).toHaveText("Classeurs suivis");
    await expect(page.locator(".dropzone-title")).toHaveText("Déposez un classeur ici");

    await select.selectOption("en");
    await expect(page.locator("#workbooks-title")).toHaveText("Tracked workbooks");
    await expect(page.locator(".dropzone-title")).toHaveText("Drop a workbook here");
  });

  test("navigation to settings and back works without a page reload", async ({
    page,
  }) => {
    await page.goto("/suture/");
    await page.click('nav button:has-text("Settings"), nav button:has-text("Réglages")');
    await expect(page.locator("#settings-title")).toBeVisible();

    await page.click('header .brand-button, nav button:has-text("Home"), nav button:has-text("Accueil")');
    await expect(page.locator("#workbooks-title")).toBeVisible();
  });

  test("demo assets are reachable over HTTP and match expected sizes", async ({
    page,
  }) => {
    for (const file of [
      "budget-2026.xlsx",
      "budget-2026-paul.xlsx",
      "budget-2026-v2-marie-FINAL.xlsx",
    ]) {
      const response = await page.request.get(`/suture/demo/${file}`);
      expect(response.status()).toBe(200);
      const buffer = await response.body();
      expect(buffer.length).toBeGreaterThan(3000);
    }
  });

  test("no network request leaves the origin after page load", async ({
    page,
  }) => {
    const foreignRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        foreignRequests.push(request.url());
      }
    });

    await page.goto("/suture/");
    await page.waitForLoadState("networkidle");
    expect(foreignRequests).toEqual([]);
  });
});
