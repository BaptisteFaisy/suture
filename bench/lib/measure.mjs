/**
 * Timing helpers of the bench.
 *
 * Every duration comes from `performance.now()` — a monotonic clock, immune to
 * the wall-clock jumps `Date.now()` suffers from. Nothing is logged inside a
 * measured pass: the console stays silent while the numbers are taken.
 */

/** Runs the measured function once, to warm the JIT and the module caches. */
function warmUp(fn) {
  fn();
}

/** Median of a sample list (mean of the two middles for an even count). */
export function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Sample standard deviation (n-1) of a sample list, in milliseconds. */
export function stdev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Best-effort garbage collection between two passes (needs `--expose-gc`). */
export function collectGarbage() {
  if (typeof global.gc === "function") global.gc();
}

/**
 * Measures `fn` over `passes` passes, after `warmups` warm-up calls.
 * Returns the samples and their median / standard deviation.
 */
export function measure(label, fn, options = {}) {
  const passes = options.passes ?? 3;
  const warmups = options.warmups ?? 1;
  for (let index = 0; index < warmups; index += 1) warmUp(fn);
  const samples = [];
  let value;
  for (let index = 0; index < passes; index += 1) {
    collectGarbage();
    const start = performance.now();
    value = fn();
    samples.push(performance.now() - start);
  }
  return { label, samples, value, medianMs: median(samples), stdevMs: stdev(samples), passes };
}

/** Number of cells processed per second for a given duration. */
export function throughput(cells, ms) {
  return ms > 0 ? Math.round(cells / (ms / 1000)) : 0;
}

/** Formats a duration in milliseconds with one decimal. */
export function ms(value) {
  return `${value.toFixed(1)} ms`;
}

/** Formats a count of cells per second with thousands separators. */
export function cellsPerSecond(value) {
  return `${value.toLocaleString("fr-FR")} cellules/s`;
}
