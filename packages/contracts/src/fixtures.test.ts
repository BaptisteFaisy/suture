/**
 * Fixture corpus tests — the generated workbooks must be valid, deterministic
 * and carry the exact differences the demo scenario relies on.
 *
 * The ZIP reader is written here with the Node standard library only: the
 * contracts package must stay free of any external dependency.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const FIXTURES = join(REPO_ROOT, "fixtures");
const DESCRIPTORS = join(FIXTURES, "descriptors");
const GENERATED = join(FIXTURES, "generated");
const BUILDER = join(REPO_ROOT, "tools", "fixture-builder", "build.mjs");

/** One entry of a ZIP central directory. */
interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

/** Finds the End Of Central Directory record, walking back from the end. */
function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) return index;
  }
  throw new Error("not a ZIP archive: no end of central directory");
}

/** Reads the central directory of the archive. */
function readCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(bytes);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("corrupt central directory");
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.push({
      name,
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Reads the payload of one entry, inflating it when needed. */
function readEntry(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const raw = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method !== 8) throw new Error(`unsupported compression method ${entry.method}`);
  return inflateRawSync(raw);
}

/** Unzips an archive into a map of part path → bytes. */
export function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const parts = new Map<string, Uint8Array>();
  for (const entry of readCentralDirectory(bytes)) {
    parts.set(entry.name, readEntry(bytes, entry));
  }
  return parts;
}

/** Unzips a file of the repository. */
function unzipFile(path: string): Map<string, Uint8Array> {
  return unzip(new Uint8Array(readFileSync(path)));
}

/** Reads a part as text. */
function text(parts: Map<string, Uint8Array>, path: string): string {
  const data = parts.get(path);
  if (!data) throw new Error(`missing part: ${path}`);
  return new TextDecoder().decode(data);
}

/** Extracts the shared strings of a workbook. */
function sharedStrings(parts: Map<string, Uint8Array>): string[] {
  const raw = parts.get("xl/sharedStrings.xml");
  if (!raw) return [];
  const xml = new TextDecoder().decode(raw);
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...(match[1] ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((inner) => inner[1] ?? "").join(""),
  );
}

/** A cell of a sheet, reduced to what the demo needs. */
interface Cell {
  value: string;
  formula: string | null;
}

/** Parses the cells of a worksheet into a map of reference → cell. */
function parseCells(parts: Map<string, Uint8Array>, sheetPath: string): Map<string, Cell> {
  const xml = text(parts, sheetPath);
  const strings = sharedStrings(parts);
  const cells = new Map<string, Cell>();
  for (const match of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = match[1] ?? "";
    const attributes = match[2] ?? "";
    const body = match[3] ?? "";
    const formulaMatch = /<f[^>]*>([\s\S]*?)<\/f>/.exec(body);
    const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(body);
    let value = valueMatch ? (valueMatch[1] ?? "") : "";
    if (attributes.includes('t="s"') && valueMatch) {
      value = strings[Number(valueMatch[1])] ?? value;
    } else if (attributes.includes('t="inlineStr"')) {
      value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((inner) => inner[1] ?? "").join("");
    }
    cells.set(ref, { value, formula: formulaMatch ? (formulaMatch[1] ?? null) : null });
  }
  return cells;
}

/** Reads the sheet names of a workbook, in order. */
function sheetNames(parts: Map<string, Uint8Array>): string[] {
  const xml = text(parts, "xl/workbook.xml");
  return [...xml.matchAll(/<sheet[^>]*name="([^"]+)"/g)].map((match) => match[1] ?? "");
}

/** Reads the cells of the first sheet of a workbook. */
function firstSheetCells(parts: Map<string, Uint8Array>): Map<string, Cell> {
  return parseCells(parts, "xl/worksheets/sheet1.xml");
}

/** The amounts of a sheet, indexed by the label of their row (column A). */
function amountsByLabel(cells: Map<string, Cell>): Map<string, string> {
  const amounts = new Map<string, string>();
  for (const [ref, cell] of cells) {
    const row = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!row) continue;
    const label = cells.get(`A${row[2]}`)?.value;
    if (label && row[1] === "B") amounts.set(label, cell.value);
  }
  return amounts;
}

/** The labels of the rows of a sheet. */
function labelsOf(cells: Map<string, Cell>): string[] {
  const labels: string[] = [];
  for (const [ref, cell] of cells) {
    if (/^A\d+$/.test(ref)) labels.push(cell.value);
  }
  return labels;
}

/** The three files of the demo scenario. */
const ORIGINAL = join(GENERATED, "budget-2026.xlsx");
const PAUL = join(GENERATED, "budget-2026-paul.xlsx");
const MARIE = join(GENERATED, "budget-2026-v2-marie-FINAL.xlsx");

