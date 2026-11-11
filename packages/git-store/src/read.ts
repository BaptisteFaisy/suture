/**
 * Reading a version back: the file list of a commit, its OOXML parts and its
 * canonical cell view. Everything goes through the object database, so a
 * version stays readable even if the working directory was never written.
 */
import git from "isomorphic-git";
import type { SutureFs } from "./fs";
import type {
  CanonicalWorkbook,
  CellRecord,
  OoxmlParts,
  SheetMeta,
  SheetState,
} from "@suture/contracts";
import { parseCellsTsv } from "@suture/canonical";
import type { WorkbookJson } from "@suture/canonical";
import { CELLS_DIR, OOXML_DIR, WORKBOOK_JSON, isCellsPath, isPartPath, partName } from "./layout";

/** Every file path of one commit's tree. */
export async function filesOf(fs: SutureFs, dir: string, oid: string): Promise<string[]> {
  return git.listFiles({ fs, dir, ref: oid });
}

/** Reads one file of a commit as bytes. */
export async function readBlob(
  fs: SutureFs,
  dir: string,
  oid: string,
  filepath: string,
): Promise<Uint8Array> {
  const { blob } = await git.readBlob({ fs, dir, oid, filepath });
  return blob;
}

/** Reads one file of a commit as text. */
export async function readText(
  fs: SutureFs,
  dir: string,
  oid: string,
  filepath: string,
): Promise<string> {
  return new TextDecoder().decode(await readBlob(fs, dir, oid, filepath));
}

/** The OOXML parts of one version, sorted by path, bytes untouched. */
export async function partsOf(fs: SutureFs, dir: string, oid: string): Promise<OoxmlParts> {
  const commit = await git.readCommit({ fs, dir, oid });
  const paths = await filesOf(fs, dir, oid);
  const parts: OoxmlParts = [];
  for (const path of paths.filter(isPartPath).sort()) {
    const data = await readBlob(fs, dir, commit.commit.tree, path);
    parts.push({ path: partName(path), data });
  }
  return parts;
}

/** Sheet cell views of one version, keyed by their `cells/` file name. */
export async function cellsOf(
  fs: SutureFs,
  dir: string,
  oid: string,
): Promise<{ meta: WorkbookJson; sheets: { file: string; cells: CellRecord[] }[] }> {
  const commit = await git.readCommit({ fs, dir, oid });
  const tree = commit.commit.tree;
  const paths = await filesOf(fs, dir, oid);
  const raw = await readText(fs, dir, tree, WORKBOOK_JSON);
  const meta = JSON.parse(raw) as WorkbookJson;
  const sheets: { file: string; cells: CellRecord[] }[] = [];
  for (const path of paths.filter(isCellsPath).sort()) {
    const text = await readText(fs, dir, tree, path);
    sheets.push({ file: path.slice(CELLS_DIR.length + 1), cells: parseCellsTsv(text) });
  }
  return { meta, sheets };
}

/** Rebuilds the canonical workbook of one version. */
export async function canonicalOf(
  fs: SutureFs,
  dir: string,
  oid: string,
): Promise<CanonicalWorkbook> {
  const { meta, sheets } = await cellsOf(fs, dir, oid);
  const sheetMetas: SheetMeta[] = meta.sheets.map((sheet, order) => ({
    sheetId: sheet.sheetId,
    name: sheet.name,
    order: sheet.order ?? order,
    state: toSheetState(sheet.state),
    path: sheet.path,
  }));
  return {
    meta: { sheets: sheetMetas, definedNames: meta.definedNames ?? [] },
    sheets: sheetMetas.map((sheetMeta, order) => ({
      meta: sheetMeta,
      cells: sheets[order]?.cells ?? [],
    })),
  };
}

/** True when a path belongs to the OOXML view (used by the exporter). */
export function isOoxmlPath(path: string): boolean {
  return path.startsWith(`${OOXML_DIR}/`);
}

/** Visibility as stored in `_workbook.json`, narrowed to the contract's union. */
export function toSheetState(state: string | undefined): SheetState {
  if (state === "hidden" || state === "veryHidden") return state;
  return "visible";
}
