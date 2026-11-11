import { describe, expect, it } from "vitest";
import {
  LANE_HEIGHT,
  POINT_SPACING,
  THREAD_PADDING,
  laneNames,
  layoutThread,
  orderVersions,
  type ThreadScenario,
  type ThreadVersion,
} from "./thread-layout";

/** The demo case: an original, one divergent copy, one combine. */
function versions(): ThreadVersion[] {
  return [
    {
      id: "v1",
      note: "First draft",
      author: "Nadia",
      timestamp: Date.UTC(2026, 10, 2, 9, 0),
      scenario: "reference",
      parents: 1,
    },
    {
      id: "v2",
      note: "Paul's copy",
      author: "Paul",
      timestamp: Date.UTC(2026, 10, 5, 10, 0),
      scenario: "paul",
      parents: 1,
    },
    {
      id: "v3",
      note: "Combined with Paul",
      author: "Nadia",
      timestamp: Date.UTC(2026, 10, 9, 14, 0),
      scenario: "reference",
      parents: 2,
      milestone: "Budget adopted",
    },
  ];
}

function scenarios(): ThreadScenario[] {
  return [
    { name: "reference", reference: true, head: "v3" },
    { name: "paul", reference: false, head: "v2" },
  ];
}

describe("orderVersions", () => {
  it("sorts by timestamp, oldest first", () => {
    const shuffled = [versions()[2]!, versions()[0]!, versions()[1]!];
    expect(orderVersions(shuffled).map((version) => version.id)).toEqual([
      "v1",
      "v2",
      "v3",
    ]);
  });

  it("breaks ties on the same timestamp by identifier", () => {
    const same = [
      { ...versions()[0]!, id: "b" },
      { ...versions()[0]!, id: "a" },
    ];
    expect(orderVersions(same).map((version) => version.id)).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const input = versions();
    const copy = [...input];
    orderVersions(input);
    expect(input).toEqual(copy);
  });
});

describe("laneNames", () => {
  it("puts the Reference lane first, then one lane per scenario", () => {
    expect(laneNames(versions(), scenarios())).toEqual([
      "reference",
      "paul",
    ]);
  });

  it("adds a lane for a version whose scenario is unknown to the store", () => {
    const extra = [
      ...versions(),
      { ...versions()[0]!, id: "v4", scenario: "marie" },
    ];
    expect(laneNames(extra, scenarios())).toContain("marie");
  });
});

describe("layoutThread — geometry", () => {
  it("draws exactly one point per version", () => {
    expect(layoutThread(versions(), scenarios()).points).toHaveLength(3);
  });

  it("gives an empty layout when there is no version", () => {
    const layout = layoutThread([], scenarios());
    expect(layout.points).toHaveLength(0);
    expect(layout.lanes).toHaveLength(2);
  });

  it("spaces the points evenly along the thread", () => {
    const { points } = layoutThread(versions(), scenarios());
    expect(points.map((point) => point.x)).toEqual([
      THREAD_PADDING,
      THREAD_PADDING + POINT_SPACING,
      THREAD_PADDING + 2 * POINT_SPACING,
    ]);
  });

  it("puts the Reference on lane 0 and a scenario on its own lane", () => {
    const { points } = layoutThread(versions(), scenarios());
    const byId = new Map(points.map((point) => [point.id, point]));
    expect(byId.get("v1")?.lane).toBe(0);
    expect(byId.get("v1")?.y).toBe(THREAD_PADDING);
    expect(byId.get("v2")?.lane).toBe(1);
    expect(byId.get("v2")?.y).toBe(THREAD_PADDING + LANE_HEIGHT);
  });

  it("marks a version with two origins as a combine", () => {
    const { points } = layoutThread(versions(), scenarios());
    expect(points.map((point) => point.kind)).toEqual([
      "version",
      "version",
      "combine",
    ]);
  });

  it("numbers the versions from the oldest", () => {
    const { points } = layoutThread(versions(), scenarios());
    expect(points.map((point) => point.index)).toEqual([0, 1, 2]);
  });

});

describe("layoutThread — lanes", () => {
  it("starts a scenario thread at the version it forks from", () => {
    const { lanes } = layoutThread(versions(), scenarios());
    const scenarioLane = lanes.find((lane) => lane.name === "paul");
    expect(scenarioLane?.points.map((point) => point.id)).toEqual(["v1", "v2"]);
  });

  it("keeps the whole thread on the Reference lane", () => {
    const { lanes } = layoutThread(versions(), scenarios());
    const reference = lanes.find((lane) => lane.name === "reference");
    expect(reference?.points.map((point) => point.id)).toEqual(["v1", "v3"]);
  });

  it("grows the canvas with the number of versions and of lanes", () => {
    const layout = layoutThread(versions(), scenarios());
    expect(layout.width).toBeGreaterThan(THREAD_PADDING * 2 + 2 * POINT_SPACING);
    expect(layout.height).toBe(THREAD_PADDING * 2 + 2 * LANE_HEIGHT);
    expect(layout.referenceName).toBe("reference");
  });
});
