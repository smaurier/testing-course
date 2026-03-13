// =============================================================================
// Lab 14 — Flaky Test Detection and Fixing (solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface FlakyReport {
  totalRuns: number;
  passed: number;
  failed: number;
  passRate: number;
  isFlaky: boolean;
}

interface QuarantineEntry {
  testName: string;
  reason: string;
  addedAt: number;
  failCount: number;
}

// -----------------------------------------------------------------------------
// Exercice 1 — detectFlaky (run N times, report ratio)
// -----------------------------------------------------------------------------

export async function detectFlaky(
  testFn: () => void | Promise<void>,
  runs: number
): Promise<FlakyReport> {
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < runs; i++) {
    try {
      await testFn();
      passed++;
    } catch {
      failed++;
    }
  }

  const passRate = runs > 0 ? passed / runs : 0;
  return {
    totalRuns: runs,
    passed,
    failed,
    passRate,
    isFlaky: passRate > 0 && passRate < 1,
  };
}

// -----------------------------------------------------------------------------
// Exercice 2 — Fix time-dependent test
// -----------------------------------------------------------------------------

export function isRecent_fixed(timestamp: number, now?: number): boolean {
  const currentTime = now !== undefined ? now : Date.now();
  return currentTime - timestamp < 1000;
}

// -----------------------------------------------------------------------------
// Exercice 3 — Fix shared-state test
// -----------------------------------------------------------------------------

