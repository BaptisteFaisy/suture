/**
 * End-to-end integration of the demo scenario, through the real engines:
 * track the original, create two scenarios from the copies received by email,
 * combine them, decide the single disagreement, patch the carrier and read the
 * combined workbook back.
 *
 * This is the flow the video shows. It runs on the real file system, so it
 * needs no browser.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deriveCanonical } from "@suture/canonical";
import type { CanonicalWorkbook, MergePlan, SutureStore } from "@suture/contracts";
import { createSutureStore } from "@suture/git-store";
import { planMerge, resolveMerge } from "@suture/merge";
import { readWorkbook, zipParts } from "@suture/ooxml-io";
import { patchWorkbook } from "@suture/ooxml-patch";

const FIXTURES = path.resolve(import.meta.dirname, "../fixtures/generated");
const directories: string[] = [];

function bytes(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)));
}

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suture-demo-"));
  directories.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of directories) fs.rmSync(dir, { recursive: true, force: true });
});

/** The three versions of the demo case, as the assistant would create them. */
interface DemoSession {
  store: SutureStore;
  origin: string;
  paul: string;
  marie: string;
}

async function seedDemo(): Promise<DemoSession> {
  const store = createSutureStore({ fs: fs as never, dir: tempDir(), author: "Nadia" });
  await store.init("budget-2026.xlsx");
  await store.commitVersion({ file: bytes("budget-2026.xlsx"), note: "Original budget", author: "Nadia" });
  const origin = (await store.listVersions())[0]?.id ?? "";

  for (const [name, file, author] of [
    ["Paul", "budget-2026-paul.xlsx", "Paul"],
    ["Marie", "budget-2026-v2-marie-FINAL.xlsx", "Marie"],
  ] as const) {
    await store.createScenario(name, origin);
    await store.commitVersion({ file: bytes(file), note: `${author}'s copy`, author, scenario: name });
  }

  return {
    store,
    origin,
    paul: (await store.listVersions("Paul"))[0]?.id ?? "",
    marie: (await store.listVersions("Marie"))[0]?.id ?? "",
  };
}

/** Runs the whole combine of the demo case and returns what the checks need. */
async function combineDemo() {
  const [originView, paulView, marieView] = await Promise.all([
    demo.store.getCanonical(demo.origin),
    demo.store.getCanonical(demo.paul),
    demo.store.getCanonical(demo.marie),
  ]);
  const plan: MergePlan = planMerge(originView, paulView, marieView);
  const resolved = resolveMerge(
    plan,
    plan.disagreements.map((item) => ({ id: item.id, pick: "B" as const })),
  );

  const carrierId = plan.carrier === "A" ? demo.paul : demo.marie;
  const carrierParts = await demo.store.getParts(carrierId);
  const carrierView: CanonicalWorkbook = await demo.store.getCanonical(carrierId);
  const sheetPaths = new Map<number, string>();
  for (const sheet of carrierView.meta.sheets) sheetPaths.set(sheet.sheetId, sheet.path);

  const patched = patchWorkbook(carrierParts, {
    patches: resolved.patches,
    sheetPaths,
    originMarker: { versionId: carrierId, scenario: plan.carrier },
  });
  const combined = zipParts(patched.parts);
  // Fumée LibreOffice (cahier B.11) : quand le script appelant le demande,
  // le classeur réuni est écrit sur disque pour être ouvert par la suite
  // bureautique libre (job `soffice-smoke` de la CI).
  if (process.env.SUTURE_COMBINED_OUT) {
    fs.writeFileSync(process.env.SUTURE_COMBINED_OUT, combined);
  }
  return {
    plan,
    combined,
    combinedView: deriveCanonical(readWorkbook(combined).parts),
    decided: resolved.patches.find((patch) => patch.ref === "B5"),
    workbookXml: new TextDecoder().decode(
      patched.parts.find((part) => part.path === "xl/workbook.xml")?.data ?? new Uint8Array(),
    ),
  };
}

let demo: DemoSession;

beforeAll(async () => {
  demo = await seedDemo();
}, 60_000);

describe("the demo scenario, end to end", () => {
  it("tracks the original and keeps the two copies as scenarios", async () => {
    const scenarios = await demo.store.listScenarios();
    expect(scenarios.map((item) => item.name).sort()).toEqual(["Marie", "Paul", "reference"]);
    // The reference never moved: it still holds the single original version.
    expect(await demo.store.listVersions("reference")).toHaveLength(1);
    expect(await demo.store.listVersions("Paul")).toHaveLength(2);
    expect(demo.origin.length).toBeGreaterThan(0);
  });

  it("finds exactly the disagreement of the brief", async () => {
    const [originView, paulView, marieView] = await Promise.all([
      demo.store.getCanonical(demo.origin),
      demo.store.getCanonical(demo.paul),
      demo.store.getCanonical(demo.marie),
    ]);
    const plan = planMerge(originView, paulView, marieView);

    expect(plan.fallbacks).toHaveLength(0);
    expect(plan.disagreements).toHaveLength(1);
    expect(plan.disagreements[0]).toMatchObject({
      ref: "B5",
      base: { input: "60000" },
      a: { input: "61000" },
      b: { input: "62000" },
    });
    // Paul's added row is carried by his file (the carrier), Marie's assumption
    // change is applied automatically.
    expect(plan.patches.length).toBeGreaterThan(0);
  }, 60_000);

  it("patches the carrier and produces a workbook that reads back", async () => {
    const { combinedView, decided, workbookXml } = await combineDemo();
    expect(combinedView.sheets.length).toBeGreaterThan(0);

    // The value Nadia decided for is the one in the combined workbook.
    const budget = combinedView.sheets.find((sheet) => sheet.meta.name === "Budget");
    expect(budget?.cells.find((cell) => cell.ref === "B5")?.input).toBe(decided?.record?.input);

    // The combined file asks the spreadsheet to recalculate when it opens.
    expect(workbookXml).toContain("fullCalcOnLoad");
  }, 60_000);

  it("records the combine as a version with two origins and exports a repository", async () => {
    const carrierId = demo.paul;
    const outcome = await demo.store.commitCombine({
      file: await demo.store.restoreFile(carrierId),
      note: "Combined Paul and Marie",
      author: "Nadia",
      parents: [demo.paul, demo.marie],
      report: "- decided: Budget!B5",
    });
    expect(outcome.version?.parents).toHaveLength(2);

    const bundle = await demo.store.exportBundle();
    expect(bundle.length).toBeGreaterThan(0);
  }, 60_000);
});
