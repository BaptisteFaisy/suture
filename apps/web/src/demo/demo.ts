/**
 * Demo loader (SUT-F-31) — the three workbooks of the demo case, published as
 * static files under `apps/web/public/demo/` and served from `/suture/demo/`.
 *
 * The module fetches them in order and hands each one to the store, exactly as
 * if the user had dropped them one by one. The user then starts the comparison
 * herself. If a workbook is not published yet, the module says so plainly and
 * never blocks the screen.
 */

/** The demo trio: the original, then the two copies that diverged. */
export const DEMO_WORKBOOK_PATHS = [
  "/suture/demo/budget-2026.xlsx",
  "/suture/demo/budget-2026-paul.xlsx",
  "/suture/demo/budget-2026-v2-marie-FINAL.xlsx",
] as const;

/** Clear message when the published demo files are missing (404). */
export const DEMO_NOT_PUBLISHED = "the demo workbook is not published yet";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Raised when a demo workbook cannot be downloaded. */
export class DemoNotPublishedError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(DEMO_NOT_PUBLISHED);
    this.name = "DemoNotPublishedError";
    this.path = path;
  }
}

/** The only part of the store this module needs. */
export interface DemoStore {
  trackFile(file: File): Promise<void>;
}

/** File name of a published demo workbook: "budget-2026.xlsx". */
export function demoFileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Downloads one demo workbook; a 404 becomes a clear "not published" error. */
export async function fetchDemoWorkbook(
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<File> {
  let response: Response;
  try {
    response = await fetchImpl(path);
  } catch {
    throw new DemoNotPublishedError(path);
  }
  if (!response.ok) throw new DemoNotPublishedError(path);
  const blob = await response.blob();
  return new File([blob], demoFileName(path), { type: XLSX_MIME });
}

/**
 * Loads the whole demo: each workbook is tracked, in order, so the version
 * store sees the original first and the two divergent copies after it.
 * Returns the number of workbooks tracked.
 */
export async function loadDemoWorkbook(
  store: DemoStore,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  let tracked = 0;
  for (const path of DEMO_WORKBOOK_PATHS) {
    const file = await fetchDemoWorkbook(path, fetchImpl);
    await store.trackFile(file);
    tracked += 1;
  }
  return tracked;
}
