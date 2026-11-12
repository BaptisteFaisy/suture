// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { GROUP_SEPARATOR } from "@suture/ui";
import { LangContext, type Lang } from "../../i18n/lang";
import {
  StoreContext,
  type ComparisonRow,
  type ComparisonView,
  type StoreAdapter,
  type VersionSummary,
} from "../../store";
import { CompareScreen } from "./CompareScreen";

const ROWS: ComparisonRow[] = [
  { sheetId: 1, ref: "B7", nature: "input", before: "12000", after: "13500" },
  { sheetId: 1, ref: "B9", nature: "input", before: "5", after: "6" },
  { sheetId: 1, ref: "B14", nature: "consequence", before: "120000", after: "131500" },
  { sheetId: 2, ref: "C3", nature: "format", before: "#,##0", after: "#,##0 EUR" },
];

/** The counts of the contract summary, never recomputed by the screen. */
const VIEW: ComparisonView = {
  rows: ROWS,
  summary: {
    inputsModified: 2,
    consequences: 1,
    formats: 1,
    rowsInserted: 1,
    rowsDeleted: 0,
    colsInserted: 0,
    colsDeleted: 0,
    partsChanged: 0,
  },
  otherParts: ["Chart 1"],
  filter: { sheetId: "all", nature: "all" },
};

const IDENTICAL: ComparisonView = {
  rows: [],
  summary: {
    inputsModified: 0,
    consequences: 0,
    formats: 0,
    rowsInserted: 0,
    rowsDeleted: 0,
    colsInserted: 0,
    colsDeleted: 0,
    partsChanged: 0,
  },
  otherParts: [],
  filter: { sheetId: "all", nature: "all" },
};

const VERSIONS: VersionSummary[] = [
  { id: "v2", note: "Board meeting", author: "Nadia", timestamp: 2, scenario: "main", parents: 1 },
  { id: "v1", note: "First version", author: "Nadia", timestamp: 1, scenario: "main", parents: 0 },
];

/** A store adapter that only answers what this screen asks. */
function fakeStore(patch: Partial<StoreAdapter> = {}): StoreAdapter {
  const base: StoreAdapter = {
    workbooks: [],
    status: "idle",
    error: null,
    demoAvailable: false,
    hasWorkbook: true,
    openWorkbook: () => undefined,
    trackFile: async () => undefined,
    loadDemo: async () => undefined,
    versions: VERSIONS,
    scenarios: [],
    createScenario: async () => undefined,
    setMilestone: async () => undefined,
    restoreVersion: async () => undefined,
    exportBundle: async () => undefined,
    comparison: VIEW,
    compare: async () => undefined,
    setComparisonFilter: () => undefined,
    combine: null,
    startCombine: async () => undefined,
    chooseDisagreement: () => undefined,
    finalizeCombine: async () => undefined,
    cellHistory: null,
    showCellHistory: async () => undefined,
    authorName: "",
    setAuthorName: () => undefined,
    exportEverything: async () => undefined,
    clearStorage: async () => undefined,
  };
  return { ...base, ...patch };
}

function renderScreen(store: StoreAdapter, lang: Lang = "en"): void {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LangContext.Provider value={{ lang, setLang: () => undefined }}>
      <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    </LangContext.Provider>
  );
  render(<CompareScreen />, { wrapper });
}

const rows = () => [...document.querySelectorAll<HTMLElement>(".difference-row")];
const grid = () => document.querySelector("[role='grid']") as HTMLElement;

afterEach(cleanup);

describe("deterministic summary (SUT-F-13)", () => {
  it("renders the headline from the contract summary", () => {
    renderScreen(fakeStore());
    expect(
      screen.getByText("2 typed changes, 1 row added, 1 result recalculated, 1 format changed"),
    ).toBeTruthy();
  });

  it("details the recalculated results with their amounts", () => {
    renderScreen(fakeStore());
    expect(screen.getByText("B14: 120 000 → 131 500")).toBeTruthy();
  });

  it("exposes the headline as one polite status block", () => {
    renderScreen(fakeStore());
    const headline = screen.getByText(
      "2 typed changes, 1 row added, 1 result recalculated, 1 format changed",
    );
    expect(headline.getAttribute("role")).toBe("status");
    expect(headline.getAttribute("aria-live")).toBe("polite");
  });

  it("reads the same summary in French (SUT-N-08)", () => {
    renderScreen(fakeStore(), "fr");
    expect(
      screen.getByText("2 saisies modifiées, 1 ligne ajoutée, 1 résultat recalculé, 1 format modifié"),
    ).toBeTruthy();
    expect(screen.getByText("B14 : 120 000 → 131 500")).toBeTruthy();
  });

  it("copies the summary as plain text", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderScreen(fakeStore());
    fireEvent.click(screen.getByText("Copy summary"));
    await act(async () => undefined);
    const copied =
      "2 typed changes, 1 row added, 1 result recalculated, 1 format changed\n" +
      `B14: 120${GROUP_SEPARATOR}000 → 131${GROUP_SEPARATOR}500`;
    expect(writeText).toHaveBeenCalledWith(copied);
  });

  it("never recomputes a count by hand", () => {
    // The contract counts disagree with the rows on purpose: the contract wins.
    const store = fakeStore({
      comparison: { ...VIEW, summary: { ...VIEW.summary, inputsModified: 7 } },
    });
    renderScreen(store);
    expect(screen.getByText(/7 typed changes/)).toBeTruthy();
  });
});

