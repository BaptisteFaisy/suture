import { useCallback, useRef, useState, type KeyboardEvent, type RefObject } from "react";

/** Number of lines a Page Up / Page Down key crosses. */
const PAGE = 10;

export interface DifferenceNavigation {
  /** Index of the difference that carries the keyboard focus. */
  activeIndex: number;
  /** Bumped on every keyboard move, so that the focus effect always runs. */
  moveTick: number;
  /** Set when the active index changed from the keyboard, not from a click. */
  wantsFocus: RefObject<boolean>;
  /** Records the focus of a line the user reached directly (mouse, Tab). */
  setActive(index: number): void;
  /** Moves the focus to a difference, clamped to the list. */
  moveTo(index: number): void;
  /** Key handler of the grid: arrows, Home/End, Page Up/Down, N. */
  onKeyDown(event: KeyboardEvent<HTMLDivElement>): void;
}

/**
 * Keyboard traversal of the differences (SUT-N-07): the up/down arrows move
 * from one difference to the next, the right/left arrows jump to the next or
 * previous difference, and the N key is the "next difference" shortcut.
 */
export function useDifferenceNavigation(count: number): DifferenceNavigation {
  const [activeIndex, setActiveIndex] = useState(0);
  const [moveTick, setMoveTick] = useState(0);
  const wantsFocus = useRef(false);
  const last = Math.max(0, count - 1);

  const moveTo = useCallback(
    (index: number) => {
      wantsFocus.current = true;
      setActiveIndex(Math.min(Math.max(index, 0), last));
      setMoveTick((tick) => tick + 1);
    },
    [last],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const key = event.key;
      if (key === "ArrowDown" || key === "ArrowRight" || key === "n" || key === "N") {
        event.preventDefault();
        moveTo(activeIndex + 1);
      } else if (key === "ArrowUp" || key === "ArrowLeft") {
        event.preventDefault();
        moveTo(activeIndex - 1);
      } else if (key === "Home") {
        event.preventDefault();
        moveTo(event.ctrlKey ? last : 0);
      } else if (key === "End") {
        event.preventDefault();
        moveTo(last);
      } else if (key === "PageDown" || key === "PageUp") {
        event.preventDefault();
        moveTo(activeIndex + (key === "PageDown" ? PAGE : -PAGE));
      }
    },
    [activeIndex, last, moveTo],
  );

  return { activeIndex, moveTick, wantsFocus, setActive: setActiveIndex, moveTo, onKeyDown };
}
