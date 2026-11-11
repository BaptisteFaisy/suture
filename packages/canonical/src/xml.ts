/**
 * Minimal, dependency-free XML reader for OOXML parts.
 *
 * Scope: element tree with attributes, text and children. It is deliberately
 * small — OOXML parts are trusted, machine-generated documents — but it never
 * resolves external entities (no DTD support at all), so no XXE is possible.
 */

/** One parsed XML element. */
export interface XmlElement {
  /** Local name without namespace prefix, lowercased. */
  name: string;
  /** Attributes, lowercased names, namespace prefixes preserved (`r:id`). */
  attrs: Record<string, string>;
  /** Child elements, in document order. */
  children: XmlElement[];
  /** Concatenated direct text content (entities decoded). */
  text: string;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Decodes XML entities (`&amp;`, `&#65;`, `&#x41;`). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Local name of an element or attribute, namespace prefix removed. */
export function localName(name: string): string {
  const colon = name.indexOf(":");
  return (colon === -1 ? name : name.slice(colon + 1)).toLowerCase();
}

class XmlReader {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): XmlElement {
    this.skipProlog();
    const root = this.readElement();
    return root;
  }

  private skipProlog(): void {
    for (;;) {
      this.skipWhitespace();
      if (this.source.startsWith("<?", this.index)) {
        this.skipUntil("?>", 2);
      } else if (this.source.startsWith("<!--", this.index)) {
        this.skipUntil("-->", 3);
      } else if (this.source.startsWith("<!", this.index)) {
        this.skipUntil(">", 1);
      } else {
        return;
      }
    }
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length && /\s/.test(this.source[this.index] ?? "")) {
      this.index += 1;
    }
  }

  private skipUntil(marker: string, length: number): void {
    const end = this.source.indexOf(marker, this.index);
    this.index = end === -1 ? this.source.length : end + length;
  }

  private readElement(): XmlElement {
    this.expect("<");
    const name = this.readName();
    const attrs = this.readAttributes();
    const element: XmlElement = { name, attrs, children: [], text: "" };
    if (this.consumeIf("/>")) return element;
    this.expect(">");
    this.readContent(element);
    return element;
  }

  private readContent(element: XmlElement): void {
    for (;;) {
      const next = this.source.indexOf("<", this.index);
      if (next === -1) {
        element.text += decodeEntities(this.source.slice(this.index));
        this.index = this.source.length;
        return;
      }
      element.text += decodeEntities(this.source.slice(this.index, next));
      this.index = next;
      if (this.source.startsWith("</", this.index)) {
        this.skipUntil(">", 1);
        return;
      }
      if (this.source.startsWith("<!--", this.index)) {
        this.skipUntil("-->", 3);
        continue;
      }
      if (this.source.startsWith("<![CDATA[", this.index)) {
        const end = this.source.indexOf("]]>", this.index);
        const stop = end === -1 ? this.source.length : end;
        element.text += this.source.slice(this.index + 9, stop);
        this.index = end === -1 ? this.source.length : end + 3;
        continue;
      }
      if (this.source.startsWith("<?", this.index) || this.source.startsWith("<!", this.index)) {
        this.skipUntil(this.source.startsWith("<?", this.index) ? "?>" : ">", this.source.startsWith("<?", this.index) ? 2 : 1);
        continue;
      }
      element.children.push(this.readElement());
    }
  }

  private readName(): string {
    const start = this.index;
    while (this.index < this.source.length && /[^\s/>]/.test(this.source[this.index] ?? "")) {
      this.index += 1;
    }
    return localName(this.source.slice(start, this.index));
  }

  private readAttributes(): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (;;) {
      this.skipWhitespace();
      const char = this.source[this.index];
      if (char === undefined || char === ">" || char === "/") return attrs;
      const start = this.index;
      while (this.index < this.source.length && /[^\s=/>]/.test(this.source[this.index] ?? "")) {
        this.index += 1;
      }
      const rawName = this.source.slice(start, this.index);
      this.skipWhitespace();
      if (this.source[this.index] !== "=") {
        attrs[rawName.toLowerCase()] = "";
        continue;
      }
      this.index += 1;
      this.skipWhitespace();
      const quote = this.source[this.index];
      if (quote !== '"' && quote !== "'") {
        attrs[rawName.toLowerCase()] = "";
        continue;
      }
      this.index += 1;
      const end = this.source.indexOf(quote, this.index);
      const stop = end === -1 ? this.source.length : end;
      attrs[rawName.toLowerCase()] = decodeEntities(this.source.slice(this.index, stop));
      this.index = end === -1 ? this.source.length : end + 1;
    }
  }

  private consumeIf(marker: string): boolean {
    if (!this.source.startsWith(marker, this.index)) return false;
    this.index += marker.length;
    return true;
  }

  private expect(char: string): void {
    if (this.source[this.index] !== char) {
      throw new Error(`XML malformé : '${char}' attendu`);
    }
    this.index += 1;
  }
}

/** Parses an XML document into an element tree. */
export function parseXml(source: string): XmlElement {
  return new XmlReader(source).parse();
}

/** Direct children with the given local name. */
export function childrenNamed(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter((child) => child.name === name);
}

/** First direct child with the given local name. */
export function childNamed(element: XmlElement, name: string): XmlElement | undefined {
  return element.children.find((child) => child.name === name);
}

/** All descendants with the given local name, in document order. */
export function descendantsNamed(element: XmlElement, name: string): XmlElement[] {
  const found: XmlElement[] = [];
  const walk = (node: XmlElement): void => {
    for (const child of node.children) {
      if (child.name === name) found.push(child);
      walk(child);
    }
  };
  walk(element);
  return found;
}

/**
 * Plain text of an element holding `<t>` children: rich-text runs are
 * flattened and phonetic runs (`<rPh>`) are dropped.
 */
export function collectText(element: XmlElement): string {
  let text = "";
  const walk = (node: XmlElement, phonetic: boolean): void => {
    for (const child of node.children) {
      const isPhonetic = phonetic || child.name === "rph";
      if (child.name === "t" && !isPhonetic) {
        text += child.text;
        continue;
      }
      walk(child, isPhonetic);
    }
  };
  walk(element, false);
  return text;
}
