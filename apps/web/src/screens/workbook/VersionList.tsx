/**
 * Version list — one row per version: note, author, date, number of origins,
 * and the actions "put a milestone" (SUT-F-28) and "restore" (SUT-F-27).
 */
import type { Lang } from "../../i18n/lang";
import { formatDateTime } from "./format";
import { orderVersions, type ThreadVersion } from "./thread-layout";

export interface VersionListProps {
  readonly versions: readonly ThreadVersion[];
  readonly selectedId: string | null;
  readonly lang: Lang;
  readonly t: (key: string) => string;
  readonly onSelect: (id: string) => void;
  readonly onMilestone: (id: string) => void;
  readonly onRestore: (id: string) => void;
}

export function VersionList(props: VersionListProps) {
  if (props.versions.length === 0) {
    return <p className="empty-state">{props.t("versions.empty")}</p>;
  }
  const newestFirst = [...orderVersions(props.versions)].reverse();
  const ranks = versionRanks(props.versions);
  return (
    <ul className="version-list">
      {newestFirst.map((version) => (
        <VersionRow
          key={version.id}
          version={version}
          number={ranks.get(version.id) ?? 0}
          selected={version.id === props.selectedId}
          lang={props.lang}
          t={props.t}
          onSelect={props.onSelect}
          onMilestone={props.onMilestone}
          onRestore={props.onRestore}
        />
      ))}
    </ul>
  );
}

/** Rank of every version on the thread, oldest first — same numbering as the graph. */
function versionRanks(versions: readonly ThreadVersion[]): Map<string, number> {
  return new Map(orderVersions(versions).map((version, index) => [version.id, index + 1]));
}

function VersionRow(props: {
  version: ThreadVersion;
  number: number;
  selected: boolean;
  lang: Lang;
  t: (key: string) => string;
  onSelect: (id: string) => void;
  onMilestone: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const { version, t } = props;
  return (
    <li className={props.selected ? "version-row selected" : "version-row"}>
      <button
        type="button"
        className="version-open"
        aria-pressed={props.selected}
        onClick={() => props.onSelect(version.id)}
      >
        <VersionNote version={version} number={props.number} lang={props.lang} t={t} />
      </button>
      <VersionActions
        version={version}
        t={t}
        onMilestone={props.onMilestone}
        onRestore={props.onRestore}
      />
    </li>
  );
}

/** Note, author, date and number of origins of one version. */
function VersionNote(props: {
  version: ThreadVersion;
  number: number;
  lang: Lang;
  t: (key: string) => string;
}) {
  const { version, lang, t } = props;
  const combine = version.parents >= 2;
  return (
    <>
      <span className="version-note">
        <span className="version-rank">{`${t("versions.rank")} ${props.number}`}</span>{" "}
        {version.note || t("versions.untitled")}
      </span>
      <span className="version-meta">
        {version.author !== "" ? `${version.author} · ` : ""}
        {formatDateTime(version.timestamp, lang)}
        {" · "}
        {combine ? t("versions.twoOrigins") : t("versions.oneOrigin")}
      </span>
      {version.milestone !== undefined && (
        <span className="version-milestone" title={version.milestone}>
          ◆ {version.milestone}
        </span>
      )}
    </>
  );
}

/** The two actions of a version: name it, or restore it. */
function VersionActions(props: {
  version: ThreadVersion;
  t: (key: string) => string;
  onMilestone: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const { version, t } = props;
  return (
    <div className="version-actions">
      <button type="button" onClick={() => props.onMilestone(version.id)}>
        {t("versions.milestone")}
      </button>
      <button type="button" onClick={() => props.onRestore(version.id)}>
        {t("versions.restore")}
      </button>
    </div>
  );
}
