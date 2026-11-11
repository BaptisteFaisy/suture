import type { KeyboardEvent, Ref } from "react";
import type { VirtualWindow } from "@suture/ui";
import type { ComparisonRow } from "../../store";
import { DifferenceRow } from "./DifferenceRow";
import { natureOf, symbolFor, symbolLabel, type Translate } from "./logic";
import { ROW_HEIGHT } from "./metrics";

export interface GridRowsProps {
  rows: ComparisonRow[];
  window: VirtualWindow;
  activeIndex: number;
  t: Translate;
  lang: "en" | "fr";
  rowRef: (index: number) => Ref<HTMLDivElement>;
  onFocus: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** Accessible name of one line of the grid. */
function rowLabel(row: ComparisonRow, index: number, total: number, t: Translate): string {
  return t("grid.rowLabel")
    .replace("{index}", String(index + 1))
    .replace("{total}", String(total))
    .replace("{sheet}", String(row.sheetId))
    .replace("{cell}", row.ref);
}

/** Only the rows of the virtual window are rendered (SUT-N-03). */
export function GridRows(props: GridRowsProps) {
  const slice = props.rows.slice(props.window.start, props.window.end + 1);
  return (
    <div className="comparison-grid__body" style={{ height: props.window.totalHeight }}>
      {slice.map((row, offset) => {
        const index = props.window.start + offset;
        return (
          <div
            key={`${row.sheetId}-${row.ref}-${index}`}
            className="comparison-grid__slot"
            style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
          >
            <DifferenceRow
              row={row}
              symbol={symbolFor(row)}
              symbolLabel={symbolLabel(row, props.t)}
              natureLabel={props.t(`nature.${natureOf(row)}`)}
              rowLabel={rowLabel(row, index, props.rows.length, props.t)}
              lang={props.lang}
              active={index === props.activeIndex}
              rowIndex={index + 2}
              rowRef={props.rowRef(index)}
              onFocus={() => props.onFocus(index)}
              onKeyDown={props.onKeyDown}
            />
          </div>
        );
      })}
    </div>
  );
}
