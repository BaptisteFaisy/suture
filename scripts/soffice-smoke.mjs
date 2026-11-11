#!/usr/bin/env node
/**
 * soffice-smoke — test de fumée LibreOffice du fichier RÉUNI (cahier B.11) :
 * « le fichier réuni doit s'ouvrir dans une suite bureautique libre sans
 * message d'erreur ni réparation ».
 *
 * Usage : node scripts/soffice-smoke.mjs <fichier-réuni.xlsx>
 *
 * Convertit le classeur avec LibreOffice headless (`soffice --headless
 * --convert-to xlsx --outdir <tmp> <fichier>`), puis vérifie que le fichier
 * de sortie existe, n'est pas vide, et que son zip est intègre (`unzip -t`).
 * Le profil LibreOffice est isolé dans un dossier temporaire : les deux
 * exécuteurs du poste partagent le même utilisateur, une conversion ne doit
 * jamais dépendre d'une session bureautique déjà ouverte.
 *
 * Code de sortie : 0 = fumée verte, 1 = échec (message sur stderr).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const source = process.argv[2];
if (!source) {
  console.error("usage : node scripts/soffice-smoke.mjs <fichier-réuni.xlsx>");
  process.exit(1);
}
const input = resolve(source);
const stats = statSync(input, { throwIfNoEntry: false });
if (!stats || stats.size === 0) {
  console.error(`ÉCHEC : fichier réuni absent ou vide — ${input}`);
  process.exit(1);
}

const workdir = mkdtempSync(join(tmpdir(), "suture-soffice-"));
const outdir = join(workdir, "out");
const profile = join(workdir, "profil");

function run(command, args, label) {
  const started = Date.now();
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    console.error(`ÉCHEC : ${label} — ${result.error.message}`);
    process.exit(1);
  }
  return { status: result.status ?? 1, seconds: (Date.now() - started) / 1000 };
}

try {
  const conversion = run(
    "soffice",
    [
      `-env:UserInstallation=file://${profile}`,
      "--headless",
      "--convert-to",
      "xlsx",
      "--outdir",
      outdir,
      input,
    ],
    "conversion LibreOffice",
  );
  if (conversion.status !== 0) {
    console.error(
      `ÉCHEC : soffice a terminé avec le code ${conversion.status} ` +
        `(${conversion.seconds.toFixed(1)} s)`,
    );
    process.exit(1);
  }

  const output = join(outdir, basename(input));
  const size = statSync(output, { throwIfNoEntry: false })?.size ?? 0;
  if (size === 0) {
    console.error(`ÉCHEC : fichier converti absent ou vide — ${output}`);
    process.exit(1);
  }

  const integrity = run("unzip", ["-t", output], "test d'intégrité du zip");
  if (integrity.status !== 0) {
    console.error(`ÉCHEC : zip du fichier converti non intègre (unzip -t, code ${integrity.status})`);
    process.exit(1);
  }

  console.log(
    `fumée LibreOffice OK : conversion headless en ${conversion.seconds.toFixed(1)} s, ` +
      `${size} octets, zip intègre`,
  );
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