/** The descriptors of the corpus, sorted by file name. */
function descriptorFiles(): string[] {
  return readdirSync(DESCRIPTORS)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

/** Reads the output name declared by a descriptor. */
function declaredOutput(descriptorPath: string): string {
  const raw = JSON.parse(readFileSync(descriptorPath, "utf8")) as { output?: string };
  return raw.output ?? `${descriptorPath.split("/").pop()?.replace(/\.json$/, ".xlsx")}`;
}

describe("fixture corpus", () => {
  it("produces one workbook per descriptor", () => {
    for (const name of descriptorFiles()) {
      const output = join(GENERATED, declaredOutput(join(DESCRIPTORS, name)));
      expect(existsSync(output), `${name} should produce ${output}`).toBe(true);
    }
  });

  it("opens every generated workbook (parts listed, workbook part present)", () => {
    for (const name of descriptorFiles()) {
      const output = join(GENERATED, declaredOutput(join(DESCRIPTORS, name)));
      const parts = unzipFile(output);
      expect([...parts.keys()]).toContain("[Content_Types].xml");
      expect([...parts.keys()]).toContain("_rels/.rels");
      expect([...parts.keys()]).toContain("xl/workbook.xml");
      expect([...parts.keys()]).toContain("xl/styles.xml");
      const names = sheetNames(parts);
      expect(names.length).toBeGreaterThan(0);
    }
  });

  it("carries the demo trio (original, Paul, Marie)", () => {
    for (const path of [ORIGINAL, PAUL, MARIE]) {
      expect(existsSync(path)).toBe(true);
      const parts = unzipFile(path);
      expect(sheetNames(parts)).toEqual(["Budget", "Hypothèses"]);
    }
  });
});

describe("demo scenario differences", () => {
  it("Paul corrects three amounts and adds one row", () => {
    const original = amountsByLabel(firstSheetCells(unzipFile(ORIGINAL)));
    const paul = amountsByLabel(firstSheetCells(unzipFile(PAUL)));
    const changed = [...original.keys()].filter(
      (label) => label !== "Total" && original.get(label) !== paul.get(label),
    );
    expect(changed).toEqual(["Énergie", "Fournitures", "Salaires"]);
    expect(paul.get("Énergie")).toBe("2400");
    expect(paul.get("Fournitures")).toBe("950");
    expect(paul.get("Salaires")).toBe("61000");
    // One extra row: the transport line.
    expect(labelsOf(firstSheetCells(unzipFile(PAUL)))).toContain("Transport");
    expect(labelsOf(firstSheetCells(unzipFile(ORIGINAL)))).not.toContain("Transport");
    expect(paul.get("Transport")).toBe("450");
    // The total follows the new row.
    expect(paul.get("Total")).toBe("78300");
  });

  it("Marie changes one hypothesis and one amount, differently from Paul", () => {
    const parts = unzipFile(MARIE);
    const marie = amountsByLabel(firstSheetCells(parts));
    const hypotheses = parseCells(parts, "xl/worksheets/sheet2.xml");
    expect(hypotheses.get("B2")?.value).toBe("0.05");
    expect(marie.get("Salaires")).toBe("62000");
    expect(marie.get("Total")).toBe("78500");
  });

  it("leaves exactly one amount divergent between the two sides", () => {
    const original = amountsByLabel(firstSheetCells(unzipFile(ORIGINAL)));
    const paul = amountsByLabel(firstSheetCells(unzipFile(PAUL)));
    const marie = amountsByLabel(firstSheetCells(unzipFile(MARIE)));
    const labels = new Set([...original.keys()].filter((label) => paul.has(label) && marie.has(label)));
    const divergent: string[] = [];
    for (const label of labels) {
      if (label === "Total") continue;
      const values = new Set([original.get(label), paul.get(label), marie.get(label)]);
      if (values.size > 1) divergent.push(label);
    }
    expect(divergent.sort()).toEqual(["Fournitures", "Salaires", "Énergie"]);
    // Only "Salaires" was corrected on both sides, with two different amounts.
    const bothSides = divergent.filter(
      (label) => original.get(label) !== paul.get(label) && original.get(label) !== marie.get(label),
    );
    expect(bothSides).toEqual(["Salaires"]);
    expect(paul.get("Salaires")).toBe("61000");
    expect(marie.get("Salaires")).toBe("62000");
    expect(original.get("Salaires")).toBe("60000");
  });
});

describe("deterministic build", () => {
  it("rebuilds byte-identical archives", () => {
    const directory = mkdtempSync(join(tmpdir(), "suture-fixtures-"));
    try {
      for (const name of descriptorFiles()) {
        const descriptorPath = join(DESCRIPTORS, name);
        const output = join(directory, declaredOutput(descriptorPath));
        execFileSync("node", [BUILDER, descriptorPath, output], { stdio: "pipe" });
        const rebuilt = new Uint8Array(readFileSync(output));
        const committed = new Uint8Array(readFileSync(join(GENERATED, declaredOutput(descriptorPath))));
        expect(rebuilt.length, `${name} must have the same length`).toBe(committed.length);
        expect(Buffer.from(rebuilt).equals(Buffer.from(committed)), `${name} must be byte-identical`).toBe(true);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
