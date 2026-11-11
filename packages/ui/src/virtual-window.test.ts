import { describe, expect, it } from "vitest";
import { computeVirtualWindow } from "./virtual-window";

describe("computeVirtualWindow", () => {
  const base = { rowHeight: 40, viewportHeight: 400, overscan: 2 };

  it("renders the visible rows plus the overscan at the top", () => {
    const result = computeVirtualWindow({ ...base, rowCount: 1000, scrollTop: 0 });
    expect(result.start).toBe(0);
    expect(result.end).toBe(12);
    expect(result.offsetTop).toBe(0);
    expect(result.totalHeight).toBe(40_000);
  });

  it("moves the window with the scroll position", () => {
    const result = computeVirtualWindow({ ...base, rowCount: 1000, scrollTop: 2000 });
    expect(result.start).toBe(48);
    expect(result.end).toBe(62);
    expect(result.offsetTop).toBe(1920);
  });

  it("clamps at the end of the list", () => {
    const result = computeVirtualWindow({ ...base, rowCount: 20, scrollTop: 100_000 });
    expect(result.end).toBe(19);
    expect(result.start).toBeLessThanOrEqual(result.end);
  });

  it("handles an empty list", () => {
    const result = computeVirtualWindow({ ...base, rowCount: 0, scrollTop: 0 });
    expect(result.start).toBe(0);
    expect(result.end).toBe(0);
    expect(result.totalHeight).toBe(0);
    expect(result.offsetTop).toBe(0);
  });

  it("covers every row index across a full scroll (no gap)", () => {
    const rowCount = 500;
    const seen = new Set<number>();
    for (let scroll = 0; scroll <= rowCount * 40; scroll += 37) {
      const { start, end } = computeVirtualWindow({ ...base, rowCount, scrollTop: scroll });
      for (let i = start; i <= end; i += 1) seen.add(i);
    }
    expect(seen.size).toBe(rowCount);
  });

  it("never renders the whole list for a huge comparison (SUT-N-03)", () => {
    const rowCount = 200_000;
    const { start, end } = computeVirtualWindow({
      ...base,
      rowCount,
      scrollTop: 120_000,
      overscan: 6,
    });
    expect(end - start + 1).toBeLessThan(40);
  });
});
