// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { SutureStore } from "@suture/contracts";
import type { Engines, HostPorts } from "./ports";
import type { SessionState } from "./actions";
import { exportWorkbook } from "./finalize";
import {
  daysSinceExport,
  EXPORT_REMINDER_DAYS,
  isExportOverdue,
  LAST_EXPORT_KEY,
  readLastExport,
  writeLastExport,
  type SettingsStore,
} from "./export-reminder";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 26, 9, 0, 0);

function memorySettings(): SettingsStore {
  const values = new Map<string, string>();
  return {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("the export reminder rule (SUT-N-05)", () => {
  it("stays quiet when nothing was ever exported", () => {
    expect(readLastExport(memorySettings())).toBeNull();
    expect(isExportOverdue(null, NOW)).toBe(false);
    expect(daysSinceExport(null, NOW)).toBeNull();
  });

  it("remembers the moment of the last export under its key", () => {
    const settings = memorySettings();
    writeLastExport(settings, NOW);
    expect(LAST_EXPORT_KEY).toBe("suture.lastExport");
    expect(settings.get(LAST_EXPORT_KEY)).toBe(String(NOW));
    expect(readLastExport(settings)).toBe(NOW);
  });

  it("reminds once the last export is older than thirty days", () => {
    expect(EXPORT_REMINDER_DAYS).toBe(30);
    expect(isExportOverdue(NOW - 29 * DAY_MS, NOW)).toBe(false);
    expect(isExportOverdue(NOW - 30 * DAY_MS, NOW)).toBe(false);
    expect(isExportOverdue(NOW - 30 * DAY_MS - 1, NOW)).toBe(true);
    expect(isExportOverdue(NOW - 31 * DAY_MS, NOW)).toBe(true);
  });

  it("counts whole days since the last export", () => {
    expect(daysSinceExport(NOW - 31 * DAY_MS, NOW)).toBe(31);
    expect(daysSinceExport(NOW - 1_000, NOW)).toBe(0);
  });

  it("ignores a value that is not a date", () => {
    const settings = memorySettings();
    settings.set(LAST_EXPORT_KEY, "not a date");
    expect(readLastExport(settings)).toBeNull();
    expect(isExportOverdue(readLastExport(settings), NOW)).toBe(false);
  });

  it("does not nag when the clock went backwards", () => {
    expect(isExportOverdue(NOW + DAY_MS, NOW)).toBe(false);
    expect(daysSinceExport(NOW + DAY_MS, NOW)).toBe(0);
  });
});

describe("the export stamps its date (SUT-N-05)", () => {
  it("writes the moment of the export when the archive is offered", async () => {
    const settings = memorySettings();
    const downloaded: string[] = [];
    const host: HostPorts = {
      download: (fileName) => {
        downloaded.push(fileName);
      },
      now: () => NOW,
      fetchDemoFile: async () => new Uint8Array(),
      settings,
    };
    const store = {
      exportBundle: async () => new Uint8Array([1, 2, 3]),
    } as unknown as SutureStore;
    const session = { store } as unknown as SessionState;

    await exportWorkbook({ engines: {} as Engines, host }, session, "budget-2026.xlsx");

    expect(downloaded).toEqual(["budget-2026-suture.zip"]);
    expect(readLastExport(settings)).toBe(NOW);
    expect(isExportOverdue(readLastExport(settings), NOW + 31 * DAY_MS)).toBe(true);
  });

  it("stamps nothing when no workbook is open", async () => {
    const settings = memorySettings();
    const host: HostPorts = {
      download: () => undefined,
      now: () => NOW,
      fetchDemoFile: async () => new Uint8Array(),
      settings,
    };
    const session = { store: null } as unknown as SessionState;

    await exportWorkbook({ engines: {} as Engines, host }, session, "budget.xlsx");

    expect(readLastExport(settings)).toBeNull();
  });
});
