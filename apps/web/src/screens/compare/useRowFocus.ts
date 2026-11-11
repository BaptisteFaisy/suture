import { useEffect, type RefObject } from "react";
import type { VirtualWindow } from "@suture/ui";

/**
 * Gives the keyboard focus to the active line once it is rendered: the line
 * may live outside the virtual window, so the scroll comes first and the
 * focus follows the new window.
 */
export function useRowFocus(
  activeIndex: number,
  moveTick: number,
  wantsFocus: RefObject<boolean>,
  rowRefs: RefObject<(HTMLDivElement | null)[]>,
  scrollToIndex: (index: number) => void,
  window: VirtualWindow,
): void {
  useEffect(() => {
    if (!wantsFocus.current) return;
    scrollToIndex(activeIndex);
    const element = rowRefs.current[activeIndex];
    if (element === null || element === undefined) return;
    element.focus();
    wantsFocus.current = false;
  }, [activeIndex, moveTick, wantsFocus, rowRefs, scrollToIndex, window.start, window.end]);
}
