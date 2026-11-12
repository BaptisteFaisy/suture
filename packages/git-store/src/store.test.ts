import { execFileSync } from "node:child_process";
import { unzipSync } from "fflate";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { deriveCanonical } from "@suture/canonical";
import { readWorkbook, zipParts } from "@suture/ooxml-io";
import { fixtureBytes, seededRepo, type TempRepo } from "../test/helpers";

const repos: TempRepo[] = [];

function keep(repo: TempRepo): TempRepo {
  repos.push(repo);
  return repo;
}

afterAll(() => {
  for (const repo of repos) repo.cleanup();
});

describe("versions (SUT-F-02, SUT-F-03)", () => {
  it("records the first version of a tracked workbook", async () => {
    const repo = keep(await seededRepo());
    const versions = await repo.store.listVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ note: "Original budget", author: "Nadia", scenario: "reference" });
    expect(versions[0]?.parents).toEqual([]);
  });

  it("creates no version when the dropped file is identical", async () => {
    const repo = keep(await seededRepo());
    const outcome = await repo.store.commitVersion({
      file: fixtureBytes("budget-2026.xlsx"),
      note: "Same file again",
      author: "Nadia",
    });
    expect(outcome.unchanged).toBe(true);
    expect(await repo.store.listVersions()).toHaveLength(1);
  });

  it("records a new version when the file changed", async () => {
    const repo = keep(await seededRepo());
    const outcome = await repo.store.commitVersion({
      file: fixtureBytes("budget-2026-paul.xlsx"),
      note: "Paul's copy",
      author: "Paul",
    });
    expect(outcome.version).toBeDefined();
    const versions = await repo.store.listVersions();
    expect(versions).toHaveLength(2);
    expect(versions[0]?.note).toBe("Paul's copy");
  });
});

describe("fidelity (SUT-F-05, SUT-P-12)", () => {
  it("restores every part byte for byte", async () => {
    const repo = keep(await seededRepo());
    const versions = await repo.store.listVersions();
    const id = versions[0]?.id ?? "";
    const original = readWorkbook(fixtureBytes("budget-2026.xlsx")).parts;
    const stored = await repo.store.getParts(id);

    expect(stored.map((part) => part.path)).toEqual(original.map((part) => part.path));
    for (let index = 0; index < original.length; index += 1) {
      expect(Buffer.from(stored[index]?.data ?? [])).toEqual(Buffer.from(original[index]?.data ?? []));
    }
  });

  it("re-reads a restored file into the same canonical view", async () => {
    const repo = keep(await seededRepo());
    const id = (await repo.store.listVersions())[0]?.id ?? "";
    const restored = await repo.store.restoreFile(id);
    const reread = readWorkbook(restored).parts;
    const canonicalFromStore = await repo.store.getCanonical(id);
    expect(deriveCanonical(reread)).toEqual(canonicalFromStore);
  });

  it("writes the canonical cell view next to the parts", async () => {
    const repo = keep(await seededRepo());
    const id = (await repo.store.listVersions())[0]?.id ?? "";
    const canonical = await repo.store.getCanonical(id);
    expect(canonical.sheets.length).toBeGreaterThan(0);
    const first = canonical.sheets[0];
    expect(first?.cells.length ?? 0).toBeGreaterThan(0);
    expect(zipParts(await repo.store.getParts(id)).length).toBeGreaterThan(0);
  });
});

describe("scenarios and milestones (SUT-F-16, SUT-F-28)", () => {
  it("keeps the reference untouched when a scenario advances", async () => {
    const repo = keep(await seededRepo());
    const head = (await repo.store.listVersions())[0]?.id ?? "";
    await repo.store.createScenario("Paul", head);
    await repo.store.commitVersion({
      file: fixtureBytes("budget-2026-paul.xlsx"),
      note: "Paul's copy",
      author: "Paul",
      scenario: "Paul",
    });

    expect(await repo.store.listVersions("reference")).toHaveLength(1);
    expect(await repo.store.listVersions("Paul")).toHaveLength(2);
    const scenarios = await repo.store.listScenarios();
    expect(scenarios[0]).toMatchObject({ name: "reference", reference: true });
    expect(scenarios.map((item) => item.name)).toContain("Paul");
  });

  it("names a version with a milestone", async () => {
    const repo = keep(await seededRepo());
    const id = (await repo.store.listVersions())[0]?.id ?? "";
    await repo.store.setMilestone(id, "budget-voted");
    const versions = await repo.store.listVersions();
    expect(versions[0]?.milestone).toBe("budget-voted");
  });
});

