/**
 * Descriptor parsing and validation.
 *
 * A descriptor is plain JSON: it lists the sheets, the cells and a few
 * workbook-level options. Nothing here touches the filesystem; the builder
 * turns the normalized descriptor into OOXML parts.
 */

/** Workbook-level options, with their default value. */
export const DEFAULT_OPTIONS = {
  sharedStrings: true,
  sharedFormulas: false,
  hiddenSheet: false,
  chart: false,
  macro: false,
};

const REF_PATTERN = /^[A-Z]{1,3}[1-9][0-9]*$/;
const KNOWN_ERRORS = ["#DIV/0!", "#N/A", "#NAME?", "#NULL!", "#NUM!", "#REF!", "#VALUE!"];

/** Throws a descriptive error when the descriptor does not follow the schema. */
function fail(source, message) {
  throw new Error(`${source}: ${message}`);
}

/** Normalizes the `options` block, rejecting unknown keys. */
export function normalizeOptions(raw, source) {
  if (raw === undefined) return { ...DEFAULT_OPTIONS };
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    fail(source, "`options` must be an object");
  }
  const options = { ...DEFAULT_OPTIONS };
  for (const key of Object.keys(raw)) {
    if (!(key in DEFAULT_OPTIONS)) fail(source, `unknown option \`${key}\``);
    const value = raw[key];
    if (typeof value !== "boolean") fail(source, `option \`${key}\` must be a boolean`);
    options[key] = value;
  }
  return options;
}

/** Reads the kind of a literal value. */
function kindOfValue(value) {
  if (typeof value === "boolean") return "b";
  if (typeof value === "number") return "n";
  return "s";
}

/** Normalizes one cell entry of the descriptor. */
function normalizeCell(raw, sheetName, index, options, source) {
  const where = `sheet \`${sheetName}\` cell #${index}`;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    fail(source, `${where} must be an object`);
  }
  if (typeof raw.ref !== "string" || !REF_PATTERN.test(raw.ref)) {
    fail(source, `${where} needs a valid \`ref\` (e.g. "B4")`);
  }
  const cell = {
    ref: raw.ref,
    kind: "blank",
    value: null,
    formula: null,
    cached: null,
    format: null,
    shared: null,
  };
  if (typeof raw.format === "string" && raw.format.length > 0) cell.format = raw.format;
  if (raw.shared !== undefined) {
    if (!options.sharedFormulas) {
      fail(source, `${where} declares a shared formula but the option \`sharedFormulas\` is off`);
    }
    cell.shared = normalizeShared(raw.shared, where, source);
  }
  if (typeof raw.error === "string") {
    if (!KNOWN_ERRORS.includes(raw.error)) fail(source, `${where} has an unknown error \`${raw.error}\``);
    cell.kind = "e";
    cell.value = raw.error;
    return cell;
  }
  if (raw.formula !== undefined) {
    if (typeof raw.formula !== "string") fail(source, `${where} has a non-string \`formula\``);
    cell.kind = "f";
    cell.formula = raw.formula.startsWith("=") ? raw.formula.slice(1) : raw.formula;
    if (raw.cached !== undefined) cell.cached = raw.cached;
    return cell;
  }
  if (cell.shared && !cell.shared.master) {
    // Follower of a shared formula: the text lives in the master cell.
    cell.kind = "f";
    cell.formula = null;
    if (raw.cached !== undefined) cell.cached = raw.cached;
    return cell;
  }
  if (raw.value !== undefined && raw.value !== null) {
    if (typeof raw.value !== "string" && typeof raw.value !== "number" && typeof raw.value !== "boolean") {
      fail(source, `${where} has an unsupported \`value\` type`);
    }
    cell.kind = kindOfValue(raw.value);
    cell.value = raw.value;
    return cell;
  }
  if (raw.styleOnly === true) {
    cell.kind = "blank";
    return cell;
  }
  fail(source, `${where} has neither \`value\`, \`formula\` nor \`error\``);
  return cell;
}

/** Normalizes the shared-formula marker of a cell. */
function normalizeShared(raw, where, source) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    fail(source, `${where} has an invalid \`shared\` marker`);
  }
  const shared = { si: String(raw.si ?? "0"), master: raw.master === true, ref: null };
  if (raw.ref !== undefined) {
    if (typeof raw.ref !== "string" || !/^[A-Z]{1,3}[1-9][0-9]*:[A-Z]{1,3}[1-9][0-9]*$/.test(raw.ref)) {
      fail(source, `${where} has an invalid shared \`ref\` range`);
    }
    shared.ref = raw.ref;
  }
  if (shared.master && !shared.ref) {
    fail(source, `${where} is a shared-formula master but has no \`ref\` range`);
  }
  return shared;
}

/** Normalizes one sheet entry of the descriptor. */
function normalizeSheet(raw, index, total, options, source) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    fail(source, `sheet #${index} must be an object`);
  }
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    fail(source, `sheet #${index} needs a \`name\``);
  }
  if (!Array.isArray(raw.cells)) fail(source, `sheet \`${raw.name}\` needs a \`cells\` array`);
  const cells = raw.cells.map((cell, cellIndex) =>
    normalizeCell(cell, raw.name, cellIndex, options, source),
  );
  const sheet = { name: raw.name, hidden: raw.hidden === true, cells };
  // `hiddenSheet: true` hides the last sheet (the usual "helper sheet" pattern).
  // A sheet that states `hidden` explicitly always wins.
  const explicit = Object.hasOwn(raw, "hidden");
  if (options.hiddenSheet && index === total - 1 && !explicit) sheet.hidden = true;
  return sheet;
}

/** Parses and validates a descriptor, returning its normalized form. */
export function parseDescriptor(raw, source = "descriptor") {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    fail(source, "the descriptor must be a JSON object");
  }
  if (!Array.isArray(raw.sheets) || raw.sheets.length === 0) {
    fail(source, "the descriptor needs at least one sheet");
  }
  const options = normalizeOptions(raw.options, source);
  const sheets = raw.sheets.map((sheet, index) =>
    normalizeSheet(sheet, index, raw.sheets.length, options, source),
  );
  const name = typeof raw.name === "string" && raw.name.length > 0 ? raw.name : "Suture fixture";
  const output = typeof raw.output === "string" && raw.output.length > 0 ? raw.output : null;
  return { name, output, options, sheets };
}
