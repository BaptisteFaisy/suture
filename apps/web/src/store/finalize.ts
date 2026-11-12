/**
 * Finishing a combine: resolve the decisions, patch the carrier archive at
 * cell level (never rebuild it), offer the file to the user, and record the
 * result as a version with two origins (SUT-F-22, SUT-F-23).
 */
import type { ReportEntry, SutureStore } from "@suture/contracts";
import type { AdapterDeps, SessionState } from "./actions";
import { refresh } from "./actions";
import { writeLastExport } from "./export-reminder";
import type { Registry } from "./registry";

const CATEGORY_LABELS: Record<ReportEntry["category"], string> = {
  applied: "Applied",
  decided: "Decided",
  "not-carried": "Not carried over",
  "to-review": "To review",
};

/** Renders the report as Markdown: downloadable and attached to the note. */
export function renderReport(entries: readonly ReportEntry[]): string {
  const lines = entries.map((entry) => {
    const where = entry.ref === undefined ? "" : ` \`${entry.ref}\``;
    const detail = entry.detail === undefined ? "" : ` — ${entry.detail}`;
    return `- **${CATEGORY_LABELS[entry.category]}** (${entry.side}) ${entry.sheetName}${where}: ${entry.label}${detail}`;
  });
  return lines.length === 0 ? "_No change to report._" : lines.join("\n");
}

/** Counts per category, for the last step of the assistant. */
export function reportCounts(entries: readonly ReportEntry[]) {
  const counts = { applied: 0, decided: 0, "not-carried": 0, "to-review": 0 };
  for (const entry of entries) counts[entry.category] += 1;
  return counts;
}

/** File name offered to the user for the combined workbook. */
export function combinedFileName(workbookName: string): string {
  const base = workbookName.replace(/\.(xlsx|xlsm)$/i, "");
  return `${base}-combined.xlsx`;
}

/**
 * Applies the decisions, patches the carrier and records the combined version.
 * Throws when a disagreement is still open — the assistant must not be able to
 * save a half-decided combine (SUT-F-19).
 */
export async function finalizeCombine(
  deps: AdapterDeps,
  registry: Registry,
  session: SessionState,
): Promise<SessionState> {
  const { plan, sides, store } = session;
  if (plan === null || sides === null || store === null) return session;

  const resolved = await deps.engines.resolveMerge(plan, Object.values(session.choices));
  const carrierVersion = plan.carrier === "A" ? sides.a : sides.b;
  const [carrierParts, carrierView] = await Promise.all([
    store.getParts(carrierVersion),
    store.getCanonical(carrierVersion),
  ]);

  const sheetPaths = new Map<number, string>();
  for (const sheet of carrierView.meta.sheets) sheetPaths.set(sheet.sheetId, sheet.path);

  const patched = await deps.engines.patchWorkbook(carrierParts, {
    patches: resolved.patches,
    sheetPaths,
    originMarker: { versionId: carrierVersion, scenario: plan.carrier },
  });
  const bytes = await deps.engines.zipParts(patched.parts);
  const report = renderReport(resolved.report);
  const name = registry.find(session.workbookId ?? "")?.name ?? "workbook.xlsx";

  deps.host.download(combinedFileName(name), bytes);
  await store.commitCombine({
    file: bytes,
    note: `Combined ${sides.a.slice(0, 7)} and ${sides.b.slice(0, 7)}`,
    author: registry.author(),
    parents: [sides.a, sides.b],
    report,
  });

  // The plan is kept so the last step can show the report; only the pending
  // decisions are cleared.
  return refresh({ ...session, choices: {}, report: resolved.report });
}

/** Restores a version as a new version, then refreshes the history. */
export async function restoreVersion(
  session: SessionState,
  registry: Registry,
  versionId: string,
): Promise<SessionState> {
  const store: SutureStore | null = session.store;
  if (store === null) return session;
  await store.restore(versionId, `Restored ${versionId.slice(0, 7)}`, registry.author());
  return refresh(session);
}

/** Downloads the clonable archive of the tracked workbook (SUT-F-29). */
export async function exportWorkbook(deps: AdapterDeps, session: SessionState, name: string) {
  if (session.store === null) return;
  const bytes = await session.store.exportBundle();
  deps.host.download(`${name.replace(/\.(xlsx|xlsm)$/i, "")}-suture.zip`, bytes);
  // Every export goes through here, so the reminder of SUT-N-05 has one date
  // to read: the moment this archive was offered to the user.
  writeLastExport(deps.host.settings, deps.host.now());
}

/** Downloads one past version exactly as it was stored (SUT-F-05). */
export async function downloadVersion(deps: AdapterDeps, session: SessionState, versionId: string) {
  if (session.store === null) return;
  const bytes = await session.store.restoreFile(versionId);
  deps.host.download(`version-${versionId.slice(0, 7)}.xlsx`, bytes);
}
