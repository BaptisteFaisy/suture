import { useState } from "react";
import { useLang } from "../../i18n/lang";
import { translateScreen } from "./messages";
import { typedContent, type CombineChoice, type Disagreement } from "./combine-model";

/**
 * One snag to mend: the original value, both competing values, and three
 * possible answers (side A, side B, or a typed value).
 */
export function DisagreementCard(props: {
  item: Disagreement;
  choice: CombineChoice | undefined;
  onChoose: (choice: CombineChoice) => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const settled = props.choice !== undefined;

  return (
    <li
      className={settled ? "disagreement settled" : "disagreement open"}
      aria-label={t("aria.disagreement")
        .replace("{ref}", props.item.ref)
        .replace("{sheet}", props.item.sheetName)}
    >
      <DisagreementHead item={props.item} settled={settled} />
      <DisagreementValues item={props.item} />
      <DisagreementChoices
        item={props.item}
        choice={props.choice}
        onChoose={props.onChoose}
      />
    </li>
  );
}

/** The three ways to settle a snag: side A, side B, or a typed value. */
function DisagreementChoices(props: {
  item: Disagreement;
  choice: CombineChoice | undefined;
  onChoose: (choice: CombineChoice) => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const [typed, setTyped] = useState("");
  const custom = props.choice?.pick === "custom" ? props.choice.record.input : "";

  const submitTyped = () => {
    if (typed.trim() === "") return;
    props.onChoose({
      id: props.item.id,
      pick: "custom",
      record: typedContent(props.item.ref, typed),
    });
  };

  return (
    <fieldset className="disagreement-choices">
      <legend>{t("disagreement.choose")}</legend>
      <SideRadio
        name={`pick-${props.item.id}`}
        label={t("disagreement.sideA")}
        checked={props.choice?.pick === "A"}
        onPick={() => props.onChoose({ id: props.item.id, pick: "A" })}
        ariaLabel={t("disagreement.pickA")}
      />
      <SideRadio
        name={`pick-${props.item.id}`}
        label={t("disagreement.sideB")}
        checked={props.choice?.pick === "B"}
        onPick={() => props.onChoose({ id: props.item.id, pick: "B" })}
        ariaLabel={t("disagreement.pickB")}
      />
      <CustomField
        id={`custom-${props.item.id}`}
        value={typed !== "" ? typed : custom}
        onChange={setTyped}
        onApply={submitTyped}
      />
    </fieldset>
  );
}

/** Free-entry field for typing a value instead of picking side A or B. */
function CustomField(props: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <div className="custom-entry">
      <label htmlFor={props.id}>{t("disagreement.custom")}</label>
      <input
        id={props.id}
        type="text"
        value={props.value}
        placeholder={t("disagreement.custom.placeholder")}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onApply}
      />
      <button type="button" onClick={props.onApply} aria-label={t("disagreement.pickCustom")}>
        {t("action.apply")}
      </button>
      <p className="field-hint">{t("disagreement.custom.help")}</p>
    </div>
  );
}

/** Title of the card: cell, sheet and whether it is settled. */
function DisagreementHead(props: { item: Disagreement; settled: boolean }) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  return (
    <p className="disagreement-head">
      <strong className="cell-ref">{props.item.ref}</strong>
      <span className="sheet-name">{props.item.sheetName}</span>
      <span className={props.settled ? "badge settled-badge" : "badge open-badge"}>
        {props.settled ? t("disagreement.settled") : t("disagreement.open")}
      </span>
    </p>
  );
}

/** The original value and the two competing ones, side by side. */
function DisagreementValues(props: { item: Disagreement }) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const values: { label: string; value: string }[] = [
    { label: t("disagreement.original"), value: props.item.base },
    { label: t("disagreement.sideA"), value: props.item.a },
    { label: t("disagreement.sideB"), value: props.item.b },
  ];
  return (
    <dl className="disagreement-values">
      {values.map((entry) => (
        <div key={entry.label}>
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One of the two sides of a disagreement, as a radio button. */
function SideRadio(props: {
  name: string;
  label: string;
  checked: boolean;
  onPick: () => void;
  ariaLabel: string;
}) {
  return (
    <label>
      <input
        type="radio"
        name={props.name}
        checked={props.checked}
        onChange={props.onPick}
        aria-label={props.ariaLabel}
      />
      {props.label}
    </label>
  );
}
