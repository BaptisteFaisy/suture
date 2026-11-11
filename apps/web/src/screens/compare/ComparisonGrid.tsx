import { useCallback, useImperativeHandle, useRef, type Ref } from "react";
import type { Lang } from "../../i18n/lang";
import type { ComparisonRow } from "../../store";
import { GridHead } from "./GridHead";
import { GridRows } from "./GridRows";
import { announcementOf, type Translate } from "./logic";
import { DEFAULT_VIEWPORT, OVERSCAN, ROW_HEIGHT } from "./metrics";
import { useDifferenceNavigation } from "./useDifferenceNavigation";
import { useRowFocus } from "./useRowFocus";
import { useVirtualWindow } from "./useVirtualWindow";

/** What the toolbar of the screen may ask the grid to do. */
export interface ComparisonGridHandle {
  /** Moves the focus to the next difference. */
  nextDifference(): void;
}

export interface ComparisonGridProps {
  rows: ComparisonRow[];
  t: Translate;
  lang: Lang;
  gridRef?: Ref<ComparisonGridHandle>;
}

/**
 * The grid of differences — virtualized so that a hundred thousand
 * differences never block the interface (SUT-N-03), navigable with the
 * keyboard, and announced to screen readers (SUT-N-07).
 */
export function ComparisonGrid(props: ComparisonGridProps) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nav = useDifferenceNavigation(props.rows.length);
  const { window, containerRef, onScroll, scrollToIndex } = useVirtualWindow({
    rowCount: props.rows.length,
    rowHeight: ROW_HEIGHT,
    fallbackViewport: DEFAULT_VIEWPORT,
    overscan: OVERSCAN,
  });

  useRowFocus(nav.activeIndex, nav.moveTick, nav.wantsFocus, rowRefs, scrollToIndex, window);
  useImperativeHandle(
    props.gridRef,
    () => ({ nextDifference: () => nav.moveTo(nav.activeIndex + 1) }),
    [nav],
  );

  const rowRef = useCallback(
    (index: number) => (element: HTMLDivElement | null) => {
      rowRefs.current[index] = element;
    },
    [],
  );

  return (
    <>
      <div
        className="comparison-grid"
        ref={containerRef}
        onScroll={onScroll}
        role="grid"
        aria-rowcount={props.rows.length}
        aria-label={props.t("grid.title")}
      >
        <GridHead t={props.t} />
        <GridRows
          rows={props.rows}
          window={window}
          activeIndex={nav.activeIndex}
          t={props.t}
          lang={props.lang}
          rowRef={rowRef}
          onFocus={nav.setActive}
          onKeyDown={nav.onKeyDown}
        />
      </div>
      <p className="compare-live" role="status" aria-live="polite">
        {announcementOf(props.rows[nav.activeIndex], props.t, props.lang)}
      </p>
    </>
  );
}
