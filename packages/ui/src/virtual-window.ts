/**
 * Virtual window math — shared by the compare grid and any other long list.
 *
 * Pure: no DOM, no React. Given a scroll position and a viewport size, it
 * returns the slice of rows worth rendering plus the offset to apply.
 */

export interface VirtualWindowInput {
  /** Total number of rows in the list. */
  rowCount: number;
  /** Fixed height of one row, in pixels. */
  rowHeight: number;
  /** Height of the visible area, in pixels. */
  viewportHeight: number;
  /** Current scroll offset, in pixels. */
  scrollTop: number;
  /** Extra rows rendered above and below the viewport. */
  overscan: number;
}

export interface VirtualWindow {
  /** Index of the first rendered row (inclusive). */
  start: number;
  /** Index of the last rendered row (inclusive). */
  end: number;
  /** Total height of the whole list, in pixels. */
  totalHeight: number;
  /** Offset of the first rendered row inside the list, in pixels. */
  offsetTop: number;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Computes the window of rows to render for the given scroll position.
 * The window always includes the visible rows plus the overscan margin.
 */
export function computeVirtualWindow(input: VirtualWindowInput): VirtualWindow {
  const rowHeight = Math.max(1, input.rowHeight);
  const rowCount = Math.max(0, input.rowCount);
  const totalHeight = rowCount * rowHeight;
  const scrollTop = clamp(input.scrollTop, 0, Math.max(0, totalHeight));
  const overscan = Math.max(0, input.overscan);
  const firstVisible = Math.floor(scrollTop / rowHeight);
  const visibleCount = Math.ceil(input.viewportHeight / rowHeight) + 1;
  const start = clamp(firstVisible - overscan, 0, Math.max(0, rowCount - 1));
  const end = clamp(
    firstVisible + visibleCount + overscan - 1,
    start,
    Math.max(0, rowCount - 1),
  );
  return { start, end, totalHeight, offsetTop: start * rowHeight };
}
