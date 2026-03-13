// =============================================================================
// Lab 17 — Performance Testing Patterns (solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface BenchmarkResult {
  iterations: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  total: number;
}

interface LoadTestResult {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
  requestsPerSecond: number;
  durationMs: number;
}

interface ThroughputResult {
  achievedRPS: number;
  targetRPS: number;
  totalRequests: number;
  successRate: number;
  durationMs: number;
}

interface MemoryProfile {
  initialHeap: number;
  finalHeap: number;
  peakHeap: number;
  growth: number;
  leaked: boolean;
}

interface RegressionResult {
  metric: string;
  baseline: number;
  current: number;
  change: number;
  changePercent: number;
  regressed: boolean;
}

// -----------------------------------------------------------------------------
// Exercice 1 — benchmark (avg/min/max/p95)
// -----------------------------------------------------------------------------

export async function benchmark(
  fn: () => void | Promise<void>,
  iterations: number
): Promise<BenchmarkResult> {
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    durations.push(performance.now() - start);
  }

  durations.sort((a, b) => a - b);
  const total = durations.reduce((a, b) => a + b, 0);
  const p95Index = Math.ceil(0.95 * durations.length) - 1;

  return {
    iterations,
    avg: total / iterations,
    min: durations[0],
    max: durations[durations.length - 1],
    p95: durations[Math.max(0, p95Index)],
    total,
  };
}

// -----------------------------------------------------------------------------
// Exercice 2 — loadTest (concurrent users)
// -----------------------------------------------------------------------------

