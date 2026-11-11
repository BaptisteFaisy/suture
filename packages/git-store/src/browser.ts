/**
 * Browser storage for the tracked workbooks: lightning-fs over IndexedDB, one
 * repository directory per workbook. The file system stays on the machine —
 * nothing is ever sent anywhere (SUT-N-01).
 */
import FS from "@isomorphic-git/lightning-fs";
import type { SutureStore } from "@suture/contracts";
import { createSutureStore } from "./store";

/** Root of the browser's file system. */
export const BROWSER_STORE_NAME = "suture";

let filesystem: FS | null = null;

/** The browser file system, created once. */
export function browserFilesystem(): FS {
  if (filesystem === null) {
    filesystem = new FS(BROWSER_STORE_NAME);
  }
  return filesystem;
}

/** Directory of one tracked workbook inside the browser file system. */
export function workbookDir(workbookId: string): string {
  return `/workbooks/${workbookId}`;
}

/** Opens (or reopens) the version store of a tracked workbook. */
export function createBrowserStore(workbookId: string): SutureStore {
  return createSutureStore({
    fs: browserFilesystem() as never,
    dir: workbookDir(workbookId),
  });
}
