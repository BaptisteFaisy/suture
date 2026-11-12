import type { Translate } from "./logic";

/** Column titles of the grid. */
export function GridHead(props: { t: Translate }) {
  return (
    <div className="comparison-grid__head" role="row">
      <span className="difference-symbol" aria-hidden="true" />
      <span className="difference-sheet">{props.t("grid.sheet")}</span>
      <span className="difference-cell">{props.t("grid.cell")}</span>
      <span className="difference-nature">{props.t("grid.nature")}</span>
      <span className="difference-before">{props.t("grid.before")}</span>
      <span className="difference-arrow" aria-hidden="true" />
      <span className="difference-after">{props.t("grid.after")}</span>
    </div>
  );
}
