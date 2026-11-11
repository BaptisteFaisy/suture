/**
 * Bootstrap of the bench — re-executes the process with a large heap.
 *
 * The diff engine aligns the rows of a sheet with a quadratic dynamic-programming
 * matrix: for a 20 000-row sheet that matrix alone needs ~3.3 GB. The default
 * Node heap is too small, so the bench re-executes itself once with a cap
 * derived from the memory of the machine (never more than half of it).
 *
 * This module must be the FIRST import of `bench/perf.mjs`: it runs before the
 * heavy modules are loaded in the parent process.
 */
import { spawnSync } from "node:child_process";
import { totalmem } from "node:os";

const CHILD_FLAG = "SUTURE_BENCH_CHILD";

/** Heap cap in MB: half of the machine memory, clamped to [4096, 8192]. */
export function heapCapMb() {
  const half = Math.floor(totalmem() / 2 / 1024 / 1024);
  return Math.min(8192, Math.max(4096, half));
}

/** Removes any previous heap flag so the new cap is the one Node reads. */
function cleanExecArgv() {
  return process.execArgv.filter((arg) => !arg.startsWith("--max-old-space-size"));
}

/** Re-executes `node bench/perf.mjs` with a large heap, then exits. */
function reexecuteWithLargeHeap() {
  const args = [`--max-old-space-size=${heapCapMb()}`, ...cleanExecArgv(), process.argv[1], ...process.argv.slice(2)];
  const child = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, [CHILD_FLAG]: "1" },
  });
  if (child.error) throw child.error;
  process.exit(child.status ?? 1);
}

if (!process.env[CHILD_FLAG]) reexecuteWithLargeHeap();
