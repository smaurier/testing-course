// =============================================================================
// Lab 05 — Tests asynchrones (Solution)
// =============================================================================

import { createTestRunner, createMockFn, delay } from "../test-utils.ts";

// =============================================================================
// Exercise 1: Promises — resolve et reject
// =============================================================================

// JS-REPETITION: callback_error_first,promise_finally

function fetchUser(id: number): Promise<{ id: number; name: string }> {
  return new Promise((resolve, reject) => {
    globalThis.setTimeout(() => {
      if (id > 0) {
        resolve({ id, name: `User_${id}` });
      } else {
        reject(new Error("Invalid user ID"));
      }
    }, 10);
  });
}

function fetchUserCb(
  id: number,
  callback: (err: Error | null, user?: { id: number; name: string }) => void,
): void {
  globalThis.setTimeout(() => {
    if (id > 0) {
      callback(null, { id, name: `User_${id}` });
      return;
    }
    callback(new Error("Invalid user ID"));
  }, 10);
}

function fetchUserCbAsPromise(
  id: number,
): Promise<{ id: number; name: string }> {
  return new Promise((resolve, reject) => {
    fetchUserCb(id, (err, user) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(user!);
    });
  });
}

function fetchWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(
        () => reject(new Error(`Timeout after ${ms}ms`)),
        ms,
      );
    }),
  ]);
}

// =============================================================================
// Exercise 2: RetryWithDelay
// =============================================================================

async function retryWithDelay<T>(
  fn: () => Promise<T>,
  retries: number,
  delayMs: number,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

// =============================================================================
// Exercise 3: PubSub (EventEmitter)
// =============================================================================

class PubSub<T = unknown> {
  private handlers = new Map<string, Set<(data: T) => void>>();

  subscribe(event: string, handler: (data: T) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  publish(event: string, data: T): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }
}

// =============================================================================
// Exercise 4: Debounce
// =============================================================================

function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number,
): T & { cancel: () => void } {
  let timerId: ReturnType<typeof globalThis.setTimeout> | null = null;

  const debounced = ((...args: any[]) => {
    if (timerId !== null) {
      globalThis.clearTimeout(timerId);
    }
    timerId = globalThis.setTimeout(() => {
      fn(...args);
      timerId = null;
    }, delayMs);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timerId !== null) {
      globalThis.clearTimeout(timerId);
      timerId = null;
    }
  };

  return debounced;
}

// =============================================================================
// Exercise 5: Polling
// =============================================================================

async function pollUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  intervalMs: number,
  timeoutMs: number,
): Promise<T> {
  const start = Date.now();
  while (true) {
    const result = await fn();
    if (condition(result)) return result;
    if (Date.now() - start >= timeoutMs) {
      throw new Error(`Polling timed out after ${timeoutMs}ms`);
    }
    await delay(intervalMs);
  }
}

// =============================================================================
// Exercise 6: Race conditions — compteur concurrent
// =============================================================================

class AsyncCounter {
  private count = 0;

  async increment(): Promise<void> {
    // Simulate async work
    const current = this.count;
    await delay(1);
    this.count = current + 1;
  }

  getCount(): number {
    return this.count;
  }

  reset(): void {
    this.count = 0;
  }
}

class SafeAsyncCounter {
  private count = 0;
  private mutex = Promise.resolve();

  async increment(): Promise<void> {
    this.mutex = this.mutex.then(async () => {
      const current = this.count;
      await delay(1);
      this.count = current + 1;
    });
    await this.mutex;
  }

  getCount(): number {
    return this.count;
  }
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assert, run } = createTestRunner(
  "Lab 05 — Tests asynchrones",
);

// --- Exercise 1: Promises ---
await test("Ex1: fetchUser resolves for valid id", async () => {
  const user = await fetchUser(1);
  assertEqual(user.id, 1);
  assertEqual(user.name, "User_1");
});

await test("Ex1: fetchUser rejects for invalid id", async () => {
  let threw = false;
  try {
    await fetchUser(-1);
  } catch (err) {
    threw = true;
    assert(err instanceof Error);
    assert(err.message.includes("Invalid"));
  }
  assert(threw, "Should have rejected");
});

await test("Ex1: fetchUserCb utilise le style callback error-first", async () => {
  const user = await new Promise<{ id: number; name: string }>(
    (resolve, reject) => {
      fetchUserCb(2, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result!);
      });
    },
  );
  assertEqual(user.id, 2);
});

await test("Ex1: fetchUserCbAsPromise transforme le callback en Promise", async () => {
  const user = await fetchUserCbAsPromise(3);
  assertEqual(user.name, "User_3");
});

await test("Ex1: fetchWithTimeout resolves when fast enough", async () => {
  const result = await fetchWithTimeout(fetchUser(1), 1000);
  assertEqual(result.id, 1);
});

await test("Ex1: fetchWithTimeout rejects when too slow", async () => {
  const slowPromise = new Promise<string>((resolve) => {
    globalThis.setTimeout(() => resolve("slow"), 500);
  });
  let threw = false;
  try {
    await fetchWithTimeout(slowPromise, 10);
  } catch (err) {
    threw = true;
    assert(err instanceof Error);
    assert(err.message.includes("Timeout"));
  }
  assert(threw, "Should have timed out");
});

