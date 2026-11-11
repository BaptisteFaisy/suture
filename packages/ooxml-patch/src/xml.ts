/**
 * Minimal XML scanning helpers for OOXML parts.
 *
 * Home-grown on purpose: no external parser, therefore no external entity
 * resolution (XXE) and no network / no extra dependency. Only the handful of
 * constructs used by SpreadsheetML are supported: elements, attributes,
 * self-closing tags and text.
 */

/** One attribute of an element, kept with its raw source text. */
export interface XmlAttr {
  name: string;
  /** Raw source text, e.g. `r="A1"`. */
  raw: string;
  /** Decoded value. */
  value: string;
}

/** One element found in a document. */
export interface XmlElement {
  name: string;
  attrs: XmlAttr[];
  /** Offset of `<`. */
  start: number;
  /** Offset just after the closing `>`. */
  end: number;
  /** Offset of the first character of the inner content. */
  innerStart: number;
  /** Offset of `<` of the closing tag. */
  innerEnd: number;
  selfClosing: boolean;
}

/** Reads an attribute value by name. */
export function attrValue(element: XmlElement, name: string): string | undefined {
  const found = element.attrs.find((a) => a.name === name);
  return found ? found.value : undefined;
}

/** Escapes text for an XML text node. */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escapes text for an XML attribute value. */
export function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

/** Decodes the XML entities used by SpreadsheetML. */
export function unescapeText(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (all, code) => {
    if (code === "amp") return "&";
    if (code === "lt") return "<";
    if (code === "gt") return ">";
    if (code === "quot") return '"';
    if (code === "apos") return "'";
    const numeric = code.startsWith("#x") || code.startsWith("#X")
      ? parseInt(code.slice(2), 16)
      : parseInt(code.slice(1), 10);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : all;
  });
}

interface ParsedTag {
  attrs: XmlAttr[];
  selfClosing: boolean;
  end: number;
}

function isNameEnd(char: string | undefined): boolean {
  return char === undefined || /[\s/>]/.test(char);
}

function parseTag(xml: string, start: number): ParsedTag | null {
  let i = start + 1;
  while (i < xml.length && !isNameEnd(xml[i])) i += 1;
  const attrs: XmlAttr[] = [];
  while (i < xml.length) {
    while (i < xml.length && /\s/.test(xml[i] ?? "")) i += 1;
    const char = xml[i];
    if (char === ">") return { attrs, selfClosing: false, end: i + 1 };
    if (char === "/") {
      if (xml[i + 1] === ">") return { attrs, selfClosing: true, end: i + 2 };
      i += 1;
      continue;
    }
    const nameStart = i;
    while (i < xml.length && !/[\s=/>]/.test(xml[i] ?? "")) i += 1;
    const name = xml.slice(nameStart, i);
    while (i < xml.length && /\s/.test(xml[i] ?? "")) i += 1;
    if (xml[i] !== "=") {
      if (name) attrs.push({ name, raw: name, value: name });
      continue;
    }
    i += 1;
    while (i < xml.length && /\s/.test(xml[i] ?? "")) i += 1;
    const quote = xml[i];
    if (quote !== '"' && quote !== "'") {
      const valueStart = i;
      while (i < xml.length && !/[\s>]/.test(xml[i] ?? "")) i += 1;
      const value = xml.slice(valueStart, i);
      attrs.push({ name, raw: `${name}="${value}"`, value });
      continue;
    }
    const valueStart = i + 1;
    const valueEnd = xml.indexOf(quote, valueStart);
    if (valueEnd < 0) return null;
    const raw = xml.slice(nameStart, valueEnd + 1);
    attrs.push({ name, raw, value: unescapeText(xml.slice(valueStart, valueEnd)) });
    i = valueEnd + 1;
  }
  return null;
}

/**
 * Finds every occurrence of `name` in `xml`. Elements of the same name never
 * nest in SpreadsheetML sheets, so a flat scan is enough.
 */
export function findElements(xml: string, name: string): XmlElement[] {
  const found: XmlElement[] = [];
  const needle = `<${name}`;
  let cursor = 0;
  while (cursor < xml.length) {
    const at = xml.indexOf(needle, cursor);
    if (at < 0) break;
    if (!isNameEnd(xml[at + needle.length])) {
      cursor = at + needle.length;
      continue;
    }
    const tag = parseTag(xml, at);
    if (!tag) {
      cursor = at + needle.length;
      continue;
    }
    if (tag.selfClosing) {
      found.push({
        name,
        attrs: tag.attrs,
        start: at,
        end: tag.end,
        innerStart: tag.end,
        innerEnd: tag.end,
        selfClosing: true,
      });
      cursor = tag.end;
      continue;
    }
    const closeAt = xml.indexOf(`</${name}`, tag.end);
    if (closeAt < 0) {
      cursor = tag.end;
      continue;
    }
    const closeEnd = xml.indexOf(">", closeAt);
    found.push({
      name,
      attrs: tag.attrs,
      start: at,
      end: closeEnd < 0 ? xml.length : closeEnd + 1,
      innerStart: tag.end,
      innerEnd: closeAt,
      selfClosing: false,
    });
    cursor = tag.end;
  }
  return found;
}

/** Raw source text of an element, closing tag included. */
export function elementSource(xml: string, element: XmlElement): string {
  return xml.slice(element.start, element.end);
}
