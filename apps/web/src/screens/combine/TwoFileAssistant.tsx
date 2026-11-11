import { useState, type ChangeEvent, type DragEvent } from "react";
import { useLang } from "../../i18n/lang";
import { translateCommon } from "../../i18n/common";
import { useStore, type StoreAdapter } from "../../store";
import { translateScreen } from "./messages";
import { checkWorkbookFile, scenarioNameFromFile } from "./combine-model";

/** The three files of the "two files received by email" entry. */
interface ThreeFiles {
  original: File | null;
  first: File | null;
  second: File | null;
}

const NO_FILE: ThreeFiles = { original: null, first: null, second: null };

/**
 * The "two files received by email" entry (P6, SUT-F-17).
 * The original workbook plus two copies: two scenarios are created and the
 * meeting starts on the first step of the assistant.
 */
export function TwoFileAssistant(props: { onStarted?: () => void }) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const store = useStore();
  const [files, setFiles] = useState<ThreeFiles>(NO_FILE);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setSlot = (slot: keyof ThreeFiles, file: File) => {
    setProblem(null);
    setFiles((previous) => ({ ...previous, [slot]: file }));
  };

  const start = () =>
    runStart({
      store,
      files,
      t,
      onProblem: setProblem,
      setBusy,
      onStarted: props.onStarted,
    });

  return (
    <section className="two-files" aria-labelledby="two-files-title">
      <h3 id="two-files-title">{t("twoFiles.title")}</h3>
      <p className="step-hint">{t("twoFiles.hint")}</p>
      <SlotsRow files={files} setSlot={setSlot} />
      {problem !== null ? (
        <p className="error-note" role="alert" data-testid="two-files-problem">
          {problem}
        </p>
      ) : null}
      <button
        type="button"
        className="demo-button"
        onClick={() => void start()}
        disabled={busy}
        data-testid="two-files-start"
      >
        {t("twoFiles.start")}
      </button>
    </section>
  );
}

/** The three drop slots, side by side. */
function SlotsRow(props: {
  files: ThreeFiles;
  setSlot: (slot: keyof ThreeFiles, file: File) => void;
}) {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);
  const items: { slot: keyof ThreeFiles; id: string; label: string }[] = [
    { slot: "original", id: "two-files-original", label: t("twoFiles.original") },
    { slot: "first", id: "two-files-first", label: t("twoFiles.first") },
    { slot: "second", id: "two-files-second", label: t("twoFiles.second") },
  ];
  return (
    <div className="two-files-slots">
      {items.map((item) => (
        <FileSlot
          key={item.id}
          id={item.id}
          label={item.label}
          file={props.files[item.slot]}
          onPick={(event) => onPick(event, item.slot, props.setSlot)}
          onDrop={(event) => onDrop(event, item.slot, props.setSlot)}
        />
      ))}
    </div>
  );
}

/** What starting the meeting needs, gathered in one object. */
interface StartArgs {
  store: StoreAdapter;
  files: ThreeFiles;
  t: (key: string) => string;
  onProblem: (message: string | null) => void;
  setBusy: (busy: boolean) => void;
  onStarted?: () => void;
}

/** Checks the three files, creates the scenarios, starts the meeting. */
async function runStart(args: StartArgs): Promise<void> {
  const { store, files, t, onProblem } = args;
  onProblem(null);
  if (files.original === null || files.first === null || files.second === null) {
    onProblem(t("twoFiles.missing"));
    return;
  }
  const problem = checkIssue(files, t);
  if (problem !== null) {
    onProblem(problem);
    return;
  }
  args.setBusy(true);
  try {
    await startMeeting(store, files);
    args.onStarted?.();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    onProblem(t("twoFiles.error").replace("{reason}", reason));
  } finally {
    args.setBusy(false);
  }
}

/** First reason why the files cannot be used, if any. */
function checkIssue(files: ThreeFiles, t: (key: string) => string): string | null {
  for (const file of [files.original, files.first, files.second]) {
    if (file === null) continue;
    const issue = checkWorkbookFile(file);
    if (issue === "type") return t("twoFiles.wrongType");
    if (issue === "size") return t("twoFiles.tooBig");
  }
  return null;
}

/** Creates one scenario per received copy and starts the meeting. */
async function startMeeting(store: StoreAdapter, files: ThreeFiles): Promise<void> {
  const nameA = scenarioNameFromFile(files.first?.name ?? "");
  const nameB = scenarioNameFromFile(files.second?.name ?? "");
  await store.createScenario(nameA);
  await store.createScenario(nameB);
  await store.startCombine(nameA, nameB);
}

/** One drop slot of the assistant. */
function FileSlot(props: {
  id: string;
  label: string;
  file: File | null;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const { lang } = useLang();
  return (
    <div
      className="dropzone file-slot"
      onDragOver={(event) => event.preventDefault()}
      onDrop={props.onDrop}
    >
      <label htmlFor={props.id} className="dropzone-title">
        {props.label}
      </label>
      <input
        id={props.id}
        type="file"
        accept=".xlsx,.xlsm"
        onChange={props.onPick}
        aria-label={props.label}
      />
      <p className="dropzone-received" role="status">
        {props.file === null ? translateCommon(lang, "state.empty") : props.file.name}
      </p>
    </div>
  );
}

/** Reads the file dropped on a slot. */
function onDrop(
  event: DragEvent<HTMLDivElement>,
  slot: keyof ThreeFiles,
  setSlot: (slot: keyof ThreeFiles, file: File) => void,
): void {
  event.preventDefault();
  const file = event.dataTransfer.files.item(0);
  if (file) setSlot(slot, file);
}

/** Reads the file picked in a slot. */
function onPick(
  event: ChangeEvent<HTMLInputElement>,
  slot: keyof ThreeFiles,
  setSlot: (slot: keyof ThreeFiles, file: File) => void,
): void {
  const file = event.target.files?.item(0);
  if (file) setSlot(slot, file);
}
