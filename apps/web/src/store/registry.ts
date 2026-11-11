/**
 * Registry of tracked workbooks and of the author name, persisted through the
 * host's settings storage (localStorage in the browser, a map in tests).
 */
import type { HostPorts } from "./ports";

export interface TrackedWorkbookRecord {
  id: string;
  name: string;
  createdAt: number;
}

const WORKBOOKS_KEY = "suture.workbooks";
const AUTHOR_KEY = "suture.author";

export interface Registry {
  list(): TrackedWorkbookRecord[];
  add(record: TrackedWorkbookRecord): TrackedWorkbookRecord[];
  find(id: string): TrackedWorkbookRecord | undefined;
  findByName(name: string): TrackedWorkbookRecord | undefined;
  clear(): void;
  author(): string;
  setAuthor(name: string): void;
}

function isRecord(value: unknown): value is TrackedWorkbookRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "number"
  );
}

function read(host: HostPorts): TrackedWorkbookRecord[] {
  const raw = host.settings.get(WORKBOOKS_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function write(host: HostPorts, records: TrackedWorkbookRecord[]): void {
  host.settings.set(WORKBOOKS_KEY, JSON.stringify(records));
}

/** Base name of a workbook file, without its extension. */
export function baseName(fileName: string): string {
  return fileName.replace(/\.(xlsx|xlsm)$/i, "").toLowerCase();
}

/** A stable identifier for a tracked workbook. */
export function workbookIdOf(name: string, now: number): string {
  const slug = baseName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug.length > 0 ? slug : "workbook"}-${now.toString(36)}`;
}

export function createRegistry(host: HostPorts): Registry {
  return {
    list: () => read(host),
    add: (record) => {
      const records = read(host);
      if (records.some((item) => item.id === record.id)) return records;
      const next = [...records, record];
      write(host, next);
      return next;
    },
    find: (id) => read(host).find((item) => item.id === id),
    findByName: (name) => read(host).find((item) => baseName(item.name) === baseName(name)),
    clear: () => write(host, []),
    author: () => host.settings.get(AUTHOR_KEY) ?? "",
    setAuthor: (name) => host.settings.set(AUTHOR_KEY, name),
  };
}
