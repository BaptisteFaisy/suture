import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";
import type { Fallback, ReportEntry, Side } from "./combine-model";

/**
 * Safe fallback notice — a sheet whose layout was changed differently on
 * both sides. Nothing is applied to it: the user keeps one side and the
 * changes of the other side are listed, never dropped silently.
 */
export function FallbackNotice(props: {
  fallback: Fallback;
  kept: Side | undefined;
  lostChanges: readonly ReportEntry[];
  onKeep: (side: Side) => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <li
      className="fallback"
      aria-label={t("aria.fallback").replace("{sheet}", props.fallback.sheetName)}
    >
      <h4 className="fallback-title">
        <span className="snag-mark" aria-hidden="true" />
        {t("fallback.title")} — {props.fallback.sheetName}
      </h4>
      <p className="fallback-explain">{t("fallback.explain")}</p>
      <SidePicker
        name={`keep-${props.fallback.sheetName}`}
        kept={props.kept}
        onKeep={props.onKeep}
      />
      <LostChanges entries={props.lostChanges} />
    </li>
  );
}

/** Which side of the refused sheet the user keeps. */
function SidePicker(props: {
  name: string;
  kept: Side | undefined;
  onKeep: (side: Side) => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const sides: { side: Side; label: string }[] = [
    { side: "A", label: t("fallback.keepA") },
    { side: "B", label: t("fallback.keepB") },
  ];
  return (
    <fieldset className="fallback-choices">
      <legend>{t("fallback.kept")}</legend>
      {sides.map((item) => (
        <label key={item.side}>
          <input
            type="radio"
            name={props.name}
            checked={props.kept === item.side}
            onChange={() => props.onKeep(item.side)}
            aria-label={item.label}
          />
          {item.label}
        </label>
      ))}
    </fieldset>
  );
}

/** Changes of the side not kept: listed, to be applied by hand. */
function LostChanges(props: { entries: readonly ReportEntry[] }) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <div className="fallback-lost">
      <h5>{t("fallback.lost")}</h5>
      {props.entries.length === 0 ? (
        <p className="empty-state">{t("fallback.lost.empty")}</p>
      ) : (
        <ul className="lost-list">
          {props.entries.map((entry, index) => (
            <li key={`${entry.sheetName}-${entry.ref ?? index}`}>
              <span className="cell-ref">{entry.ref ?? ""}</span> {entry.label}
              {entry.detail ? <span className="field-hint"> — {entry.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
