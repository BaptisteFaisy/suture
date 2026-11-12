import type { KeyboardEvent, Ref } from "react";
import { formatValue } from "@suture/ui";
import type { Lang } from "../../i18n/lang";
import type { ComparisonRow } from "../../store";

/** Props of one line of the difference grid. */
export interface DifferenceRowProps {
  row: ComparisonRow;
  /** Symbol of the gutter, never the colour alone (SUT-N-07). */
  symbol: string;
  /** Accessible name of the symbol. */
  symbolLabel: string;
  /** Textual nature of the difference. */
  natureLabel: string;
  /** Accessible name of the whole line. */
  rowLabel: string;
  lang: Lang;
  /** True when this line carries the keyboard focus. */
  active: boolean;
  /** Position of the line in the whole grid (header excluded). */
  rowIndex: number;
  rowRef: Ref<HTMLDivElement>;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** One difference: symbol, sheet, cell, nature and the values before / after. */
export function DifferenceRow(props: DifferenceRowProps) {
  const { row } = props;
  const before = formatValue(row.before, props.lang);
  const after = formatValue(row.after, props.lang);
  const className = `difference-row difference-row--${row.nature}${
    props.active ? " difference-row--active" : ""
  }`;

  return (
    <div
      ref={props.rowRef}
      className={className}
      role="row"
      aria-rowindex={props.rowIndex}
      aria-label={props.rowLabel}
      tabIndex={props.active ? 0 : -1}
      onFocus={props.onFocus}
      onKeyDown={props.onKeyDown}
    >
      <span className="difference-symbol" role="img" aria-label={props.symbolLabel}>
        {props.symbol}
      </span>
      <span className="difference-sheet" role="gridcell">
        {row.sheetId}
      </span>
      <span className="difference-cell" role="gridcell">
        {row.ref}
      </span>
      <span className="difference-nature" role="gridcell">
        {props.natureLabel}
      </span>
      <span className="difference-before" role="gridcell">
        {before}
      </span>
      <span className="difference-arrow" aria-hidden="true">
        →
      </span>
      <span className="difference-after" role="gridcell">
        {after}
      </span>
    </div>
  );
}