export async function loadTest(
  fn: () => Promise<void>,
  concurrency: number,
  durationMs: number
): Promise<LoadTestResult> {
  let successCount = 0;
  let errorCount = 0;
  const responseTimes: number[] = [];
  const startTime = Date.now();
  const endTime = startTime + durationMs;

  async function worker() {
    while (Date.now() < endTime) {
      const reqStart = performance.now();
      try {
        await fn();
        successCount++;
      } catch {
        errorCount++;
      }
      responseTimes.push(performance.now() - reqStart);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const actualDuration = Date.now() - startTime;
  const totalRequests = successCount + errorCount;
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  return {
    totalRequests,
    successCount,
    errorCount,
    avgResponseTime,
    requestsPerSecond: totalRequests / (actualDuration / 1000),
    durationMs: actualDuration,
  };
}

// -----------------------------------------------------------------------------
// Exercice 3 — throughputTest (requests per second)
// -----------------------------------------------------------------------------

export async function throughputTest(
  fn: () => Promise<void>,
  targetRPS: number,
  durationMs: number = 1000
): Promise<ThroughputResult> {
  const intervalMs = 1000 / targetRPS;
  const startTime = Date.now();
  const endTime = startTime + durationMs;
  let totalRequests = 0;
  let successCount = 0;
  const promises: Promise<void>[] = [];

  while (Date.now() < endTime) {
    const reqStart = Date.now();
    totalRequests++;
    promises.push(
      fn().then(() => { successCount++; }).catch(() => {})
    );
    const elapsed = Date.now() - reqStart;
    const waitTime = Math.max(0, intervalMs - elapsed);
    if (waitTime > 0 && Date.now() + waitTime < endTime) {
      await new Promise(r => setTimeout(r, waitTime));
    }
  }

  await Promise.all(promises);

  const actualDuration = Date.now() - startTime;
  return {
    achievedRPS: totalRequests / (actualDuration / 1000),
    targetRPS,
    totalRequests,
    successRate: totalRequests > 0 ? successCount / totalRequests : 0,
    durationMs: actualDuration,
  };
}

// -----------------------------------------------------------------------------
// Exercice 4 — memoryProfile (detect leaks)
// -----------------------------------------------------------------------------

export async function memoryProfile(
  fn: () => void | Promise<void>,
  iterations: number = 100,
  leakThresholdBytes: number = 1024 * 1024
): Promise<MemoryProfile> {
  // Force GC if available
  if (typeof globalThis.gc === 'function') globalThis.gc();

  const initialHeap = process.memoryUsage().heapUsed;
  let peakHeap = initialHeap;

  for (let i = 0; i < iterations; i++) {
    await fn();
    const currentHeap = process.memoryUsage().heapUsed;
    if (currentHeap > peakHeap) peakHeap = currentHeap;
  }

  if (typeof globalThis.gc === 'function') globalThis.gc();

  const finalHeap = process.memoryUsage().heapUsed;
  const growth = finalHeap - initialHeap;

  return {
    initialHeap,
    finalHeap,
    peakHeap,
    growth,
    leaked: growth > leakThresholdBytes,
  };
}

// -----------------------------------------------------------------------------
// Exercice 5 — regressionDetect (compare metrics)
// -----------------------------------------------------------------------------

export function regressionDetect(
  baseline: Record<string, number>,
  current: Record<string, number>,
  thresholdPercent: number = 10
): RegressionResult[] {
  const results: RegressionResult[] = [];

  for (const metric of Object.keys(baseline)) {
    const baseVal = baseline[metric];
    const currVal = current[metric] ?? baseVal;
    const change = currVal - baseVal;
    const changePercent = baseVal !== 0 ? (change / baseVal) * 100 : 0;

    results.push({
      metric,
      baseline: baseVal,
      current: currVal,
      change,
      changePercent,
      regressed: changePercent > thresholdPercent,
    });
  }

  return results;
}

// -----------------------------------------------------------------------------
// Exercice 6 — Full performance suite
// -----------------------------------------------------------------------------

export async function runPerformanceSuite(config: {
  fn: () => Promise<void>;
  benchmarkIterations: number;
  loadConcurrency: number;
  loadDurationMs: number;
  baseline?: Record<string, number>;
}): Promise<{
  benchmark: BenchmarkResult;
  loadTest: LoadTestResult;
  memory: MemoryProfile;
  regressions: RegressionResult[];
  passed: boolean;
}> {
  const benchResult = await benchmark(config.fn, config.benchmarkIterations);
  const loadResult = await loadTest(config.fn, config.loadConcurrency, config.loadDurationMs);
  const memResult = await memoryProfile(config.fn, 50, 10 * 1024 * 1024);

  let regressions: RegressionResult[] = [];
  if (config.baseline) {
    const currentMetrics: Record<string, number> = { avg: benchResult.avg };
    regressions = regressionDetect(config.baseline, currentMetrics);
  }

  const hasRegressions = regressions.some(r => r.regressed);
  const passed = !memResult.leaked && !hasRegressions;

  return {
    benchmark: benchResult,
    loadTest: loadResult,
    memory: memResult,
    regressions,
    passed,
  };
}

// =============================================================================
// Tests
// =============================================================================

async function main() {
  const { test, assert, assertEqual, run } = createTestRunner('Lab 17 — Performance Testing');

  // --- Exercice 1 ---
  await test('Ex1: benchmark measures execution times', async () => {
    let count = 0;
    const result = await benchmark(() => { count++; for (let i = 0; i < 1000; i++) {} }, 100);
    assertEqual(result.iterations, 100);
    assertEqual(count, 100);
    assert(result.avg >= 0, 'avg should be >= 0');
    assert(result.min >= 0, 'min should be >= 0');
    assert(result.max >= result.min, 'max should be >= min');
    assert(result.p95 >= result.min, 'p95 should be >= min');
    assert(result.p95 <= result.max, 'p95 should be <= max');
    assert(result.total >= 0, 'total should be >= 0');
  });

  await test('Ex1: benchmark with async function', async () => {
    const result = await benchmark(async () => {
      await new Promise(r => setTimeout(r, 1));
    }, 10);
    assertEqual(result.iterations, 10);
    assert(result.avg >= 1, 'avg should be >= 1ms for 1ms delay');
  });

  // --- Exercice 2 ---
  await test('Ex2: loadTest runs concurrent workers', async () => {
    let counter = 0;
    const result = await loadTest(
      async () => { counter++; await new Promise(r => setTimeout(r, 10)); },
      3,
      100
    );
    assert(result.totalRequests > 0, 'Should have completed some requests');
    assert(result.successCount > 0, 'Should have successes');
    assertEqual(result.errorCount, 0);
    assert(result.avgResponseTime >= 0);
    assert(result.requestsPerSecond > 0);
    assert(counter > 0);
  });

  await test('Ex2: loadTest counts errors', async () => {
    let callCount = 0;
    const result = await loadTest(
      async () => { callCount++; if (callCount % 2 === 0) throw new Error('fail'); },
      2,
      80
    );
    assert(result.errorCount > 0, 'Should have some errors');
    assert(result.totalRequests === result.successCount + result.errorCount);
  });

  // --- Exercice 3 ---
  await test('Ex3: throughputTest measures RPS', async () => {
    const result = await throughputTest(
      async () => { await new Promise(r => setTimeout(r, 1)); },
      50,
      200
    );
    assertEqual(result.targetRPS, 50);
    assert(result.achievedRPS > 0, 'Should achieve some RPS');
    assert(result.totalRequests > 0, 'Should have completed some requests');
    assert(result.successRate > 0, 'Should have successes');
  });

  // --- Exercice 4 ---
  await test('Ex4: memoryProfile detects no leak for clean function', async () => {
    const result = await memoryProfile(() => {
      const arr = new Array(100).fill(0);
      arr.reduce((a, b) => a + b, 0);
    }, 50, 10 * 1024 * 1024);
    assert(result.initialHeap > 0);
    assert(result.finalHeap > 0);
    assertEqual(result.leaked, false);
  });

  await test('Ex4: memoryProfile reports heap metrics', async () => {
    const result = await memoryProfile(() => {}, 10);
    assert(result.initialHeap > 0, 'initialHeap should be > 0');
    assert(result.peakHeap >= result.initialHeap, 'peakHeap should be >= initialHeap');
    assert(typeof result.growth === 'number');
  });

  // --- Exercice 5 ---
  await test('Ex5: regressionDetect identifies regressions', () => {
    const baseline = { avgResponseTime: 100, p95: 200 };
    const current = { avgResponseTime: 130, p95: 210 };
    const results = regressionDetect(baseline, current, 20);
    assertEqual(results.length, 2);
    const avgResult = results.find(r => r.metric === 'avgResponseTime')!;
    assertEqual(avgResult.baseline, 100);
    assertEqual(avgResult.current, 130);
    assertEqual(avgResult.changePercent, 30);
    assertEqual(avgResult.regressed, true);
    const p95Result = results.find(r => r.metric === 'p95')!;
    assertEqual(p95Result.regressed, false);
  });

  await test('Ex5: regressionDetect with no regression', () => {
    const baseline = { avg: 50 };
    const current = { avg: 52 };
    const results = regressionDetect(baseline, current, 10);
    assertEqual(results[0].regressed, false);
  });

  // --- Exercice 6 ---
  await test('Ex6: full performance suite runs all checks', async () => {
    const result = await runPerformanceSuite({
      fn: async () => { await new Promise(r => setTimeout(r, 1)); },
      benchmarkIterations: 10,
      loadConcurrency: 2,
      loadDurationMs: 50,
    });
    assert(result.benchmark.iterations === 10);
    assert(result.loadTest.totalRequests > 0);
    assert(typeof result.memory.leaked === 'boolean');
    assertEqual(result.regressions.length, 0);
    assertEqual(result.passed, true);
  });

  await test('Ex6: full suite detects regression with baseline', async () => {
    const result = await runPerformanceSuite({
      fn: async () => { await new Promise(r => setTimeout(r, 5)); },
      benchmarkIterations: 5,
      loadConcurrency: 1,
      loadDurationMs: 50,
      baseline: { avg: 1 },
    });
    assert(result.regressions.length > 0);
    assert(result.regressions.some(r => r.regressed));
    assertEqual(result.passed, false);
  });

  run();
}

main();
