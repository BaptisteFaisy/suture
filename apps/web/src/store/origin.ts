/**
 * The working copy on its way back (SUT-F-06).
 *
 * When a copy leaves Suture it is stamped with the version and the scenario
 * it started from (`./downloadCopy.ts`). When a file comes back, `readMarker`
 * reads that stamp and `decideReturn` tells whether the reference moved since
 * the copy left — in which case Suture must offer a combine, never a blind
 * overwrite (no silent loss).
 *
 * Reading the stamp is delegated to `@suture/ooxml-patch`: this module only
 * interprets the marker, it never touches the workbook XML itself. The
 * canonical derivation strips Suture's own properties before deriving
 * (`@suture/canonical`), so a file that only carries the marker still
 * compares as unchanged.
 */
import type { OriginMarker } from "@suture/contracts";
import { readOriginMarker } from "@suture/ooxml-patch";
import type { AdapterDeps, SessionState } from "./actions";
import type { Registry } from "./registry";

/** Translator supplied by the caller, same shape as the screens use. */
export type Translate = (key: string) => string;

/** What Suture decides when a file comes back. */
export type ReturnDecision =
  /** The tracked workbook is known and the reference did not move. */
  | { kind: "new-version"; workbookId: string }
  /** The reference advanced since the copy left: offer a combine. */
  | {
      kind: "combine-needed";
      workbookId: string;
      baseVersionId: string;
      scenario?: string;
    }
  /** No marker, or no tracked workbook matches: fall back to the file name. */
  | { kind: "unknown" };

/**
 * Reads the origin marker of a file that comes back, or `null` when it
 * carries none (properties lost through another spreadsheet app, plain
 * file…). Typed refusals of the archive reader propagate as they are
 * (SUT-F-04): a file that cannot be opened is explained, never guessed.
 */
export async function readMarker(
  deps: AdapterDeps,
  bytes: Uint8Array,
): Promise<OriginMarker | null> {
  const { parts } = await deps.engines.readWorkbook(bytes);
  return readOriginMarker(parts);
}

/**
 * Decides what a returning file means for the open workbook. The decision is
 * pure: it reads only what the session already knows (versions and scenarios)
 * and what the registry says about the tracked workbook. Anything else is
 * `unknown`, and the caller matches the file by name instead.
 */
export function decideReturn(
  marker: OriginMarker | null,
  registry: Registry,
  session: SessionState,
): ReturnDecision {
  const workbookId = session.workbookId;
  if (marker === null || workbookId === null) return { kind: "unknown" };
  if (registry.find(workbookId) === undefined) return { kind: "unknown" };
  if (!session.versions.some((version) => version.id === marker.versionId)) {
    return { kind: "unknown" };
  }
  if (headOf(session, marker.scenario) === marker.versionId) {
    return { kind: "new-version", workbookId };
  }
  return {
    kind: "combine-needed",
    workbookId,
    baseVersionId: marker.versionId,
    scenario: marker.scenario,
  };
}

/**
 * The version a returning file would sit on top of: the head of the marker's
 * scenario when it names one, the head of the reference otherwise. `null`
 * when the session knows no such scenario — the safe side is then to offer a
 * combine rather than record over an unknown state.
 */
function headOf(session: SessionState, scenario: string | undefined): string | null {
  const wanted =
    scenario === undefined
      ? session.scenarios.find((item) => item.reference)
      : session.scenarios.find((item) => item.name === scenario);
  return wanted?.head ?? null;
}

/** One readable sentence about a returning file; every word comes from the dictionary. */
export function describeReturn(decision: ReturnDecision, translate: Translate): string {
  if (decision.kind === "new-version") return translate("origin.return.new-version");
  if (decision.kind === "combine-needed") return translate("origin.return.combine-needed");
  return translate("origin.return.unknown");
}
