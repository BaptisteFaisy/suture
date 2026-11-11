import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
} from "react";
import { computeVirtualWindow, type VirtualWindow } from "@suture/ui";

export interface VirtualWindowOptions {
  /** Total number of rows in the list. */
  rowCount: number;
  /** Fixed height of one row, in pixels. */
  rowHeight: number;
  /** Viewport height used until the container can be measured. */
  fallbackViewport: number;
  /** Extra rows rendered above and below the viewport. */
  overscan?: number;
}

export interface VirtualWindowState {
  /** Window of rows to render. */
  window: VirtualWindow;
  /** Current scroll offset, in pixels. */
  scrollTop: number;
  /** Ref to attach to the scrolling container. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Scroll handler of the container. */
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  /** Scrolls so that the given row index becomes visible. */
  scrollToIndex: (index: number) => void;
}

/**
 * Keeps only the visible slice of a long list rendered (SUT-N-03): the
 * interface never blocks on a hundred thousand rows. The window math lives
 * in `@suture/ui` so that every long list shares it.
 */
export function useVirtualWindow(options: VirtualWindowOptions): VirtualWindowState {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(options.fallbackViewport);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overscan = options.overscan ?? 6;

  const window = useMemo(
    () =>
      computeVirtualWindow({
        rowCount: options.rowCount,
        rowHeight: options.rowHeight,
        viewportHeight: viewport,
        scrollTop,
        overscan,
      }),
    [options.rowCount, options.rowHeight, viewport, scrollTop, overscan],
  );

  const measure = useCallback(() => {
    const height = containerRef.current?.clientHeight ?? 0;
    if (height > 0) setViewport(height);
  }, []);

  useEffect(() => {
    measure();
    globalThis.addEventListener("resize", measure);
    return () => globalThis.removeEventListener("resize", measure);
  }, [measure]);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const element = containerRef.current;
      if (element === null) return;
      const top = index * options.rowHeight;
      const bottom = top + options.rowHeight;
      let next = element.scrollTop;
      if (top < next) next = top;
      else if (bottom > next + viewport) next = bottom - viewport;
      element.scrollTop = next;
      setScrollTop(next);
    },
    [options.rowHeight, viewport],
  );

  return { window, scrollTop, containerRef, onScroll, scrollToIndex };
}