describe("columns in the summary", () => {
  const storeWithColumns = () =>
    fakeStore({
      comparison: { ...VIEW, summary: { ...VIEW.summary, colsInserted: 1, colsDeleted: 2 } },
    });

  it("shows the columns that were added and removed", () => {
    renderScreen(storeWithColumns());
    expect(
      screen.getByText(
        "2 typed changes, 1 row added, 1 column added, 2 columns removed, 1 result recalculated, 1 format changed",
      ),
    ).toBeTruthy();
  });

  it("shows the columns in French too (SUT-N-08)", () => {
    renderScreen(storeWithColumns(), "fr");
    expect(
      screen.getByText(
        "2 saisies modifiées, 1 ligne ajoutée, 1 colonne ajoutée, 2 colonnes supprimées, 1 résultat recalculé, 1 format modifié",
      ),
    ).toBeTruthy();
  });
});

describe("symbols in addition to colour (SUT-N-07)", () => {
  it("shows a symbol for every nature", () => {
    renderScreen(fakeStore());
    const symbols = within(grid())
      .queryAllByRole("img")
      .map((node) => node.textContent);
    expect(symbols).toContain("+");
    expect(symbols).toContain("~");
    expect(symbols).toContain("≡");
  });

  it("names every symbol for a screen reader, in English and in French", () => {
    renderScreen(fakeStore());
    const labels = within(grid())
      .queryAllByRole("img")
      .map((node) => node.getAttribute("aria-label"));
    expect(labels).toContain("Typed change");
    expect(labels).toContain("Recalculated result");
    expect(labels).toContain("Format change");
    cleanup();
    renderScreen(fakeStore(), "fr");
    const fr = within(grid())
      .queryAllByRole("img")
      .map((node) => node.getAttribute("aria-label"));
    expect(fr).toContain("Saisie modifiée");
    expect(fr).toContain("Conséquence recalculée");
  });

  it("uses the removed symbol when a value disappears", () => {
    const removed: ComparisonView = {
      ...VIEW,
      rows: [{ sheetId: 1, ref: "B7", nature: "input", before: "12000", after: "" }],
    };
    renderScreen(fakeStore({ comparison: removed }));
    const symbol = within(grid()).getByRole("img");
    expect(symbol.textContent).toBe("−");
    expect(symbol.getAttribute("aria-label")).toBe("Removed");
  });
});

describe("virtualized grid (SUT-N-03)", () => {
  it("renders only the rows of the window", () => {
    const many: ComparisonRow[] = Array.from({ length: 5000 }, (_, index) => ({
      sheetId: 1,
      ref: `B${index}`,
      nature: "input" as const,
      before: String(index),
      after: String(index + 1),
    }));
    renderScreen(fakeStore({ comparison: { ...VIEW, rows: many } }));
    expect(rows().length).toBeLessThan(30);
    expect(grid().getAttribute("aria-rowcount")).toBe("5000");
  });

  it("keeps the whole list reachable by scrolling", () => {
    const many: ComparisonRow[] = Array.from({ length: 400 }, (_, index) => ({
      sheetId: 1,
      ref: `B${index}`,
      nature: "input" as const,
      before: String(index),
      after: String(index + 1),
    }));
    renderScreen(fakeStore({ comparison: { ...VIEW, rows: many } }));
    fireEvent.scroll(grid(), { target: { scrollTop: 4000 } });
    expect(within(grid()).getByText("B100")).toBeTruthy();
    expect(rows().length).toBeLessThan(40);
  });
});

