import { useState } from "react";
import { useLang } from "../../i18n/lang";
import { useStore } from "../../store";
import { translateScreen } from "./messages";
import { StepOne } from "./StepOne";
import { StepTwo } from "./StepTwo";
import { StepThree } from "./StepThree";
import { TwoFileAssistant } from "./TwoFileAssistant";
import {
  canBuildReport,
  type CombineChoice,
  type CombineState,
  type CombineStep,
  type Side,
} from "./combine-model";
import "./combine.css";

/**
 * Screen 4 — the combine assistant in three steps:
 * what applies on its own, the disagreements to settle, the report and the
 * download. One question per step.
 */
export function CombineScreen() {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const store = useStore();
  const [step, setStep] = useState<CombineStep>(1);
  const [chosenFallbacks, setChosenFallbacks] = useState<Record<string, Side>>({});
  const [finished, setFinished] = useState(false);

  const state = store.combine;

  if (state === null) {
    return (
      <section className="screen" aria-labelledby="combine-title">
        <h2 id="combine-title">{t("title")}</h2>
        <p className="step-hint">{t("subtitle")}</p>
        <TwoFileAssistant onStarted={() => setStep(1)} />
      </section>
    );
  }

  const onCombine = () => {
    void store.finalizeCombine().then(() => setFinished(true));
    setStep(3);
  };

  return (
    <section className="screen" aria-labelledby="combine-title">
      <h2 id="combine-title">{t("title")}</h2>
      <p className="step-hint">{t("subtitle")}</p>
      <StepIndicator step={step} />
      <CombineSteps
        step={step}
        state={state}
        chosenFallbacks={chosenFallbacks}
        ready={canBuildReport(state, chosenFallbacks) && finished}
        onChoose={(choice: CombineChoice) => store.chooseDisagreement(choice.id, choice)}
        onKeepSide={(sheetName: string, side: Side) =>
          setChosenFallbacks((previous) => ({ ...previous, [sheetName]: side }))
        }
        onCombine={onCombine}
        onBack={() => setStep(2)}
        onNext={() => setStep(2)}
        onDownloadWorkbook={() => void store.finalizeCombine()}
      />
    </section>
  );
}

/** Props shared by the three steps of the assistant. */
interface StepsProps {
  step: CombineStep;
  state: CombineState;
  chosenFallbacks: Readonly<Record<string, Side>>;
  ready: boolean;
  onChoose: (choice: CombineChoice) => void;
  onKeepSide: (sheetName: string, side: Side) => void;
  onCombine: () => void;
  onBack: () => void;
  onNext: () => void;
  onDownloadWorkbook: () => void;
}

/** The step being displayed, one at a time. */
function CombineSteps(props: StepsProps) {
  if (props.step === 1) {
    return <StepOne changes={props.state.automatic} onContinue={props.onNext} />;
  }
  if (props.step === 2) {
    return (
      <StepTwo
        state={props.state}
        chosenFallbacks={props.chosenFallbacks}
        onChoose={props.onChoose}
        onKeepSide={props.onKeepSide}
        onCombine={props.onCombine}
      />
    );
  }
  return (
    <StepThree
      entries={props.state.report}
      workbookReady={props.ready}
      onDownloadWorkbook={props.onDownloadWorkbook}
      onBack={props.onBack}
    />
  );
}

/** The three questions of the assistant, named and not numbered only. */
function StepIndicator(props: { step: CombineStep }) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const steps: { id: CombineStep; label: string }[] = [
    { id: 1, label: t("step.indicator.one") },
    { id: 2, label: t("step.indicator.two") },
    { id: 3, label: t("step.indicator.three") },
  ];
  return (
    <nav className="step-indicator" aria-label={t("aria.stepRegion")}>
      <ol>
        {steps.map((item) => (
          <li
            key={item.id}
            className={item.id === props.step ? "current" : undefined}
            aria-current={item.id === props.step ? "step" : undefined}
          >
            <span className="step-number">{item.id}</span>
            <span className="step-name">{item.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
