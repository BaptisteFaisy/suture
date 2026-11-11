/**
 * Actions of the store adapter: each one is a function of the injected engines
 * and host ports, so the whole behaviour of the app can be tested with fakes,
 * without a browser and without the real engines.
 */
import type {
  CanonicalWorkbook,
  ChangeSet,
  DisagreementChoice,
  MergePlan,
  ReportEntry,
  SutureStore,
  VersionMeta,
} from "@suture/contracts";
import { DEMO_WORKBOOK_PATHS, fetchDemoWorkbook } from "../demo/demo";
import { commonOrigin, indexVersions } from "./ancestry";
import { fileErrorKey, hasErrorCode } from "./errors";
import type { ComparisonFilter, ComparisonView, CombineView, VersionSummary } from "./index";
import { toCombineView, toComparisonView, toVersionSummaries } from "./mappers";
import type { Engines, HostPorts } from "./ports";
import { workbookIdOf, type Registry } from "./registry";

export interface AdapterDeps {
  engines: Engines;
  host: HostPorts;
}

/** Everything the screens need to know about the current session. */
export interface SessionState {
  workbookId: string | null;
  store: SutureStore | null;
  versions: VersionMeta[];
  changeSet: ChangeSet | null;
  filter: ComparisonFilter;
  plan: MergePlan | null;
  choices: Record<string, DisagreementChoice>;
  sheetNames: Map<number, string>;
  /** The three versions of the combine in progress. */
  sides: { origin: string; a: string; b: string } | null;
  /** The report of the last finished combine. */
  report: ReportEntry[];
  /** Scenarios of the open workbook, reference first. */
  scenarios: { name: string; reference: boolean; head: string }[];
}

export const EMPTY_SESSION: SessionState = {
  workbookId: null,
  store: null,
  versions: [],
  changeSet: null,
  filter: { sheetId: "all", nature: "all" },
  plan: null,
  choices: {},
  sheetNames: new Map(),
  sides: null,
  report: [],
  scenarios: [],
};

/** Refusal messages, translated by the caller. */
export function messageKeyFor(error: unknown): string {
  if (hasErrorCode(error)) return fileErrorKey(error.code);
  return "error.generic";
}

/** Version list of the open workbook, as the history screen shows it. */
export function versionSummaries(state: { session: SessionState }): VersionSummary[] {
  return toVersionSummaries(state.session.versions);
}