describe("combines and restores (SUT-F-23, SUT-F-27)", () => {
  it("records a combine as a version with two origins", async () => {
    const repo = keep(await seededRepo());
    const head = (await repo.store.listVersions())[0]?.id ?? "";
    await repo.store.createScenario("Paul", head);
    await repo.store.commitVersion({
      file: fixtureBytes("budget-2026-paul.xlsx"),
      note: "Paul",
      author: "Paul",
      scenario: "Paul",
    });
    await repo.store.createScenario("Marie", head);
    await repo.store.commitVersion({
      file: fixtureBytes("budget-2026-v2-marie-FINAL.xlsx"),
      note: "Marie",
      author: "Marie",
      scenario: "Marie",
    });

    const paul = (await repo.store.listVersions("Paul"))[0]?.id ?? "";
    const marie = (await repo.store.listVersions("Marie"))[0]?.id ?? "";
    const outcome = await repo.store.commitCombine({
      file: fixtureBytes("budget-2026-paul.xlsx"),
      note: "Combined Paul and Marie",
      author: "Nadia",
      parents: [paul, marie],
      report: "- applied: Budget!B2",
    });

    expect(outcome.version?.parents).toHaveLength(2);
    const versions = await repo.store.listVersions("reference");
    expect(versions[0]?.parents).toEqual([paul, marie]);
    expect(versions[0]?.note).toContain("Combined Paul and Marie");
  });

  it("restores a past version without erasing any version", async () => {
    const repo = keep(await seededRepo());
    const first = (await repo.store.listVersions())[0]?.id ?? "";
    await repo.store.commitVersion({
      file: fixtureBytes("budget-2026-paul.xlsx"),
      note: "Paul's copy",
      author: "Paul",
    });
    const before = (await repo.store.listVersions()).length;

    const restored = await repo.store.restore(first, "Back to the original", "Nadia");
    const versions = await repo.store.listVersions();

    expect(versions).toHaveLength(before + 1);
    expect(versions[0]?.id).toBe(restored.id);
    const parts = await repo.store.getParts(restored.id);
    const original = await repo.store.getParts(first);
    expect(parts.map((part) => part.path)).toEqual(original.map((part) => part.path));
  });
});

describe("cell history (SUT-F-26)", () => {
  it("lists the versions where a cell's input changed", async () => {
    const repo = keep(await seededRepo());
    const canonical = await repo.store.getCanonical((await repo.store.listVersions())[0]?.id ?? "");
    const sheetId = canonical.sheets[0]?.meta.sheetId ?? 1;
    const ref = canonical.sheets[0]?.cells[0]?.ref ?? "A1";

    await repo.store.commitVersion({
      file: fixtureBytes("budget-2026-paul.xlsx"),
      note: "Paul's copy",
      author: "Paul",
    });
    const history = await repo.store.cellHistory(sheetId, ref);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty("author");
    expect(history[0]).toHaveProperty("note");
  });
});

describe("export (SUT-F-29)", () => {
  it("produces an archive that Git can clone", async () => {
    const repo = keep(await seededRepo());
    const bundle = await repo.store.exportBundle();
    expect(bundle.length).toBeGreaterThan(0);

    const target = fs.mkdtempSync(path.join(os.tmpdir(), "suture-export-"));
    repos.push({ dir: target, store: repo.store, cleanup: () => fs.rmSync(target, { recursive: true, force: true }) });
    const files = unzipSync(bundle);
    for (const [name, data] of Object.entries(files)) {
      const full = path.join(target, name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, data as Uint8Array);
    }

    const log = execFileSync("git", ["--git-dir", target, "log", "--oneline"], { encoding: "utf8" });
    expect(log).toContain("Original budget");
    const cells = execFileSync(
      "git",
      ["--git-dir", target, "log", "-p", "--", "cells/"],
      { encoding: "utf8" },
    );
    expect(cells.length).toBeGreaterThan(0);
  });
});
