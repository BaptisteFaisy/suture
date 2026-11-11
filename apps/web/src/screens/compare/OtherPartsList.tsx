import type { ComparisonView } from "../../store";
import type { Translate } from "./logic";

export interface OtherPartsListProps {
  otherParts: ComparisonView["otherParts"];
  t: Translate;
}

/**
 * Parts of the workbook that are compared by fingerprint only (SUT-F-15):
 * charts, pivot tables, macros and styles. Their state is stated, never
 * detailed as a cell change.
 */
export function OtherPartsList(props: OtherPartsListProps) {
  return (
    <section className="compare-other-parts" aria-labelledby="other-parts-title">
      <h3 id="other-parts-title">{props.t("otherParts.title")}</h3>
      {props.otherParts.length === 0 ? (
        <p>{props.t("otherParts.none")}</p>
      ) : (
        <ul>
          {props.otherParts.map((part) => (
            <li key={part}>
              {part} — {props.t("otherParts.changed")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
