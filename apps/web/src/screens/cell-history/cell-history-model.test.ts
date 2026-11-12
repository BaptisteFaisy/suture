import { describe, expect, it } from "vitest";
import {
  buildHistoryRows,
  formatDate,
  formatValue,
  historyCount,
  isEmptyHistory,
  type HistoryEntry,
} from "./cell-history-model";

/** One change of a cell. */
function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    versionId: "v1",
    author: "Nadia",
    timestamp: Date.UTC(2026, 10, 9, 10, 30),
    note: "Before the board meeting",
    before: { ref: "B7", kind: "n", input: "11000", cached: "", fmt: "" },
    after: { ref: "B7", kind: "n", input: "12000", cached: "", fmt: "" },
    ...overrides,
  };
}

describe("formatDate", () => {
  it("writes the date in English", () => {
    expect(formatDate(Date.UTC(2026, 10, 9, 10, 30), "en")).toContain("2026");
  });

  it("writes the date in French", () => {
    expect(formatDate(Date.UTC(2026, 10, 9, 10, 30), "fr")).toContain("2026");
  });
});

describe("formatValue", () => {
  it("writes the typed value", () => {
    expect(formatValue({ ref: "B7", kind: "n", input: "12000", cached: "", fmt: "" }, "none")).toBe(
      "12000",
    );
  });

  it("writes the empty wording when the cell is empty", () => {
    expect(formatValue(null, "none")).toBe("none");
  });
});

describe("buildHistoryRows", () => {
  it("lists the newest change first", () => {
    const rows = buildHistoryRows(
      [
        entry({ versionId: "v1", timestamp: Date.UTC(2026, 0, 1) }),
        entry({ versionId: "v2", timestamp: Date.UTC(2026, 10, 9) }),
      ],
      "en",
      "none",
    );
    expect(rows[0]?.versionId).toBe("v2");
    expect(rows[1]?.versionId).toBe("v1");
  });

  it("keeps the author, the note and the values", () => {
    const rows = buildHistoryRows([entry()], "en", "none");
    const row = rows[0];
    expect(row?.author).toBe("Nadia");
    expect(row?.note).toBe("Before the board meeting");
    expect(row?.before).toBe("11000");
    expect(row?.after).toBe("12000");
  });
});

describe("isEmptyHistory", () => {
  it("is true with no entry", () => {
    expect(isEmptyHistory(null)).toBe(true);
    expect(isEmptyHistory([])).toBe(true);
  });

  it("is false with one entry", () => {
    expect(isEmptyHistory([entry()])).toBe(false);
  });
});

describe("historyCount", () => {
  it("counts the changes", () => {
    expect(historyCount([entry(), entry({ versionId: "v2" })])).toBe(2);
    expect(historyCount(null)).toBe(0);
  });
});
