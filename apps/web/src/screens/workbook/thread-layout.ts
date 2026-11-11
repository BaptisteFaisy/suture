/**
 * History thread layout (spec merge-wizard, screen 2).
 *
 * Pure computation: the versions of a tracked workbook become points of a
 * single thread — the Reference lane — and every scenario becomes a parallel
 * thread. No DOM, no React: the geometry is unit-tested on its own.
 */

/** One version of the tracked workbook, as the store describes it. */
export interface ThreadVersion {
  readonly id: string;
  readonly note: string;
  readonly author: string;
  readonly timestamp: number;
  readonly scenario: string;
  readonly milestone?: string;
  readonly parents: number;
}

/** One scenario of the tracked workbook. */
export interface ThreadScenario {
  readonly name: string;
  readonly reference: boolean;
  readonly head: string;
}

/** A version drawn on the thread. */
export interface ThreadPoint {
  readonly id: string;
  readonly version: ThreadVersion;
  /** 0 for the Reference lane, 1 and beyond for the scenarios. */
  readonly lane: number;
  readonly x: number;
  readonly y: number;
  /** Rank of the version in the thread, oldest first. */
  readonly index: number;
  /** A version with two origins is a combine — a visible suture. */
  readonly kind: "version" | "combine";
}

/** One thread of the graph: the Reference, or a scenario. */
export interface ThreadLane {
  readonly name: string;
  readonly y: number;
  readonly points: readonly ThreadPoint[];
}

export interface ThreadLayout {
  readonly points: readonly ThreadPoint[];
  readonly lanes: readonly ThreadLane[];
  readonly width: number;
  readonly height: number;
  readonly referenceName: string;
}

/** Horizontal distance between two consecutive versions. */
export const POINT_SPACING = 96;
/** Vertical distance between two threads. */
export const LANE_HEIGHT = 84;
/** Margin around the graph. */
export const THREAD_PADDING = 48;

/** Oldest first; ties broken by identifier so the layout stays stable. */
export function orderVersions(versions: readonly ThreadVersion[]): ThreadVersion[] {
  return [...versions].sort(
    (a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id),
  );
}

/** Names of the lanes, Reference first, then one per scenario. */
export function laneNames(
  versions: readonly ThreadVersion[],
  scenarios: readonly ThreadScenario[],
): string[] {
  const reference = scenarios.find((scenario) => scenario.reference);
  const referenceName =
    reference?.name ?? scenarios[0]?.name ?? versions[0]?.scenario ?? "";
  const names = referenceName === "" ? [] : [referenceName];
  for (const scenario of scenarios) {
    if (scenario.name !== "" && !names.includes(scenario.name)) {
      names.push(scenario.name);
    }
  }
  for (const version of versions) {
    if (version.scenario !== "" && !names.includes(version.scenario)) {
      names.push(version.scenario);
    }
  }
  return names;
}

/** Computes the geometry of the whole thread. */
export function layoutThread(
  versions: readonly ThreadVersion[],
  scenarios: readonly ThreadScenario[],
): ThreadLayout {
  const ordered = orderVersions(versions);
  const names = laneNames(ordered, scenarios);
  const points: ThreadPoint[] = ordered.map((version, index) => ({
    id: version.id,
    version,
    lane: Math.max(0, names.indexOf(version.scenario)),
    x: THREAD_PADDING + index * POINT_SPACING,
    y: THREAD_PADDING + Math.max(0, names.indexOf(version.scenario)) * LANE_HEIGHT,
    index,
    kind: version.parents >= 2 ? "combine" : "version",
  }));
  const lanes = names.map((name, lane) => ({
    name,
    y: THREAD_PADDING + lane * LANE_HEIGHT,
    points: buildLanePoints(points, lane),
  }));
  const referenceName = names[0] ?? "";
  return {
    points,
    lanes,
    width: Math.max(320, THREAD_PADDING * 2 + points.length * POINT_SPACING),
    height: THREAD_PADDING * 2 + names.length * LANE_HEIGHT,
    referenceName,
  };
}

/** Points of one lane, plus the point it forks from on the Reference. */
function buildLanePoints(
  points: readonly ThreadPoint[],
  lane: number,
): ThreadPoint[] {
  const own = points.filter((point) => point.lane === lane);
  if (lane === 0) return own;
  const first = own[0];
  if (first === undefined) return own;
  const origin = points
    .filter((point) => point.lane === 0 && point.x < first.x)
    .sort((a, b) => b.x - a.x)[0];
  return origin === undefined ? own : [origin, ...own];
}