// --- Exercise 2: RetryWithDelay ---
await test("Ex2: retryWithDelay succeeds on first try", async () => {
  const fn = createMockFn<[], Promise<string>>();
  fn.mockImplementation(async () => "ok");
  const result = await retryWithDelay(fn, 3, 10);
  assertEqual(result, "ok");
  assertEqual(fn.calls.length, 1);
});

await test("Ex2: retryWithDelay succeeds after failures", async () => {
  let attempt = 0;
  const fn = async () => {
    attempt++;
    if (attempt < 3) throw new Error("fail");
    return "success";
  };
  const result = await retryWithDelay(fn, 3, 10);
  assertEqual(result, "success");
  assertEqual(attempt, 3);
});

await test("Ex2: retryWithDelay throws after all retries exhausted", async () => {
  const fn = async () => {
    throw new Error("always fails");
  };
  let threw = false;
  try {
    await retryWithDelay(fn, 2, 10);
  } catch (err) {
    threw = true;
    assert(err instanceof Error);
    assertEqual(err.message, "always fails");
  }
  assert(threw);
});

// --- Exercise 3: PubSub ---
await test("Ex3: pubsub delivers messages to subscribers", () => {
  const ps = new PubSub<string>();
  let received = "";
  ps.subscribe("greeting", (data) => {
    received = data;
  });
  ps.publish("greeting", "hello");
  assertEqual(received, "hello");
});

await test("Ex3: pubsub supports multiple subscribers", () => {
  const ps = new PubSub<number>();
  const results: number[] = [];
  ps.subscribe("count", (n) => results.push(n * 2));
  ps.subscribe("count", (n) => results.push(n * 3));
  ps.publish("count", 10);
  assertEqual(results.length, 2);
  assert(results.includes(20));
  assert(results.includes(30));
});

await test("Ex3: pubsub unsubscribe stops delivery", () => {
  const ps = new PubSub<string>();
  let count = 0;
  const unsub = ps.subscribe("evt", () => {
    count++;
  });
  ps.publish("evt", "a");
  assertEqual(count, 1);
  unsub();
  ps.publish("evt", "b");
  assertEqual(count, 1);
});

await test("Ex3: pubsub different events are isolated", () => {
  const ps = new PubSub<string>();
  let aReceived = false;
  let bReceived = false;
  ps.subscribe("a", () => {
    aReceived = true;
  });
  ps.subscribe("b", () => {
    bReceived = true;
  });
  ps.publish("a", "x");
  assert(aReceived);
  assert(!bReceived);
});

// --- Exercise 4: Debounce ---
await test("Ex4: debounce delays execution", async () => {
  let callCount = 0;
  const fn = debounce(() => {
    callCount++;
  }, 50);
  fn();
  fn();
  fn();
  assertEqual(callCount, 0);
  await delay(100);
  assertEqual(callCount, 1);
});

await test("Ex4: debounce cancel prevents execution", async () => {
  let callCount = 0;
  const fn = debounce(() => {
    callCount++;
  }, 50);
  fn();
  fn.cancel();
  await delay(100);
  assertEqual(callCount, 0);
});

await test("Ex4: debounce passes arguments to original function", async () => {
  let lastArg = "";
  const fn = debounce((msg: string) => {
    lastArg = msg;
  }, 30);
  fn("first");
  fn("second");
  fn("third");
  await delay(80);
  assertEqual(lastArg, "third");
});

// --- Exercise 5: Polling ---
await test("Ex5: polling resolves when condition is met", async () => {
  let counter = 0;
  const result = await pollUntil(
    async () => ++counter,
    (n) => n >= 3,
    10,
    1000,
  );
  assertEqual(result, 3);
});

await test("Ex5: polling times out when condition never met", async () => {
  let threw = false;
  try {
    await pollUntil(
      async () => 0,
      (n) => n > 0,
      10,
      50,
    );
  } catch (err) {
    threw = true;
    assert(err instanceof Error);
    assert(err.message.includes("timed out"));
  }
  assert(threw);
});

await test("Ex5: polling calls function at intervals", async () => {
  let calls = 0;
  await pollUntil(
    async () => {
      calls++;
      return calls;
    },
    (n) => n >= 5,
    10,
    1000,
  );
  assertEqual(calls, 5);
});

// --- Exercise 6: Race conditions ---
await test("Ex6: unsafe counter may lose increments under concurrency", async () => {
  const counter = new AsyncCounter();
  // With concurrent increments, async delay causes read-before-write race
  await Promise.all([
    counter.increment(),
    counter.increment(),
    counter.increment(),
  ]);
  // Due to race condition, count may be less than 3
  // This demonstrates the problem
  assert(
    counter.getCount() <= 3,
    `Count should be <= 3, got ${counter.getCount()}`,
  );
});

await test("Ex6: safe counter preserves all increments", async () => {
  const counter = new SafeAsyncCounter();
  await Promise.all([
    counter.increment(),
    counter.increment(),
    counter.increment(),
  ]);
  assertEqual(counter.getCount(), 3);
});

await test("Ex6: safe counter handles many concurrent increments", async () => {
  const counter = new SafeAsyncCounter();
  const promises = Array.from({ length: 10 }, () => counter.increment());
  await Promise.all(promises);
  assertEqual(counter.getCount(), 10);
});

await test("Ex6: sequential increments always work (baseline)", async () => {
  const counter = new AsyncCounter();
  await counter.increment();
  await counter.increment();
  await counter.increment();
  assertEqual(counter.getCount(), 3);
});

run();
