import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { SutureStore } from "@suture/contracts";
import { fixtureBytes, seededRepo, tempRepo, type TempRepo } from "../test/helpers";

const FILES = [
  "budget-2026.xlsx",
  "budget-2026-paul.xlsx",
  "budget-2026-v2-marie-FINAL.xlsx",
] as const;

type Operation =
  | { kind: "commit"; file: number; scenario?: string }
  | { kind: "restore" }
  | { kind: "scenario"; name: string };

const operationArb: fc.Arbitrary<Operation> = fc.oneof(
  fc.record({
    kind: fc.constant("commit" as const),
    file: fc.integer({ min: 0, max: FILES.length - 1 }),
  }),
  fc.record({ kind: fc.constant("restore" as const) }),
  fc.record({
    kind: fc.constant("scenario" as const),
    name: fc.constantFrom("Paul", "Marie", "Hire", "Delay"),
  }),
);

/** Fingerprint of a version: the sorted list of "path:length:checksum". */
async function fingerprint(store: SutureStore, versionId: string): Promise<string> {
  const parts = await store.getParts(versionId);
  return parts
    .map((part) => {
      let sum = 0;
      for (const byte of part.data) sum = (sum * 31 + byte) % 2_147_483_647;
      return `${part.path}:${part.data.length}:${sum}`;
    })
    .sort()
    .join("|");
}

/** Applies one operation of the generated sequence. */
async function apply(
  repo: TempRepo,
  operation: Operation,
  scenario: string | undefined,
): Promise<string | undefined> {
  if (operation.kind === "commit") {
    const fileName = FILES[operation.file] ?? FILES[0];
    await repo.store.commitVersion({
      file: fixtureBytes(fileName),
      note: `commit ${operation.file}`,
      author: "Nadia",
      scenario,
    });
    return scenario;
  }
  if (operation.kind === "scenario") {
    const head = (await repo.store.listVersions())[0]?.id;
    if (head !== undefined) {
      await repo.store.createScenario(operation.name, head);
      return operation.name;
    }
    return scenario;
  }
  const target = (await repo.store.listVersions())[0]?.id;
  if (target !== undefined) {
    await repo.store.restore(target, "Restored", "Nadia");
  }
  return scenario;
}

/** Every version stays restorable and identically fingerprinted. */
async function checkVersions(
  repo: TempRepo,
  scenario: string | undefined,
  seen: Map<string, string>,
  counts: Map<string, number>,
): Promise<void> {
  for (const name of new Set([scenario ?? "reference", "reference"])) {
    const versions = await repo.store.listVersions(name);
    expect(versions.length).toBeGreaterThanOrEqual(counts.get(name) ?? 0);
    counts.set(name, versions.length);
    for (const version of versions) {
      const mark = await fingerprint(repo.store, version.id);
      const earlier = seen.get(version.id);
      if (earlier === undefined) seen.set(version.id, mark);
      else expect(earlier).toBe(mark);
      const restored = await repo.store.restoreFile(version.id);
      expect(restored.length).toBeGreaterThan(0);
    }
  }
}

describe("SUT-P-12 — every version stays restorable, nothing is ever removed", () => {
  it(
    "holds for any sequence of operations",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(operationArb, { minLength: 1, maxLength: 5 }),
          async (operations) => {
            const repo = tempRepo();
            try {
              await repo.store.init("budget-2026.xlsx");
              await repo.store.commitVersion({
                file: fixtureBytes(FILES[0]),
                note: "Original",
                author: "Nadia",
              });
              const seen = new Map<string, string>();
              const counts = new Map<string, number>();
              let scenario: string | undefined;
              for (const operation of operations) {
                scenario = await apply(repo, operation, scenario);
                await checkVersions(repo, scenario, seen, counts);
              }
            } finally {
              repo.cleanup();
            }
          },
        ),
        { numRuns: 12 },
      );
    },
    120_000,
  );
});
describe("restore is additive (SUT-F-27)", () => {
  it("adds a version and keeps every previous one", async () => {
    const repo = await seededRepo();
    try {
      const first = (await repo.store.listVersions())[0]?.id ?? "";
      await repo.store.commitVersion({
        file: fixtureBytes("budget-2026-paul.xlsx"),
        note: "Paul",
        author: "Paul",
      });
      const before = await repo.store.listVersions();
      await repo.store.restore(first, "Back to the original", "Nadia");
      const after = await repo.store.listVersions();

      expect(after).toHaveLength(before.length + 1);
      for (const version of before) {
        expect(after.map((item) => item.id)).toContain(version.id);
      }
      const restored = await repo.store.getParts(after[0]?.id ?? "");
      const original = await repo.store.getParts(first);
      expect(restored.map((part) => part.path)).toEqual(original.map((part) => part.path));
    } finally {
      repo.cleanup();
    }
  });
});
