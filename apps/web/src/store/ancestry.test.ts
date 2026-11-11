import { describe, expect, it } from "vitest";
import type { VersionMeta } from "@suture/contracts";
import { ancestorsOf, commonOrigin, indexVersions } from "./ancestry";

function version(id: string, parents: string[], scenario = "Reference"): VersionMeta {
  return {
    id,
    note: `note ${id}`,
    author: "Nadia",
    timestamp: 1_700_000_000_000,
    parents,
    scenario,
  };
}

/** Reference: v1 <- v2 <- v3 ; scenario Paul: v1 <- p1 ; scenario Marie: v1 <- m1. */
const HISTORY = [
  version("v1", []),
  version("v2", ["v1"]),
  version("v3", ["v2"]),
  version("p1", ["v1"], "Paul"),
  version("m1", ["v1"], "Marie"),
  version("c1", ["p1", "m1"]),
];

describe("ancestry", () => {
  const index = indexVersions(HISTORY);

  it("lists ancestors nearest first", () => {
    expect(ancestorsOf(index, "v3")).toEqual(["v2", "v1"]);
  });

  it("finds the common origin of two scenarios", () => {
    expect(commonOrigin(index, "p1", "m1")).toBe("v1");
  });

  it("finds the common origin across a combine", () => {
    expect(commonOrigin(index, "c1", "v3")).toBe("v1");
  });

  it("returns the version itself when both sides are the same", () => {
    expect(commonOrigin(index, "v2", "v2")).toBe("v2");
  });

  it("returns a parent when one side is an ancestor of the other", () => {
    expect(commonOrigin(index, "v1", "v3")).toBe("v1");
  });

  it("returns null for unrelated histories", () => {
    const unrelated = indexVersions([...HISTORY, version("x1", [])]);
    expect(commonOrigin(unrelated, "x1", "v3")).toBeNull();
  });

  it("survives a cycle in the parent links", () => {
    const cyclic = indexVersions([version("a", ["b"]), version("b", ["a"])]);
    expect(ancestorsOf(cyclic, "a")).toEqual(["b"]);
  });
});
