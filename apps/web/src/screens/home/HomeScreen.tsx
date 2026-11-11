import { useState, type DragEvent } from "react";
import { useLang } from "../../i18n/lang";
import { useStore } from "../../store";
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
  const [received, setReceived] = useState<string | null>(null);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files.item(0);
    if (file) setReceived(file.name);
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
      {received !== null && (
        <p className="dropzone-received" role="status">
          {props.t("drop.received")} <strong>{received}</strong>
        </p>
      )}
    </section>
  );
}

function DemoBox(props: { t: (key: string) => string }) {
  const store = useStore();
  return (
    <section className="demo">
      <button
        type="button"
        className="demo-button"
        disabled={!store.demoAvailable}
        onClick={() => void store.loadDemo()}
      >
        {props.t("demo.load")}
      </button>
      {!store.demoAvailable && <span className="demo-hint">{props.t("demo.soon")}</span>}
    </section>
  );
}