describe("filters", () => {
  it("applies the nature filter to the grid", () => {
    const store = fakeStore({
      comparison: { ...VIEW, filter: { sheetId: "all", nature: "consequence" } },
    });
    renderScreen(store);
    expect(within(grid()).getByText("B14")).toBeTruthy();
    expect(within(grid()).queryByText("B7")).toBeNull();
    expect(screen.getByText("1 difference shown")).toBeTruthy();
  });

  it("applies the sheet filter to the grid", () => {
    const store = fakeStore({
      comparison: { ...VIEW, filter: { sheetId: 2, nature: "all" } },
    });
    renderScreen(store);
    expect(within(grid()).getByText("C3")).toBeTruthy();
    expect(within(grid()).queryByText("B14")).toBeNull();
  });

  it("asks the store for the chosen nature", () => {
    const setComparisonFilter = vi.fn();
    renderScreen(fakeStore({ setComparisonFilter }));
    fireEvent.click(screen.getByLabelText("Recalculated results"));
    expect(setComparisonFilter).toHaveBeenCalledWith({ nature: "consequence" });
  });

  it("asks the store for the chosen sheet", () => {
    const setComparisonFilter = vi.fn();
    renderScreen(fakeStore({ setComparisonFilter }));
    fireEvent.change(screen.getByLabelText("Sheet"), { target: { value: "2" } });
    expect(setComparisonFilter).toHaveBeenCalledWith({ sheetId: 2 });
  });

  it("says when the filters leave nothing", () => {
    const store = fakeStore({
      comparison: { ...VIEW, filter: { sheetId: 99, nature: "all" } },
    });
    renderScreen(store);
    expect(screen.getByText("No difference matches the current filters.")).toBeTruthy();
  });
});

describe("keyboard navigation", () => {
  it("keeps a single tab stop inside the grid", () => {
    renderScreen(fakeStore());
    const tabbable = rows().filter((row) => row.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
  });

  it("moves the focus to the next difference with the down arrow", () => {
    renderScreen(fakeStore());
    rows()[0]!.focus();
    fireEvent.keyDown(rows()[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows()[1]);
  });

  it("goes back with the up arrow", () => {
    renderScreen(fakeStore());
    rows()[1]!.focus();
    fireEvent.keyDown(rows()[1]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows()[0]);
  });

  it("jumps to the next difference with the right arrow and the N key", () => {
    renderScreen(fakeStore());
    rows()[0]!.focus();
    fireEvent.keyDown(rows()[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(rows()[1]);
    fireEvent.keyDown(rows()[1]!, { key: "n" });
    expect(document.activeElement).toBe(rows()[2]);
  });

  it("reaches both ends with Home and End", () => {
    renderScreen(fakeStore());
    rows()[0]!.focus();
    fireEvent.keyDown(rows()[0]!, { key: "End" });
    expect(document.activeElement).toBe(rows()[rows().length - 1]);
    fireEvent.keyDown(rows()[rows().length - 1]!, { key: "Home" });
    expect(document.activeElement).toBe(rows()[0]);
  });

  it("moves the focus with the toolbar shortcut", () => {
    renderScreen(fakeStore());
    rows()[0]!.focus();
    fireEvent.click(screen.getByText("Next difference"));
    expect(document.activeElement).toBe(rows()[1]);
  });

  it("announces the focused difference to a screen reader", () => {
    renderScreen(fakeStore());
    rows()[0]!.focus();
    fireEvent.keyDown(rows()[0]!, { key: "ArrowDown" });
    const live = document.querySelector(".compare-live") as HTMLElement;
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("Sheet 1, cell B9, Typed change, 5 becomes 6");
  });
});

describe("versions and states", () => {
  it("offers the two versions and starts the comparison", () => {
    const compare = vi.fn(async () => undefined);
    renderScreen(fakeStore({ compare, comparison: null }));
    fireEvent.click(screen.getByText("Compare"));
    expect(compare).toHaveBeenCalledWith("v2", "v1");
  });

  it("waits when no comparison is running", () => {
    renderScreen(fakeStore({ comparison: null }));
    expect(screen.getByText(/No comparison yet/)).toBeTruthy();
  });

  it("says so when the two versions are identical", () => {
    renderScreen(fakeStore({ comparison: IDENTICAL }));
    expect(screen.getByText("These two versions are identical: nothing differs between them.")).toBeTruthy();
  });

  it("reports a failure with its details", () => {
    renderScreen(fakeStore({ status: "error", error: "sheet 3 could not be read" }));
    expect(screen.getByText("Comparison unavailable.")).toBeTruthy();
    expect(screen.getByText("sheet 3 could not be read")).toBeTruthy();
  });

  it("lists the parts that are not compared in detail (SUT-F-15)", () => {
    renderScreen(fakeStore());
    expect(screen.getByText("Chart 1 — Changed")).toBeTruthy();
  });
});
