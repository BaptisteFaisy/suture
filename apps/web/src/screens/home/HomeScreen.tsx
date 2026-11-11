import { useState, type DragEvent } from "react";
import { DemoNotPublishedError, loadDemoWorkbook } from "../../demo/demo";
import { useLang } from "../../i18n/lang";
import { useStore } from "../../store";
import { interpolate } from "../workbook/format";
import { translateScreen } from "./messages";

/** Screen 1 — tracked workbooks, drop zone, demo workbook. */
export function HomeScreen() {
  const { lang } = useLang();
  const t = (key: string) => translateScreen(lang, key);

  return (
    <>
      <section className="screen" aria-labelledby="workbooks-title">
        <h2 id="workbooks-title">{t("workbooks.title")}</h2>
        <WorkbooksPanel t={t} />
      </section>
      <DropZone t={t} />
      <DemoBox t={t} />
    </>
  );
}

function WorkbooksPanel(props: { t: (key: string) => string }) {
  const store = useStore();
  if (store.workbooks.length === 0) {
    return <p className="empty-state">{props.t("workbooks.empty")}</p>;
  }
  return (
    <ul className="workbook-list">
      {store.workbooks.map((workbook) => (
        <li key={workbook.id}>
          <button
            type="button"
            className="workbook-entry"
            onClick={() => store.openWorkbook(workbook.id)}
          >
            {workbook.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

function DropZone(props: { t: (key: string) => string }) {
  const store = useStore();
  const [status, setStatus] = useState<string | null>(null);

  const track = async (file: File) => {
    setStatus(interpolate(props.t("drop.tracking"), { name: file.name }));
    try {
      await store.trackFile(file);
      setStatus(interpolate(props.t("drop.tracked"), { name: file.name }));
    } catch {
      setStatus(null);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void track(file);
  };

  return (
    <section
      className="dropzone"
      aria-label={props.t("drop.title")}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <p className="dropzone-title">{props.t("drop.title")}</p>
      <p className="dropzone-hint">{props.t("drop.hint")}</p>
      <label className="dropzone-picker">
        {props.t("drop.picker")}
        <input
          type="file"
          accept=".xlsx,.xlsm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void track(file);
          }}
        />
      </label>
      {status !== null && (
        <p className="dropzone-received" role="status">
          {status}
        </p>
      )}
      {store.error !== null && (
        <p className="dropzone-error" role="alert">
          {store.error}
        </p>
      )}
    </section>
  );
}

function DemoBox(props: { t: (key: string) => string }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * The store owns the demo (contract). If it cannot load it, the published
   * demo trio is fetched and tracked one workbook at a time — and a missing
   * publication is reported clearly instead of blocking the screen.
   */
  const runDemo = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await store.loadDemo();
    } catch {
      try {
        await loadDemoWorkbook(store);
      } catch (error) {
        setFailure(describeDemoError(error, props.t));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="demo">
      <button
        type="button"
        className="demo-button"
        disabled={!store.demoAvailable}
        onClick={() => void runDemo()}
      >
        {busy ? props.t("demo.loading") : props.t("demo.load")}
      </button>
      {!store.demoAvailable && <span className="demo-hint">{props.t("demo.soon")}</span>}
      {failure !== null && (
        <span className="demo-hint" role="alert">
          {failure}
        </span>
      )}
    </section>
  );
}

/** A missing publication has its own sentence; anything else is generic. */
function describeDemoError(error: unknown, t: (key: string) => string): string {
  if (error instanceof DemoNotPublishedError) return error.message;
  if (error instanceof Error && error.message !== "") return error.message;
  return t("demo.error");
}
