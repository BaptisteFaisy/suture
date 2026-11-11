/**
 * History graph — the thread of a tracked workbook (spec merge-wizard).
 */
import { useMemo } from "react";
import type { Lang } from "../../i18n/lang";
import { formatDate } from "./format";
import {
  layoutThread,
  type ThreadLayout,
  type ThreadPoint,
  type ThreadScenario,
  type ThreadVersion,
} from "./thread-layout";

export interface HistoryGraphProps {
  readonly versions: readonly ThreadVersion[];
  readonly scenarios: readonly ThreadScenario[];
  readonly selectedId: string | null;
  readonly lang: Lang;
  readonly t: (key: string) => string;
  readonly onSelect: (id: string) => void;
}

/** Accessible sentence of a point: "version 3, Nadia, 12 November". */
export function pointLabel(
  version: ThreadVersion,
  index: number,
  lang: Lang,
): string {
  const date = formatDate(version.timestamp, lang);
  if (version.author.trim() === "") return `version ${index + 1}, ${date}`;
  return `version ${index + 1}, ${version.author}, ${date}`;
}

export function HistoryGraph(props: HistoryGraphProps) {
  const layout = useMemo(
    () => layoutThread(props.versions, props.scenarios),
    [props.versions, props.scenarios],
  );
  if (layout.points.length === 0) return null;
  return (
    <figure className="thread-figure" role="group" aria-label={props.t("graph.label")}>
      <div
        className="thread-frame"
        style={{ width: `${layout.width}px`, height: `${layout.height}px` }}
      >
        <ThreadSvg layout={layout} selectedId={props.selectedId} />
        {layout.points.map((point) => (
          <PointButton
            key={point.id}
            point={point}
            selected={point.id === props.selectedId}
            lang={props.lang}
            label={props.t("graph.point")}
            onSelect={props.onSelect}
          />
        ))}
      </div>
      <figcaption className="thread-caption">{props.t("graph.caption")}</figcaption>
    </figure>
  );
}

function ThreadSvg(props: { layout: ThreadLayout; selectedId: string | null }) {
  const { layout } = props;
  return (
    <svg
      className="thread-graph"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      aria-hidden="true"
      focusable="false"
    >
      {layout.lanes.filter((lane) => lane.points.length > 0).map((lane) => (
        <line
          key={lane.name}
          className={
            lane.name === layout.referenceName ? "thread-line" : "thread-line-alt"
          }
          x1={0}
          y1={lane.y}
          x2={layout.width}
          y2={lane.y}
        />
      ))}
      {layout.points.map((point) => (
        <Suture key={point.id} point={point} selected={point.id === props.selectedId} />
      ))}
    </svg>
  );
}

function Suture(props: { point: ThreadPoint; selected: boolean }) {
  const { point } = props;
  if (point.kind === "combine") {
    return (
      <g className="thread-suture">
        <line x1={point.x - 10} y1={point.y - 10} x2={point.x + 10} y2={point.y + 10} />
        <line x1={point.x - 10} y1={point.y + 10} x2={point.x + 10} y2={point.y - 10} />
      </g>
    );
  }
  return (
    <circle
      className={props.selected ? "thread-dot thread-dot-selected" : "thread-dot"}
      cx={point.x}
      cy={point.y}
      r={props.selected ? 9 : 7}
    />
  );
}

function PointButton(props: {
  point: ThreadPoint;
  selected: boolean;
  lang: Lang;
  label: string;
  onSelect: (id: string) => void;
}) {
  const { point } = props;
  const description = pointLabel(point.version, point.index, props.lang);
  return (
    <button
      type="button"
      className={props.selected ? "thread-hit thread-hit-selected" : "thread-hit"}
      style={{ left: `${point.x}px`, top: `${point.y}px` }}
      aria-label={description}
      title={description}
      aria-pressed={props.selected}
      onClick={() => props.onSelect(point.id)}
    >
      <span className="visually-hidden">{props.label}</span>
    </button>
  );
}