async function bytesOf(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Tracks a dropped file: the first drop of a name creates the tracked
 * workbook, a later drop of the same name adds a version to it (SUT-F-01/02).
 */
export async function trackFile(
  deps: AdapterDeps,
  registry: Registry,
  session: SessionState,
  file: File,
): Promise<SessionState> {
  const existing = registry.findByName(file.name);
  const record =
    existing ?? {
      id: workbookIdOf(file.name, deps.host.now()),
      name: file.name,
      createdAt: deps.host.now(),
    };
  if (existing === undefined) registry.add(record);

  const store = session.store !== null && session.workbookId === record.id
    ? session.store
    : await deps.engines.openStore(record.id);
  if (existing === undefined) await store.init(record.name);

  await store.commitVersion({
    file: await bytesOf(file),
    note: file.name,
    author: registry.author(),
  });
  return await refresh({ ...session, workbookId: record.id, store });
}

/**
 * Every version of the tracked workbook, across all its scenarios, newest
 * first. The history thread shows the whole graph — not just the reference —
 * and the compare screen must be able to pick a version from any scenario.
 */
export async function allVersions(store: SutureStore): Promise<VersionMeta[]> {
  const scenarios = await store.listScenarios();
  const seen = new Map<string, VersionMeta>();
  for (const scenario of scenarios) {
    const versions = await store.listVersions(scenario.name);
    for (const version of versions) {
      if (!seen.has(version.id)) {
        seen.set(version.id, { ...version, scenario: scenario.name });
      }
    }
  }
  return [...seen.values()].sort((left, right) => right.timestamp - left.timestamp);
}

/** Re-reads the version list and the scenarios after any change. */
export async function refresh(session: SessionState): Promise<SessionState> {
  if (session.store === null) return session;
  const [versions, scenarios] = await Promise.all([
    allVersions(session.store),
    session.store.listScenarios(),
  ]);
  return {
    ...session,
    versions,
    scenarios: scenarios.map((item) => ({
      name: item.name,
      reference: item.reference,
      head: item.head,
    })),
  };
}

/** Opens a tracked workbook by id. */
export async function openWorkbook(
  deps: AdapterDeps,
  id: string,
): Promise<SessionState> {
  const store = await deps.engines.openStore(id);
  return refresh({ ...EMPTY_SESSION, workbookId: id, store });
}

/**
 * Loads the demo set (SUT-F-31): the original becomes the tracked workbook,
 * then each divergent copy becomes a scenario of that same workbook, so the
 * combine has a real common origin.
 */
export async function loadDemo(deps: AdapterDeps, registry: Registry): Promise<SessionState> {
  const [original, ...variants] = DEMO_WORKBOOK_PATHS;
  if (original === undefined) throw new Error("error.generic");
  const originalFile = await fetchDemoWorkbook(original);
  let session = await trackFile(deps, registry, EMPTY_SESSION, originalFile);

  for (const path of variants) {
    const file = await fetchDemoWorkbook(path);
    const scenario = scenarioNameOf(file.name, originalFile.name);
    const head = session.versions[0]?.id;
    if (session.store === null || head === undefined) break;
    await session.store.createScenario(scenario, head);
    await session.store.commitVersion({
      file: await bytesOf(file),
      note: file.name,
      author: registry.author(),
      scenario,
    });
    session = await refresh(session);
  }
  return session;
}

/** "budget-2026-v2-marie-FINAL.xlsx" over "budget-2026.xlsx" gives "Marie". */
export function scenarioNameOf(fileName: string, originalName: string): string {
  const strip = (name: string) => name.replace(/\.(xlsx|xlsm)$/i, "");
  let rest = strip(fileName).toLowerCase();
  const base = strip(originalName).toLowerCase();
  if (rest.startsWith(base)) rest = rest.slice(base.length);
  rest = rest
    .replace(/^[-_\s]+/, "")
    .replace(/\b(v\d+|final|copie|copy|definitive)\b/g, "")
    .replace(/^[-_\s]+|[-_\s]+$/g, "");
  if (rest.length === 0) return strip(fileName);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Compares two versions and maps the result to the grid's view model. */
export async function compareVersions(
  deps: AdapterDeps,
  session: SessionState,
  fromVersion: string,
  toVersion: string,
): Promise<SessionState> {
  if (session.store === null) return session;
  const [before, after] = await Promise.all([
    session.store.getCanonical(fromVersion),
    session.store.getCanonical(toVersion),
  ]);
  const [beforeParts, afterParts] = await Promise.all([
    session.store.getParts(fromVersion),
    session.store.getParts(toVersion),
  ]);
  const changeSet = deps.engines.compare(
    before,
    after,
    partsByPath(beforeParts),
    partsByPath(afterParts),
  );
  return { ...session, changeSet, sheetNames: namesOf(after) };
}

function partsByPath(parts: { path: string; data: Uint8Array }[]): Record<string, Uint8Array> {
  const index: Record<string, Uint8Array> = {};
  for (const part of parts) index[part.path] = part.data;
  return index;
}

function namesOf(workbook: CanonicalWorkbook): Map<number, string> {
  const names = new Map<number, string>();
  for (const sheet of workbook.meta.sheets) names.set(sheet.sheetId, sheet.name);
  return names;
}

/** The comparison view, with the current filter applied. */
export function comparisonView(session: SessionState): ComparisonView | null {
  if (session.changeSet === null) return null;
  return toComparisonView(session.changeSet, session.filter);
}

/** A side is either a scenario name (its head is used) or a version id. */
export function resolveSide(session: SessionState, side: string): string {
  const scenario = session.scenarios.find((item) => item.name === side);
  return scenario === undefined ? side : scenario.head;
}

/** Plans a combine between two sides, from their common origin. */
export async function planCombine(
  deps: AdapterDeps,
  session: SessionState,
  sideA: string,
  sideB: string,
): Promise<SessionState> {
  if (session.store === null) return session;
  const a = resolveSide(session, sideA);
  const b = resolveSide(session, sideB);
  const origin = commonOrigin(indexVersions(session.versions), a, b);
  if (origin === null) throw new Error("error.no-common-origin");
  const [originView, aView, bView] = await Promise.all([
    session.store.getCanonical(origin),
    session.store.getCanonical(a),
    session.store.getCanonical(b),
  ]);
  const plan = deps.engines.planMerge(originView, aView, bView);
  return {
    ...session,
    plan,
    choices: {},
    sides: { origin, a, b },
    sheetNames: namesOf(plan.carrier === "A" ? aView : bView),
  };
}

/** The combine view, from the current plan and choices. */
export function combineView(session: SessionState): CombineView | null {
  if (session.plan === null) return null;
  return toCombineView(session.plan, session.sheetNames, session.choices, []);
}

/** Records one decision of the user. */
export function choose(
  session: SessionState,
  id: string,
  choice: DisagreementChoice,
): SessionState {
  return { ...session, choices: { ...session.choices, [id]: choice } };
}

/** The three versions of the combine in progress, as readable sides. */
export function combineSidesOf(session: SessionState): { a: string; b: string } | null {
  if (session.sides === null) return null;
  return { a: session.sides.a, b: session.sides.b };
}
