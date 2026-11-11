import type { Lang } from "../../i18n/lang";
import type { ComparisonFilter } from "../../store";
import { counted, type Translate } from "./logic";

export interface FilterBarProps {
  filter: ComparisonFilter;
  /** Sheet identifiers present in the comparison. */
  sheetIds: number[];
  /** Number of differences currently shown. */
  shown: number;
  lang: Lang;
  t: Translate;
  onChange: (filter: Partial<ComparisonFilter>) => void;
}

const NATURES: ComparisonFilter["nature"][] = ["all", "input", "consequence", "format"];

const NATURE_LABEL: Record<ComparisonFilter["nature"], string> = {
  all: "filter.nature.all",
  input: "filter.nature.input",
  consequence: "filter.nature.consequence",
  format: "filter.nature.format",
};

/** Filters of the comparison: one sheet, one nature of difference. */
export function FilterBar(props: FilterBarProps) {
  return (
    <section className="filter-bar" aria-labelledby="filter-title">
      <h3 id="filter-title">{props.t("filter.title")}</h3>
      <label className="filter-field">
        <span>{props.t("filter.sheet")}</span>
        <select
          value={String(props.filter.sheetId)}
          onChange={(event) => {
            const raw = event.target.value;
            props.onChange({ sheetId: raw === "all" ? "all" : Number(raw) });
          }}
        >
          <option value="all">{props.t("filter.sheet.all")}</option>
          {props.sheetIds.map((id) => (
            <option key={id} value={id}>
              {props.t("filter.sheet.option").replace("{id}", String(id))}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="filter-nature">
        <legend>{props.t("filter.nature")}</legend>
        {NATURES.map((nature) => (
          <label key={nature} className="filter-choice">
            <input
              type="radio"
              name="compare-nature"
              value={nature}
              checked={props.filter.nature === nature}
              onChange={() => props.onChange({ nature })}
            />
            <span>{props.t(NATURE_LABEL[nature])}</span>
          </label>
        ))}
      </fieldset>
      <p className="filter-result" role="status">
        {counted(props.t, props.lang, "filter.result", props.shown)}
      </p>
    </section>
  );
}