export function createCounter() {
  let count = 0;
  return {
    increment(): number {
      return ++count;
    },
    getValue(): number {
      return count;
    },
    reset(): void {
      count = 0;
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 4 — Fix race condition test
// -----------------------------------------------------------------------------

async function fakeFetch(url: string): Promise<string> {
  const delay = Math.random() * 10;
  await new Promise(r => setTimeout(r, delay));
  return `response:${url}`;
}

export async function fetchAll_fixed(urls: string[]): Promise<string[]> {
  const promises = urls.map(url => fakeFetch(url));
  return Promise.all(promises);
}

// -----------------------------------------------------------------------------
// Exercice 5 — quarantineManager
// -----------------------------------------------------------------------------

export function createQuarantineManager() {
  const entries = new Map<string, QuarantineEntry>();

  return {
    quarantine(testName: string, reason: string): void {
      entries.set(testName, {
        testName,
        reason,
        addedAt: Date.now(),
        failCount: 0,
      });
    },
    release(testName: string): void {
      entries.delete(testName);
    },
    isQuarantined(testName: string): boolean {
      return entries.has(testName);
    },
    recordFailure(testName: string): void {
      const entry = entries.get(testName);
      if (entry) {
        entry.failCount++;
      }
    },
    getReport(): QuarantineEntry[] {
      return [...entries.values()];
    },
    getHealthScore(totalTests: number): number {
      if (totalTests === 0) return 1;
      return (totalTests - entries.size) / totalTests;
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 6 — Full suite: identify and fix 3 flaky tests
// -----------------------------------------------------------------------------

// Fix A: sort without mutating original
export function sortByName_fixed(
  items: Array<{ name: string; id: number }>
): Array<{ name: string; id: number }> {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

// Fix B: configurable timeout, long enough to be reliable
export async function waitForResult_fixed(timeoutMs: number = 100): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    setTimeout(() => {
      clearTimeout(timeout);
      resolve('done');
    }, 10);
  });
}

// Fix C: deterministic ID generator with seed
export function createIdGenerator(seed: number) {
  let current = seed;

  function pseudoRandom(): number {
    // Simple LCG (Linear Congruential Generator)
    current = (current * 1664525 + 1013904223) & 0x7fffffff;
    return current;
  }

  return {
    next(): string {
      return `id-${pseudoRandom().toString(36)}`;
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

async function main() {
  const { test, assert, assertEqual, assertDeepEqual, run } = createTestRunner('Lab 14 — Flaky Test Detection');

  // --- Exercice 1 ---
  await test('Ex1: detectFlaky identifies stable passing test', async () => {
    const report = await detectFlaky(() => { /* always passes */ }, 10);
    assertEqual(report.totalRuns, 10);
    assertEqual(report.passed, 10);
    assertEqual(report.failed, 0);
    assertEqual(report.passRate, 1);
    assertEqual(report.isFlaky, false);
  });

  await test('Ex1: detectFlaky identifies stable failing test', async () => {
    const report = await detectFlaky(() => { throw new Error('fail'); }, 5);
    assertEqual(report.totalRuns, 5);
    assertEqual(report.passed, 0);
    assertEqual(report.failed, 5);
    assertEqual(report.passRate, 0);
    assertEqual(report.isFlaky, false);
  });

  // --- Exercice 2 ---
  await test('Ex2: isRecent_fixed is deterministic with injected clock', () => {
    const now = 1000;
    assertEqual(isRecent_fixed(500, now), true);   // 500ms ago
    assertEqual(isRecent_fixed(0, now), false);     // 1000ms ago (not < 1000)
    assertEqual(isRecent_fixed(999, now), true);    // 1ms ago
    assertEqual(isRecent_fixed(-1, now), false);    // 1001ms ago
  });

  await test('Ex2: isRecent_fixed falls back to Date.now when no clock given', () => {
    const recent = Date.now() - 100;
    assertEqual(isRecent_fixed(recent), true);
  });

  // --- Exercice 3 ---
  await test('Ex3: createCounter isolates state between instances', () => {
    const c1 = createCounter();
    const c2 = createCounter();
    c1.increment();
    c1.increment();
    c2.increment();
    assertEqual(c1.getValue(), 2);
    assertEqual(c2.getValue(), 1);
  });

  await test('Ex3: createCounter reset works', () => {
    const c = createCounter();
    c.increment();
    c.increment();
    c.increment();
    assertEqual(c.getValue(), 3);
    c.reset();
    assertEqual(c.getValue(), 0);
  });

  // --- Exercice 4 ---
  await test('Ex4: fetchAll_fixed returns all results', async () => {
    const results = await fetchAll_fixed(['/a', '/b', '/c']);
    assertEqual(results.length, 3);
    assert(results.includes('response:/a'));
    assert(results.includes('response:/b'));
    assert(results.includes('response:/c'));
  });

  await test('Ex4: fetchAll_fixed preserves order', async () => {
    const results = await fetchAll_fixed(['/x', '/y']);
    assertEqual(results[0], 'response:/x');
    assertEqual(results[1], 'response:/y');
  });

  // --- Exercice 5 ---
  await test('Ex5: quarantineManager tracks quarantined tests', () => {
    const qm = createQuarantineManager();
    qm.quarantine('test-flaky-1', 'timing issue');
    assert(qm.isQuarantined('test-flaky-1'));
    assert(!qm.isQuarantined('test-stable'));
    qm.release('test-flaky-1');
    assert(!qm.isQuarantined('test-flaky-1'));
  });

  await test('Ex5: quarantineManager reports and health score', () => {
    const qm = createQuarantineManager();
    qm.quarantine('test-a', 'race condition');
    qm.quarantine('test-b', 'timing');
    qm.recordFailure('test-a');
    qm.recordFailure('test-a');
    const report = qm.getReport();
    assertEqual(report.length, 2);
    const entryA = report.find(e => e.testName === 'test-a')!;
    assertEqual(entryA.failCount, 2);
    assertEqual(qm.getHealthScore(10), 0.8);
  });

  // --- Exercice 6 ---
  await test('Ex6: sortByName_fixed does not mutate original', () => {
    const items = [
      { name: 'Charlie', id: 3 },
      { name: 'Alice', id: 1 },
      { name: 'Bob', id: 2 },
    ];
    const original = [...items];
    const sorted = sortByName_fixed(items);
    assertEqual(sorted[0].name, 'Alice');
    assertEqual(sorted[1].name, 'Bob');
    assertEqual(sorted[2].name, 'Charlie');
    assertDeepEqual(items, original);
  });

  await test('Ex6: waitForResult_fixed resolves reliably', async () => {
    const result = await waitForResult_fixed(200);
    assertEqual(result, 'done');
  });

  await test('Ex6: createIdGenerator produces deterministic IDs', () => {
    const gen1 = createIdGenerator(42);
    const gen2 = createIdGenerator(42);
    const id1a = gen1.next();
    const id1b = gen1.next();
    const id2a = gen2.next();
    const id2b = gen2.next();
    assertEqual(id1a, id2a);
    assertEqual(id1b, id2b);
    assert(id1a !== id1b, 'Sequential IDs should differ');
  });

  run();
}

main();
