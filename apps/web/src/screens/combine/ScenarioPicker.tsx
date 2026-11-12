import { useState } from "react";
/** A translate function bound to this screen's dictionary. */
export type Translate = (key: string) => string;

/** One scenario the user can pick. */
export interface ScenarioOption {
  name: string;
  reference: boolean;
}

/**
 * Picks two existing scenarios of the tracked workbook and starts the combine
 * (journey P5: "combine into the reference"). The two-file assistant covers
 * journey P6; this covers the case where the copies are already scenarios.
 */
export function ScenarioPicker(props: {
  scenarios: ScenarioOption[];
  onStart(sideA: string, sideB: string): void;
  t: Translate;
}) {
  const [sideA, setSideA] = useState("");
  const [sideB, setSideB] = useState("");
  const ready = sideA !== "" && sideB !== "" && sideA !== sideB;

  if (props.scenarios.length < 2) {
    return <p className="picker-hint">{props.t("picker.needTwo")}</p>;
  }

  return (
    <div className="scenario-picker">
      <p className="picker-title">{props.t("picker.title")}</p>
      <div className="picker-row">
        <label>
          <span>{props.t("picker.first")}</span>
          <select value={sideA} onChange={(event) => setSideA(event.target.value)}>
            <option value="">{props.t("picker.choose")}</option>
            {props.scenarios.map((scenario) => (
              <option key={scenario.name} value={scenario.name}>
                {scenario.reference ? `${props.t("picker.reference")} — ${scenario.name}` : scenario.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{props.t("picker.second")}</span>
          <select value={sideB} onChange={(event) => setSideB(event.target.value)}>
            <option value="">{props.t("picker.choose")}</option>
            {props.scenarios.map((scenario) => (
              <option key={scenario.name} value={scenario.name}>
                {scenario.reference ? `${props.t("picker.reference")} — ${scenario.name}` : scenario.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        className="picker-start"
        disabled={!ready}
        onClick={() => props.onStart(sideA, sideB)}
      >
        {props.t("picker.start")}
      </button>
    </div>
  );
}
