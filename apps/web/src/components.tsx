import { useState, type DragEvent } from "react";
import type { Lang, MessageKey } from "./i18n";

/** Shared translator type for presentational components. */
export type Translate = (key: MessageKey) => string;

export function Header(props: {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  t: Translate;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="stitch-mark" aria-hidden="true" />
        <h1>Suture</h1>
      </div>
      <label className="lang-picker">
        <span className="visually-hidden">{props.t("settings.language")}</span>
        <select
          value={props.lang}
          onChange={(event) =>
            props.onLangChange(event.target.value === "fr" ? "fr" : "en")
          }
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>
      </label>
    </header>
  );
}

export function DropZone(props: { t: Translate }) {
  const [received, setReceived] = useState<string | null>(null);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files.item(0);
    if (file) setReceived(file.name);
  };
  return (
    <section
      className="dropzone"
      aria-label={props.t("home.drop.title")}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <p className="dropzone-title">{props.t("home.drop.title")}</p>
      <p className="dropzone-hint">{props.t("home.drop.hint")}</p>
      {received !== null && (
        <p className="dropzone-received" role="status">
          {props.t("home.drop.received")} <strong>{received}</strong>
        </p>
      )}
    </section>
  );
}

export function DemoBox(props: { t: Translate }) {
  return (
    <section className="demo">
      <button type="button" className="demo-button" disabled>
        {props.t("home.demo.load")}
      </button>
      <span className="demo-hint">{props.t("home.demo.soon")}</span>
    </section>
  );
}

export function Footer(props: { t: Translate }) {
  return <footer>{props.t("footer.built")}</footer>;
}
