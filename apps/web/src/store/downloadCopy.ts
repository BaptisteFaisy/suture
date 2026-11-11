/**
 * Downloading a working copy — the outgoing half of SUT-F-06.
 *
 * The copy carries the origin marker: the version it starts from and, when
 * known, its scenario. When the file comes back, `./origin.ts` reads the
 * marker and Suture recognises the starting point.
 *
 * The stamp goes through the carrier patcher (`deps.engines.patchWorkbook`)
 * with an empty list of cell patches — the same road a combine takes to
 * stamp its result. The archive is never rebuilt: every business part
 * travels byte-for-byte and only Suture's own document properties are
 * written, so the downloaded copy opens exactly like the stored version.
 */
import type { AdapterDeps, SessionState } from "./actions";

/** File name offered to the user for a working copy of one version. */
export function workingCopyFileName(versionId: string, scenario: string | undefined): string {
  const suffix = scenario === undefined ? "" : `-${scenario}`;
  return `working-copy-${versionId.slice(0, 7)}${suffix}.xlsx`;
}

/**
 * Offers a working copy of `versionId`, stamped with its origin. The scenario
 * defaults to the one the version belongs to, so the marker stays complete
 * even when the caller does not repeat it. Does nothing while no workbook is
 * open.
 */
export async function downloadWorkingCopy(
  deps: AdapterDeps,
  session: SessionState,
  versionId: string,
  scenario?: string,
): Promise<void> {
  const store = session.store;
  if (store === null) return;
  const resolved = scenario ?? scenarioOf(session, versionId);
  const parts = await store.getParts(versionId);
  const patched = await deps.engines.patchWorkbook(parts, {
    patches: [],
    sheetPaths: new Map(),
    originMarker: resolved === undefined ? { versionId } : { versionId, scenario: resolved },
  });
  const bytes = await deps.engines.zipParts(patched.parts);
  deps.host.download(workingCopyFileName(versionId, resolved), bytes);
}

/** The scenario a version belongs to, when the open session knows it. */
function scenarioOf(session: SessionState, versionId: string): string | undefined {
  return session.versions.find((version) => version.id === versionId)?.scenario;
}
