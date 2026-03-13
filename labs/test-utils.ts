// =============================================================================
// test-utils.ts — Utilitaires partages pour les labs Testing (01-06)
// =============================================================================

export function createTestRunner(labName: string) {
  let passed = 0;
  let failed = 0;
  const errors: { name: string; error: Error }[] = [];

  async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    try {
      await fn();
      passed++;
      console.log(`  \u2705 ${name}`);
    } catch (err) {
      failed++;
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push({ name, error });
      console.log(`  \u274C ${name}`);
      console.log(`     \u2192 ${error.message}`);
    }
  }

  function assert(condition: boolean, message: string = 'Assertion failed'): void {
    if (!condition) throw new Error(message);
  }

  function assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(message || `Expected ${b}, got ${a}`);
  }

  function assertThrows(fn: () => void, expectedMessage?: string): void {
    try {
      fn();
      throw new Error('Expected function to throw, but it did not');
    } catch (err) {
      if (err instanceof Error && err.message === 'Expected function to throw, but it did not') throw err;
      if (expectedMessage && err instanceof Error && !err.message.includes(expectedMessage)) {
        throw new Error(`Expected error message to include "${expectedMessage}", got "${err.message}"`);
      }
    }
  }

  async function assertAsync(fn: () => Promise<void>, message?: string): Promise<void> {
    try {
      await fn();
    } catch (err) {
      throw new Error(message || `Async assertion failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function assertPasses(fn: () => void, message?: string): void {
    try {
      fn();
    } catch (err) {
      throw new Error(message || `Expected function to pass, but it threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function assertFails(fn: () => void, message?: string): void {
    try {
      fn();
      throw new Error(message || 'Expected function to fail, but it passed');
    } catch (err) {
      if (err instanceof Error && err.message === (message || 'Expected function to fail, but it passed')) throw err;
    }
  }

  function run(): { passed: number; failed: number; total: number } {
    const total = passed + failed;
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`\uD83D\uDCCA ${labName} \u2014 Resultats : ${passed}/${total} tests reussis`);
    if (failed > 0) {
      console.log(`\n\u274C ${failed} test(s) echoue(s) :`);
      errors.forEach(({ name, error }) => { console.log(`   \u2022 ${name} : ${error.message}`); });
    } else {
      console.log(`\n\uD83C\uDF89 Tous les tests passent !`);
    }
    console.log(`${'─'.repeat(50)}\n`);
    return { passed, failed, total };
  }

  return { test, assert, assertEqual, assertDeepEqual, assertThrows, assertAsync, assertPasses, assertFails, run };
}

// =============================================================================
// Helpers Testing — Mock, Spy, Fake Timer, Async Queue
// =============================================================================

export interface MockFn<TArgs extends any[] = any[], TReturn = any> {
  (...args: TArgs): TReturn;
  calls: TArgs[];
  returnValues: TReturn[];
  mockReturnValue: (val: TReturn) => void;
  mockImplementation: (fn: (...args: TArgs) => TReturn) => void;
  reset: () => void;
}

/** Cree une fonction mock qui enregistre tous ses appels */
export function createMockFn<TArgs extends any[] = any[], TReturn = any>(
  defaultImpl?: (...args: TArgs) => TReturn
): MockFn<TArgs, TReturn> {
  let impl: ((...args: TArgs) => TReturn) | undefined = defaultImpl;
  let returnValue: TReturn | undefined;

  const fn = ((...args: TArgs): TReturn => {
    fn.calls.push(args);
    const result = returnValue !== undefined ? returnValue : impl ? impl(...args) : (undefined as TReturn);
    fn.returnValues.push(result);
    return result;
  }) as MockFn<TArgs, TReturn>;

  fn.calls = [] as TArgs[];
  fn.returnValues = [] as TReturn[];
  fn.mockReturnValue = (val: TReturn) => { returnValue = val; };
  fn.mockImplementation = (f: (...args: TArgs) => TReturn) => { impl = f; returnValue = undefined; };
  fn.reset = () => { fn.calls = []; fn.returnValues = []; returnValue = undefined; impl = defaultImpl; };

  return fn;
}

/** Verifie qu'un mock a ete appele avec les arguments donnes */
export function assertCalledWith<TArgs extends any[]>(
  mock: MockFn<TArgs>,
  expected: TArgs,
  callIndex?: number
): void {
  if (mock.calls.length === 0) {
    throw new Error('Mock was never called');
  }
  const idx = callIndex !== undefined ? callIndex : mock.calls.length - 1;
  const actual = mock.calls[idx];
  if (!actual) throw new Error(`No call at index ${idx}`);
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`Expected call args ${b}, got ${a}`);
}

