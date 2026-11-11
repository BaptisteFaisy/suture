import type { StoreAdapter } from "../../store";

/**
 * Pure logic of the combine assistant.
 *
 * Every type is derived from the store contract, so this module never
 * imports an engine package and stays independent of the wiring.
 */

/** State of the combine, as exposed by the store. */
export type CombineState = NonNullable<StoreAdapter["combine"]>;

/** Answer given to one disagreement. */
export type CombineChoice = Parameters<StoreAdapter["chooseDisagreement"]>[1];

/** The two sides of a meeting. */
export type Side = NonNullable<CombineState["fallbacks"][number]["keptSide"]>;

/** One line of the report. */
export type ReportEntry = CombineState["report"][number];

/** Cell content, as the store expects it for a typed value. */
export type CellContent = Extract<CombineChoice, { pick: "custom" }>["record"];

/** The three questions of the assistant, in order. */
export type CombineStep = 1 | 2 | 3;

export const COMBINE_STEPS: readonly CombineStep[] = [1, 2, 3];

/** One disagreement of the plan, as shown by the assistant. */
export type Disagreement = CombineState["disagreements"][number];

/** One change that applies on its own. */
export type AutomaticChange = CombineState["automatic"][number];

/** One sheet refused to the automatic combine. */
export type Fallback = CombineState["fallbacks"][number];

/** Disagreements still waiting for an answer. */
export function openDisagreements(state: CombineState): Disagreement[] {
  return state.disagreements.filter((item) => state.choices[item.id] === undefined);
}

/** True when the user already answered this disagreement. */
export function isSettled(state: CombineState, id: string): boolean {
  return state.choices[id] !== undefined;
}

/** Side kept for a sheet refused to the automatic combine, if any. */
export function keptSide(
  fallback: Fallback,
  chosen: Readonly<Record<string, Side>>,
): Side | undefined {
  return fallback.keptSide ?? chosen[fallback.sheetName];
}

/** Sheets refused to the automatic combine with no side chosen yet. */
export function pendingFallbacks(
  state: CombineState,
  chosen: Readonly<Record<string, Side>>,
): Fallback[] {
  return state.fallbacks.filter((item) => keptSide(item, chosen) === undefined);
}

/**
 * The report can be built only when nothing is open: every disagreement is
 * answered and every refused sheet has a side kept. This is the visible
 * form of the "nothing disappears silently" rule.
 */
export function canBuildReport(
  state: CombineState,
  chosen: Readonly<Record<string, Side>>,
): boolean {
  return openDisagreements(state).length === 0 && pendingFallbacks(state, chosen).length === 0;
}

/** The four sections of the report. */
export interface ReportSections {
  applied: ReportEntry[];
  decided: ReportEntry[];
  notCarried: ReportEntry[];
  toReview: ReportEntry[];
}

/** Splits the report lines into the four sections shown to the user. */
export function groupReport(entries: readonly ReportEntry[]): ReportSections {
  const sections: ReportSections = {
    applied: [],
    decided: [],
    notCarried: [],
    toReview: [],
  };
  for (const entry of entries) {
    if (entry.category === "applied") sections.applied.push(entry);
    else if (entry.category === "decided") sections.decided.push(entry);
    else if (entry.category === "not-carried") sections.notCarried.push(entry);
    else sections.toReview.push(entry);
  }
  return sections;
}

/** Total number of lines of the report. */
export function reportCount(entries: readonly ReportEntry[]): number {
  return entries.length;
}

/** Label of a side, in the active interface language. */
export function sideLabel(side: Side | "both", labels: { a: string; b: string; both: string }): string {
  if (side === "A") return labels.a;
  if (side === "B") return labels.b;
  return labels.both;
}

/** Text of one report line, ready to be downloaded. */
export function reportLineText(
  entry: ReportEntry,
  labels: { a: string; b: string; both: string },
): string {
  const parts = [
    entry.sheetName,
    entry.ref ?? "",
    sideLabel(entry.side, labels),
    entry.label,
  ].filter((part) => part !== "");
  return entry.detail === undefined ? parts.join(" — ") : `${parts.join(" — ")} — ${entry.detail}`;
}

/** Full report as plain text, section by section. */
export function reportToText(
  entries: readonly ReportEntry[],
  titles: { applied: string; decided: string; notCarried: string; toReview: string },
  labels: { a: string; b: string; both: string },
): string {
  const sections = groupReport(entries);
  const blocks: string[] = [];
  const add = (title: string, lines: readonly ReportEntry[]) => {
    blocks.push(`${title} (${lines.length})`);
    for (const line of lines) blocks.push(`  - ${reportLineText(line, labels)}`);
  };
  add(titles.applied, sections.applied);
  add(titles.decided, sections.decided);
  add(titles.notCarried, sections.notCarried);
  add(titles.toReview, sections.toReview);
  return blocks.join("\n");
}

/** Kind of a cell content, guessed from the typed text. */
export function guessKind(value: string): CellContent["kind"] {
  if (value.startsWith("=")) return "f";
  if (value.trim() === "") return "s";
  const asNumber = Number(value.replace(",", "."));
  return Number.isFinite(asNumber) ? "n" : "s";
}

/** Builds the cell content sent to the store for a typed value. */
export function typedContent(ref: string, value: string): CellContent {
  return { ref, kind: guessKind(value), input: value, cached: "", fmt: "" };
}

/** Reason why a workbook file cannot be used, or null when it is fine. */
export type FileProblem = "type" | "size" | null;

/** Extension accepted for a workbook. */
export const WORKBOOK_EXTENSIONS = [".xlsx", ".xlsm"] as const;

/** Largest workbook accepted, in bytes. */
export const MAX_WORKBOOK_BYTES = 40 * 1024 * 1024;

/** Checks a workbook file before the meeting starts. */
export function checkWorkbookFile(file: { name: string; size: number }): FileProblem {
  const lower = file.name.toLowerCase();
  const known = WORKBOOK_EXTENSIONS.some((extension) => lower.endsWith(extension));
  if (!known) return "type";
  if (file.size > MAX_WORKBOOK_BYTES) return "size";
  return null;
}

/** Name of a scenario built from a file name, without its extension. */
export function scenarioNameFromFile(fileName: string): string {
  const withoutExtension = fileName.replace(/\.(xlsx|xlsm)$/i, "");
  const cleaned = withoutExtension.replace(/[_-]+/g, " ").trim();
  return cleaned === "" ? "Scenario" : cleaned;
}
