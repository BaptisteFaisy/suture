import { describe, expect, it } from "vitest";
import {
  canBuildReport,
  checkWorkbookFile,
  groupReport,
  guessKind,
  openDisagreements,
  pendingFallbacks,
  reportLineText,
  reportToText,
  scenarioNameFromFile,
  typedContent,
  type CombineState,
} from "./combine-model";

/** A combine state with one open disagreement and one refused sheet. */
function sampleState(): CombineState {
  return {
    automatic: [{ sheetName: "Budget", ref: "B2", value: "12000", source: "A" }],
    disagreements: [
      { id: "d1", sheetName: "Budget", ref: "B7", base: "11000", a: "12000", b: "13500" },
    ],
    fallbacks: [{ sheetName: "Hypotheses" }],
    choices: {},
    report: [],
    ready: false,
  };
}

describe("openDisagreements", () => {
  it("counts a disagreement without answer", () => {
    expect(openDisagreements(sampleState())).toHaveLength(1);
  });

  it("drops the disagreement once answered", () => {
    const state = sampleState();
    state.choices.d1 = { id: "d1", pick: "A" };
    expect(openDisagreements(state)).toHaveLength(0);
  });
});

describe("pendingFallbacks", () => {
  it("lists a refused sheet with no side kept", () => {
    expect(pendingFallbacks(sampleState(), {})).toHaveLength(1);
  });

  it("accepts a side chosen by the user", () => {
    expect(pendingFallbacks(sampleState(), { Hypotheses: "B" })).toHaveLength(0);
  });
});

describe("canBuildReport", () => {
  it("refuses while a disagreement is open", () => {
    expect(canBuildReport(sampleState(), { Hypotheses: "B" })).toBe(false);
  });

  it("refuses while a refused sheet has no side", () => {
    const state = sampleState();
    state.choices.d1 = { id: "d1", pick: "A" };
    expect(canBuildReport(state, {})).toBe(false);
  });

  it("accepts when everything is answered and kept", () => {
    const state = sampleState();
    state.choices.d1 = { id: "d1", pick: "A" };
    expect(canBuildReport(state, { Hypotheses: "B" })).toBe(true);
  });
});

describe("groupReport", () => {
  it("splits the lines into the four sections", () => {
    const sections = groupReport([
      { category: "applied", side: "A", sheetName: "Budget", ref: "B2", label: "salary" },
      { category: "decided", side: "B", sheetName: "Budget", ref: "B7", label: "rent" },
      { category: "not-carried", side: "both", sheetName: "Graph", label: "chart" },
      { category: "to-review", side: "A", sheetName: "Budget", ref: "B9", label: "total" },
    ]);
    expect(sections.applied).toHaveLength(1);
    expect(sections.decided).toHaveLength(1);
    expect(sections.notCarried).toHaveLength(1);
    expect(sections.toReview).toHaveLength(1);
  });
});

describe("report text", () => {
  const labels = { a: "Version A", b: "Version B", both: "Both sides" };

  it("names the sheet, the cell and the side of a line", () => {
    const text = reportLineText(
      { category: "applied", side: "A", sheetName: "Budget", ref: "B2", label: "salary" },
      labels,
    );
    expect(text).toContain("Budget");
    expect(text).toContain("B2");
    expect(text).toContain("Version A");
    expect(text).toContain("salary");
  });

  it("writes one block per section", () => {
    const text = reportToText(
      [{ category: "applied", side: "A", sheetName: "Budget", ref: "B2", label: "salary" }],
      { applied: "Applied", decided: "Settled", notCarried: "Not carried", toReview: "To check" },
      labels,
    );
    expect(text).toContain("Applied (1)");
    expect(text).toContain("Settled (0)");
  });
});

describe("typed values", () => {
  it("guesses the kind of a cell", () => {
    expect(guessKind("12000")).toBe("n");
    expect(guessKind("=SUM(A1:A2)")).toBe("f");
    expect(guessKind("rent")).toBe("s");
  });

  it("builds the cell content of a typed value", () => {
    const record = typedContent("B7", "12000");
    expect(record.ref).toBe("B7");
    expect(record.input).toBe("12000");
    expect(record.kind).toBe("n");
  });
});

describe("workbook files", () => {
  it("accepts a workbook", () => {
    expect(checkWorkbookFile({ name: "budget_2026.xlsx", size: 1000 })).toBeNull();
  });

  it("refuses a file that is not a workbook", () => {
    expect(checkWorkbookFile({ name: "notes.txt", size: 1000 })).toBe("type");
  });

  it("refuses a workbook that is too large", () => {
    expect(checkWorkbookFile({ name: "big.xlsx", size: 60 * 1024 * 1024 })).toBe("size");
  });
});

describe("scenarioNameFromFile", () => {
  it("builds a readable name from a file name", () => {
    expect(scenarioNameFromFile("budget_paul.xlsx")).toBe("budget paul");
  });

  it("never returns an empty name", () => {
    expect(scenarioNameFromFile(".xlsx")).not.toBe("");
  });
});
