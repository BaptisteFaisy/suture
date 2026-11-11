// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { LangContext } from "../../i18n/lang";
import { StoreContext, type StoreAdapter } from "../../store";
import { CombineScreen } from "./CombineScreen";

/** A combine plan with one disagreement and one refused sheet. */
function fakeStore(): StoreAdapter {
  const state = {
    automatic: [
      { sheetName: "Budget", ref: "B2", value: "12000", source: "A" as const },
      { sheetName: "Budget", ref: "B3", value: "900", source: "B" as const },
    ],
    disagreements: [
      { id: "d1", sheetName: "Budget", ref: "B7", base: "11000", a: "12000", b: "13500" },
    ],
    fallbacks: [{ sheetName: "Hypotheses" }],
    choices: {} as Record<string, { id: string; pick: "A" | "B" | "custom" }>,
    report: [
      {
        category: "applied" as const,
        side: "A" as const,
        sheetName: "Budget",
        ref: "B2",
        label: "salary",
      },
      {
        category: "decided" as const,
        side: "B" as const,
        sheetName: "Budget",
        ref: "B7",
        label: "rent",
      },
      {
        category: "not-carried" as const,
        side: "both" as const,
        sheetName: "Hypotheses",
        label: "chart",
      },
    ],
    ready: false,
  };
  return {
    ...emptyStore(),
    combine: state,
    chooseDisagreement: (id: string, choice: { id: string; pick: "A" | "B" | "custom" }) => {
      state.choices[id] = choice;
    },
    finalizeCombine: async () => {
      state.ready = true;
    },
  } as unknown as StoreAdapter;
}

/** A store with nothing in it. */
function emptyStore(): StoreAdapter {
  return {
    workbooks: [],
    status: "idle",
    error: null,
    demoAvailable: false,
    hasWorkbook: false,
    openWorkbook: () => undefined,
    trackFile: async () => undefined,
    loadDemo: async () => undefined,
    versions: [],
    scenarios: [],
    createScenario: async () => undefined,
    setMilestone: async () => undefined,
    restoreVersion: async () => undefined,
    exportBundle: async () => undefined,
    comparison: null,
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
}

/** Renders the screen with a language and a store. */
function renderScreen(store: StoreAdapter, lang: "en" | "fr" = "en"): void {
  const tree: ReactElement = (
    <LangContext.Provider value={{ lang, setLang: () => undefined }}>
      <StoreContext.Provider value={store}>
        <CombineScreen />
      </StoreContext.Provider>
    </LangContext.Provider>
  );
  render(tree);
}

/** Goes to step 2. */
function goToStepTwo(): void {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

/** Settles every open question of step 2. */
function settleAll(): void {
  fireEvent.click(screen.getByRole("radio", { name: "Keep version A" }));
  fireEvent.click(screen.getByRole("radio", { name: "Keep the layout of version B" }));
}

afterEach(cleanup);

describe("CombineScreen steps", () => {
  it("shows the three steps in order", () => {
    renderScreen(fakeStore());
    expect(screen.getByRole("heading", { name: "What applies on its own" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Disagreements to settle" })).toBeNull();

    goToStepTwo();
    expect(screen.getByRole("heading", { name: "Disagreements to settle" })).toBeTruthy();

    settleAll();
    fireEvent.click(screen.getByTestId("combine-button"));
    expect(screen.getByRole("heading", { name: "Report and download" })).toBeTruthy();
  });

  it("counts the changes that apply on their own", () => {
    renderScreen(fakeStore());
    expect(screen.getByTestId("automatic-count").textContent).toContain("2");
  });

  it("blocks the validation while a disagreement is open", () => {
    renderScreen(fakeStore());
    goToStepTwo();
    const button = screen.getByTestId("combine-button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByTestId("open-count").textContent).toContain("1");
    expect(screen.getByTestId("blocked-note")).toBeTruthy();
  });

  it("shows the report once everything is settled", () => {
    renderScreen(fakeStore());
    goToStepTwo();
    settleAll();
    expect((screen.getByTestId("combine-button") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId("combine-button"));
    const report = screen.getByTestId("report");
    expect(within(report).getByRole("heading", { name: /^Applied/ })).toBeTruthy();
    expect(within(report).getByRole("heading", { name: /^Settled by you/ })).toBeTruthy();
    expect(within(report).getByRole("heading", { name: /^Not carried over/ })).toBeTruthy();
    expect(within(report).getByRole("heading", { name: /^To check/ })).toBeTruthy();
  });
});

describe("CombineScreen details", () => {
  it("shows the safe fallback notice with the side to keep", () => {
    renderScreen(fakeStore());
    goToStepTwo();
    const notice = screen.getByRole("listitem", { name: /not combined automatically/i });
    expect(within(notice).getByRole("radio", { name: "Keep the layout of version A" })).toBeTruthy();
    expect(within(notice).getByRole("radio", { name: "Keep the layout of version B" })).toBeTruthy();
    expect(within(notice).getByText("chart")).toBeTruthy();
  });

  it("shows the original value and both sides of a disagreement", () => {
    renderScreen(fakeStore());
    goToStepTwo();
    const card = screen.getByRole("listitem", { name: /Disagreement on cell B7/ });
    expect(within(card).getByText("Original value")).toBeTruthy();
    expect(within(card).getByText("11000")).toBeTruthy();
    expect(within(card).getByText("13500")).toBeTruthy();
    expect(within(card).getByRole("radio", { name: "Keep version B" })).toBeTruthy();
  });

  it("offers the two-files entry when no meeting is running", () => {
    renderScreen(emptyStore());
    expect(screen.getByRole("heading", { name: "Two files received by email" })).toBeTruthy();
    expect(screen.getByTestId("two-files-start")).toBeTruthy();
  });

  it("speaks French when the interface is French", () => {
    renderScreen(fakeStore(), "fr");
    expect(screen.getByRole("heading", { name: "Ce qui s'applique seul" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Réunir deux versions" })).toBeTruthy();
  });
});
