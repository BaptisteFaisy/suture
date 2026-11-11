import type { Lang } from "../../i18n/lang";
import { VersionList } from "./VersionList";
import type { ThreadVersion } from "./thread-layout";

/** The versions panel of screen 2: the list plus the selected version's note. */
export function VersionPanel(props: {
  readonly versions: readonly ThreadVersion[];
  readonly selected: ThreadVersion | null;
  readonly lang: Lang;
  readonly t: (key: string) => string;
  readonly onSelect: (id: string) => void;
  readonly onMilestone: (id: string) => void;
  readonly onRestore: (id: string) => void;
}) {
  return (
    <section className="version-panel" aria-labelledby="version-title">
      <h3 id="version-title">{props.t("versions.title")}</h3>
      <VersionList
        versions={props.versions}
        selectedId={props.selected?.id ?? null}
        lang={props.lang}
        t={props.t}
        onSelect={props.onSelect}
        onMilestone={props.onMilestone}
        onRestore={props.onRestore}
      />
      {props.selected !== null && (
        <p className="selected-note">
          <span className="visually-hidden">{props.t("versions.selected")}</span>
          {props.selected.note}
        </p>
      )}
    </section>
  );
}

/** The two dialogs of screen 2: naming a version, and restoring one. */
export function ScreenFeedback(props: {
  readonly status: string | null;
  readonly error: string | null;
}) {
  return (
    <>
      <p className="live-region" role="status" aria-live="polite">
        {props.status ?? ""}
      </p>
      {props.error !== null && (
        <p className="error-banner" role="alert">
          {props.error}
        </p>
      )}
    </>
  );
}
