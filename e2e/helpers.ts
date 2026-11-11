import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * LibreOffice smoke helpers — shared by the end-to-end specs so the
 * conversion logic lives in exactly one place.
 *
 * The conversion runs with a temporary HOME and an isolated user profile
 * (`-env:UserInstallation`) so the existing LibreOffice profile of the
 * machine is never touched. Everything is written under a temporary
 * directory only.
 */

/**
 * CSV export filter: comma separated, UTF-8, first sheet, values exported raw
 * (token 9 "save cell contents as shown" is false, so the decided value reads
 * "62000" regardless of the cell's currency format or the machine's locale).
 */
export const CSV_FILTER =
  "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,0";

const SOFFICE_CANDIDATES = ["/usr/bin/soffice", "/usr/local/bin/soffice", "soffice"];

/** Locates the soffice binary; null when LibreOffice is not installed. */
export async function findSoffice(): Promise<string | null> {
  for (const binary of SOFFICE_CANDIDATES) {
    try {
      await execFileAsync(binary, ["--version"], { timeout: 30_000 });
      return binary;
    } catch {
      // Not this one — try the next candidate.
    }
  }
  return null;
}

/**
 * Converts a workbook to CSV with headless LibreOffice and returns the CSV
 * text. Throws when the conversion fails or produces no CSV file.
 */
export async function convertToCsv(soffice: string, workbook: string): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suture-lo-"));
  const outDir = path.join(tmp, "out");
  fs.mkdirSync(outDir, { recursive: true });
  await execFileAsync(
    soffice,
    [
      "--headless",
      "--norestore",
      `-env:UserInstallation=file://${path.join(tmp, "profile")}`,
      "--convert-to",
      CSV_FILTER,
      "--outdir",
      outDir,
      workbook,
    ],
    { timeout: 120_000, env: { ...process.env, HOME: tmp } },
  );
  const produced = fs
    .readdirSync(outDir)
    .find((name) => name.toLowerCase().endsWith(".csv"));
  if (produced === undefined) {
    throw new Error(`LibreOffice produced no CSV in ${outDir}`);
  }
  return fs.readFileSync(path.join(outDir, produced), "utf8");
}
