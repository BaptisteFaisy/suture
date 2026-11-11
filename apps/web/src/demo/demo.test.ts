import { describe, expect, it, vi } from "vitest";
import {
  DEMO_NOT_PUBLISHED,
  DEMO_WORKBOOK_PATHS,
  DemoNotPublishedError,
  demoFileName,
  fetchDemoWorkbook,
  loadDemoWorkbook,
  type DemoStore,
} from "./demo";

/** A fake fetch that answers with a small blob for every known path. */
function publishedFetch(): typeof fetch {
  return vi.fn(async () =>
    ({
      ok: true,
      blob: async () => new Blob(["xlsx-bytes"], { type: "application/octet-stream" }),
    }) as unknown as Response,
  );
}

/** A fake fetch that answers 404: the demo is not published yet. */
function missingFetch(): typeof fetch {
  return vi.fn(
    async () => ({ ok: false, status: 404 }) as unknown as Response,
  );
}

/** A store that records the workbooks it was asked to track, in order. */
function recordingStore(): DemoStore & { tracked: string[] } {
  const tracked: string[] = [];
  return {
    tracked,
    trackFile: async (file: File) => {
      tracked.push(file.name);
    },
  };
}

describe("the demo trio (SUT-F-31)", () => {
  it("publishes the three workbooks of the demo case", () => {
    expect(DEMO_WORKBOOK_PATHS).toEqual([
      "/suture/demo/budget-2026.xlsx",
      "/suture/demo/budget-2026-paul.xlsx",
      "/suture/demo/budget-2026-v2-marie-FINAL.xlsx",
    ]);
  });

  it("names a file after its published path", () => {
    expect(demoFileName("/suture/demo/budget-2026.xlsx")).toBe("budget-2026.xlsx");
  });
});

describe("loadDemoWorkbook", () => {
  it("tracks the three workbooks in order", async () => {
    const store = recordingStore();
    const count = await loadDemoWorkbook(store, publishedFetch());
    expect(count).toBe(3);
    expect(store.tracked).toEqual([
      "budget-2026.xlsx",
      "budget-2026-paul.xlsx",
      "budget-2026-v2-marie-FINAL.xlsx",
    ]);
  });

  it("fetches each workbook once, from the published path", async () => {
    const fetchImpl = publishedFetch();
    await loadDemoWorkbook(recordingStore(), fetchImpl);
    const calls = (fetchImpl as unknown as { mock: { calls: string[][] } }).mock.calls;
    expect(calls.map((call) => call[0])).toEqual([...DEMO_WORKBOOK_PATHS]);
  });

  it("says clearly when the demo workbook is not published yet", async () => {
    await expect(
      loadDemoWorkbook(recordingStore(), missingFetch()),
    ).rejects.toThrow(DEMO_NOT_PUBLISHED);
  });

  it("tracks nothing when the first workbook is missing", async () => {
    const store = recordingStore();
    await expect(loadDemoWorkbook(store, missingFetch())).rejects.toBeInstanceOf(
      DemoNotPublishedError,
    );
    expect(store.tracked).toEqual([]);
  });

  it("says the same thing when the network itself fails", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      fetchDemoWorkbook(DEMO_WORKBOOK_PATHS[0]!, failing as unknown as typeof fetch),
    ).rejects.toThrow(DEMO_NOT_PUBLISHED);
  });

  it("keeps the offending path on the error", async () => {
    try {
      await fetchDemoWorkbook("/suture/demo/budget-2026.xlsx", missingFetch());
      expect.unreachable();
    } catch (error) {
      expect((error as DemoNotPublishedError).path).toBe(
        "/suture/demo/budget-2026.xlsx",
      );
    }
  });
});
