/**
 * Polyfills required by the Git plumbing in the browser.
 *
 * `isomorphic-git` is written for Node and browsers, but its browser build
 * still expects a global `Buffer` (and a minimal `process`). Without them the
 * bundle loads and then throws on the first Git call — which only an
 * end-to-end run in a real browser reveals.
 */
import { Buffer } from "buffer";

type GlobalWithNode = typeof globalThis & {
  Buffer?: typeof Buffer;
  process?: unknown;
};

const globalAny = globalThis as GlobalWithNode;

if (globalAny.Buffer === undefined) {
  globalAny.Buffer = Buffer;
}

if (globalAny.process === undefined) {
  // Only what the Git plumbing actually touches; the cast keeps Node's strict
  // `Process` type out of a browser shim.
  globalAny.process = {
    nextTick: (fn: () => void) => setTimeout(fn, 0),
    env: {},
    platform: "browser",
    cwd: () => "/",
  } as never;
}
