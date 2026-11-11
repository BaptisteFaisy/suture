/**
 * The file system Suture stores run on: isomorphic-git's promise-flavoured
 * client. `node:fs` satisfies it in tests and on the server;
 * `@isomorphic-git/lightning-fs` satisfies it in the browser (IndexedDB).
 */
import type { PromiseFsClient } from "isomorphic-git";

export type SutureFs = PromiseFsClient;
