// =============================================================================
// Lab 05 — Tests asynchrones (Exercices)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Promises — resolve et reject
// =============================================================================

function fetchUser(_id: number): Promise<{ id: number; name: string }> {
  // TODO: retourne un user si id > 0, rejette sinon
  throw new Error('Not implemented');
}

function fetchWithTimeout<T>(_promise: Promise<T>, _ms: number): Promise<T> {
  // TODO: rejette si la promise ne se resout pas en ms millisecondes
  throw new Error('Not implemented');
}

// =============================================================================
// Exercise 2: RetryWithDelay
// =============================================================================

function retryWithDelay<T>(_fn: () => Promise<T>, _retries: number, _delayMs: number): Promise<T> {
  // TODO: reessaie fn jusqu'a retries fois avec un delai de delayMs
  throw new Error('Not implemented');
}

// =============================================================================
// Exercise 3: PubSub (EventEmitter)
// =============================================================================

class PubSub<T = unknown> {
  subscribe(_event: string, _handler: (data: T) => void): () => void {
    // TODO: abonne un handler et retourne une fonction de desabonnement
    throw new Error('Not implemented');
  }
  publish(_event: string, _data: T): void {
    // TODO: publie un evenement
    throw new Error('Not implemented');
  }
}

// =============================================================================
// Exercise 4: Debounce
// =============================================================================

function debounce<T extends (...args: any[]) => void>(_fn: T, _delayMs: number): T & { cancel: () => void } {
  // TODO: retourne une version debouncee de fn
  throw new Error('Not implemented');
}

// =============================================================================
// Exercise 5: Polling
// =============================================================================

function pollUntil<T>(_fn: () => Promise<T>, _condition: (result: T) => boolean, _intervalMs: number, _timeoutMs: number): Promise<T> {
  // TODO: appelle fn toutes les intervalMs ms jusqu'a ce que condition soit vraie ou timeout
  throw new Error('Not implemented');
}

// =============================================================================
// Exercise 6: Race conditions — compteur concurrent
// =============================================================================

class AsyncCounter {
  // TODO: implementez un compteur avec increment async et getCount
  async increment(): Promise<void> { throw new Error('Not implemented'); }
  getCount(): number { throw new Error('Not implemented'); }
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assert, run } = createTestRunner('Lab 05 — Tests asynchrones');

await test('Ex1: fetchUser resolves for valid id', async () => {
  const user = await fetchUser(1);
  assertEqual(user.id, 1);
});
await test('Ex1: fetchUser rejects for invalid id', async () => {
  let threw = false;
  try { await fetchUser(-1); } catch { threw = true; }
  assert(threw);
});

await test('Ex3: pubsub delivers messages', () => {
  const ps = new PubSub<string>();
  let received = '';
  ps.subscribe('test', (data) => { received = data; });
  ps.publish('test', 'hello');
  assertEqual(received, 'hello');
});

await test('Ex6: concurrent increments', async () => {
  const counter = new AsyncCounter();
  await Promise.all([counter.increment(), counter.increment(), counter.increment()]);
  assertEqual(counter.getCount(), 3);
});

run();