/** Verifie le nombre d'appels d'un mock */
export function assertCalledTimes(mock: MockFn, expected: number): void {
  if (mock.calls.length !== expected) {
    throw new Error(`Expected ${expected} calls, got ${mock.calls.length}`);
  }
}

/** Cree un faux timer pour controler setTimeout/setInterval */
export function createFakeTimer() {
  const timers: { id: number; callback: () => void; delay: number; scheduledAt: number; type: 'timeout' | 'interval' }[] = [];
  let currentTime = 0;
  let nextId = 1;

  function setTimeout(callback: () => void, delay: number): number {
    const id = nextId++;
    timers.push({ id, callback, delay, scheduledAt: currentTime + delay, type: 'timeout' });
    return id;
  }

  function setInterval(callback: () => void, delay: number): number {
    const id = nextId++;
    timers.push({ id, callback, delay, scheduledAt: currentTime + delay, type: 'interval' });
    return id;
  }

  function clearTimeout(id: number): void {
    const idx = timers.findIndex(t => t.id === id);
    if (idx !== -1) timers.splice(idx, 1);
  }

  function clearInterval(id: number): void {
    clearTimeout(id);
  }

  function tick(ms: number): void {
    const targetTime = currentTime + ms;
    while (true) {
      // Find next timer to fire
      const pending = timers
        .filter(t => t.scheduledAt <= targetTime)
        .sort((a, b) => a.scheduledAt - b.scheduledAt);

      if (pending.length === 0) {
        currentTime = targetTime;
        break;
      }

      const timer = pending[0];
      currentTime = timer.scheduledAt;
      if (timer.type === 'timeout') {
        const idx = timers.findIndex(t => t.id === timer.id);
        if (idx !== -1) timers.splice(idx, 1);
        timer.callback();
      } else {
        // interval: reschedule
        timer.scheduledAt = currentTime + timer.delay;
        timer.callback();
      }
    }
  }

  function now(): number {
    return currentTime;
  }

  function pendingTimers(): number {
    return timers.length;
  }

  function reset(): void {
    timers.length = 0;
    currentTime = 0;
    nextId = 1;
  }

  return { setTimeout, setInterval, clearTimeout, clearInterval, tick, now, pendingTimers, reset };
}

/** File d'attente async pour tester des operations asynchrones en sequence */
export function createAsyncQueue() {
  const items: (() => Promise<void>)[] = [];
  const results: { success: boolean; error?: Error }[] = [];

  function enqueue(fn: () => Promise<void>): void {
    items.push(fn);
  }

  async function flush(): Promise<void> {
    while (items.length > 0) {
      const fn = items.shift()!;
      try {
        await fn();
        results.push({ success: true });
      } catch (err) {
        results.push({ success: false, error: err instanceof Error ? err : new Error(String(err)) });
      }
    }
  }

  async function drain(): Promise<{ success: boolean; error?: Error }[]> {
    await flush();
    return [...results];
  }

  function pending(): number {
    return items.length;
  }

  function getResults(): { success: boolean; error?: Error }[] {
    return [...results];
  }

  function reset(): void {
    items.length = 0;
    results.length = 0;
  }

  return { enqueue, flush, drain, pending, getResults, reset };
}

/** Delai utilitaire */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => globalThis.setTimeout(resolve, ms));
}
