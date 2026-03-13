# Module 05 — Tests asynchrones

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 3/5        | 75 min        | [Lab 05](../labs/lab-05-tests-asynchrones/) | [Quiz 05](../quizzes/quiz-05-async.html) |

## Objectifs

- Maitriser async/await dans les tests Vitest
- Utiliser resolves/rejects pour les assertions sur promesses
- Tester les callbacks converties en promesses
- Controler le temps avec vi.useFakeTimers et vi.advanceTimersByTime
- Tester les event emitters
- Implementer le pattern waitFor pour le polling
- Tester debounce et throttle
- Eviter les pieges courants (await oublie, rejections non-gerees)

---

## async/await dans les tests

### Le test async de base

```typescript
import { describe, it, expect } from 'vitest';

async function fetchUser(id: number): Promise<{ id: number; name: string }> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error(`User ${id} not found`);
  return response.json();
}

describe('fetchUser', () => {
  // Le test est une fonction async
  it('should return user data', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, name: 'Alice' }),
    }));

    // Act — TOUJOURS await les fonctions async
    const user = await fetchUser(1);

    // Assert
    expect(user).toEqual({ id: 1, name: 'Alice' });
  });
});
```

### Pourquoi async est indispensable

Sans `async/await`, le test se termine AVANT que la promesse ne se resolve :

```typescript
// MAUVAIS : le test passe toujours (l'assertion n'est jamais executee)
it('should fetch user', () => {
  fetchUser(1).then((user) => {
    expect(user.name).toBe('WRONG NAME'); // Jamais execute !
  });
  // Le test se termine ici, AVANT le .then
});

// BON : le test attend la promesse
it('should fetch user', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Alice');
});
```

### Multiples awaits

```typescript
it('should process order end to end', async () => {
  // Plusieurs operations async en sequence
  const user = await createUser({ name: 'Alice', email: 'alice@test.com' });
  const order = await createOrder(user.id, [{ productId: 1, qty: 2 }]);
  const confirmation = await processPayment(order.id, { method: 'card' });

  expect(confirmation.status).toBe('paid');
  expect(confirmation.orderId).toBe(order.id);
});
```

### Promesses paralleles

```typescript
it('should fetch multiple resources concurrently', async () => {
  const [users, products, categories] = await Promise.all([
    fetchUsers(),
    fetchProducts(),
    fetchCategories(),
  ]);

  expect(users).toHaveLength(10);
  expect(products).toHaveLength(50);
  expect(categories).toHaveLength(5);
});

it('should handle partial failures with Promise.allSettled', async () => {
  const results = await Promise.allSettled([
    fetchUser(1),    // succeeds
    fetchUser(999),  // fails
    fetchUser(2),    // succeeds
  ]);

  expect(results[0]).toEqual({ status: 'fulfilled', value: expect.any(Object) });
  expect(results[1]).toEqual({ status: 'rejected', reason: expect.any(Error) });
  expect(results[2]).toEqual({ status: 'fulfilled', value: expect.any(Object) });
});
```

---

## resolves / rejects

### resolves — assertion sur promesse resolue

```typescript
// Au lieu de :
it('should return user', async () => {
  const user = await fetchUser(1);
  expect(user).toEqual({ id: 1, name: 'Alice' });
});

// On peut ecrire :
it('should return user', async () => {
  await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alice' });
});

// Chainer avec d'autres matchers
it('should return user with name', async () => {
  await expect(fetchUser(1)).resolves.toHaveProperty('name', 'Alice');
});

it('should return a truthy result', async () => {
  await expect(fetchUser(1)).resolves.toBeTruthy();
});
```

### rejects — assertion sur promesse rejetee

```typescript
it('should reject for invalid ID', async () => {
  await expect(fetchUser(-1)).rejects.toThrow('not found');
});

it('should reject with specific error type', async () => {
  await expect(fetchUser(-1)).rejects.toThrow(NotFoundError);
});

it('should reject with error matching pattern', async () => {
  await expect(fetchUser(-1)).rejects.toThrow(/not found/i);
});

// Verifier les proprietes de l'erreur
it('should reject with detailed error', async () => {
  await expect(fetchUser(-1)).rejects.toMatchObject({
    message: expect.stringContaining('not found'),
    statusCode: 404,
  });
});
```

### PIEGE : oublier await devant expect().resolves/rejects

```typescript
// MAUVAIS : sans await, le test passe TOUJOURS
it('should reject', () => {
  expect(fetchUser(-1)).rejects.toThrow('not found');
  // Le test se termine avant que la promesse ne rejette
});

// BON : avec await
it('should reject', async () => {
  await expect(fetchUser(-1)).rejects.toThrow('not found');
});
```

---

## Callbacks vers Promesses

Le code legacy utilise souvent des callbacks. Voici comment les tester :

### Wrapper callback en Promise

```typescript
// Code legacy avec callback
function readConfig(path: string, callback: (err: Error | null, data?: Config) => void): void {
  // ... lecture asynchrone avec callback
}

// Wrapper en Promise pour tester facilement
function readConfigAsync(path: string): Promise<Config> {
  return new Promise((resolve, reject) => {
    readConfig(path, (err, data) => {
      if (err) reject(err);
      else resolve(data!);
    });
  });
}

describe('readConfig', () => {
  it('should read config file', async () => {
    const config = await readConfigAsync('./config.json');
    expect(config).toHaveProperty('database');
  });

  it('should reject for missing file', async () => {
    await expect(readConfigAsync('./nonexistent.json')).rejects.toThrow();
  });
});
```

### Tester directement avec callbacks

```typescript
// Quand le wrapper n'est pas souhaitable
it('should call callback with data', () => {
  return new Promise<void>((resolve, reject) => {
    readConfig('./config.json', (err, data) => {
      try {
        expect(err).toBeNull();
        expect(data).toHaveProperty('database');
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
});
```

### Node.js util.promisify

```typescript
import { promisify } from 'node:util';

const readConfigAsync = promisify(readConfig);

it('should read config', async () => {
  const config = await readConfigAsync('./config.json');
  expect(config.database.host).toBe('localhost');
});
```

---

## Timer mocking avec du code async

### setTimeout + async

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithDelay<T>(
  fn: () => Promise<T>,
  retries: number,
  delayMs: number
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      await delay(delayMs);
    }
  }
  throw new Error('Unreachable');
}

describe('retryWithDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await retryWithDelay(fn, 3, 1000);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry and succeed on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    // Lancer la promesse SANS await pour pouvoir avancer le temps
    const promise = retryWithDelay(fn, 3, 1000);

    // Avancer le temps pour que le delay se resolve
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after all retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    const promise = retryWithDelay(fn, 2, 500);

    // Avancer pour chaque retry
    await vi.advanceTimersByTimeAsync(500); // retry 1
    await vi.advanceTimersByTimeAsync(500); // retry 2

    await expect(promise).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
```

### vi.advanceTimersByTimeAsync vs vi.advanceTimersByTime

```typescript
// vi.advanceTimersByTime — synchrone, avance les timers
// Probleme : ne flush pas les microtasks (Promise callbacks)
vi.advanceTimersByTime(1000);

// vi.advanceTimersByTimeAsync — async, avance les timers ET flush les microtasks
await vi.advanceTimersByTimeAsync(1000);

// Regle : si votre code utilise setTimeout + async/await,
// utilisez TOUJOURS vi.advanceTimersByTimeAsync
```

### setInterval avec fake timers

```typescript
function createPoller(
  fn: () => Promise<void>,
  intervalMs: number
): { start: () => void; stop: () => void } {
  let id: ReturnType<typeof setInterval> | null = null;
  return {
    start() {
      id = setInterval(fn, intervalMs);
    },
    stop() {
      if (id) clearInterval(id);
      id = null;
    },
  };
}

describe('createPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call function at regular intervals', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const poller = createPoller(fn, 5000);

    poller.start();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(15000);
    expect(fn).toHaveBeenCalledTimes(5);

    poller.stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(5); // plus d'appels apres stop
  });
});
```

---

## Tester les event emitters

### EventEmitter Node.js

```typescript
import { EventEmitter } from 'node:events';

class OrderProcessor extends EventEmitter {
  async process(orderId: number): Promise<void> {
    this.emit('processing', { orderId });

    try {
      // Simuler un traitement async
      await this.validate(orderId);
      this.emit('validated', { orderId });

      await this.charge(orderId);
      this.emit('charged', { orderId });

      this.emit('completed', { orderId, status: 'success' });
    } catch (error) {
      this.emit('error', { orderId, error });
    }
  }

  private async validate(orderId: number): Promise<void> {
    if (orderId <= 0) throw new Error('Invalid order');
  }

  private async charge(_orderId: number): Promise<void> {
    // ...
  }
}
```

```typescript
describe('OrderProcessor events', () => {
  let processor: OrderProcessor;

  beforeEach(() => {
    processor = new OrderProcessor();
  });

  it('should emit events in order during processing', async () => {
    const events: string[] = [];

    processor.on('processing', () => events.push('processing'));
    processor.on('validated', () => events.push('validated'));
    processor.on('charged', () => events.push('charged'));
    processor.on('completed', () => events.push('completed'));

    await processor.process(1);

    expect(events).toEqual(['processing', 'validated', 'charged', 'completed']);
  });

  it('should emit error event on invalid order', async () => {
    const errorHandler = vi.fn();
    processor.on('error', errorHandler);

    await processor.process(-1);

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: -1,
        error: expect.any(Error),
      })
    );
  });

  it('should emit completed with success status', async () => {
    // Utiliser une promesse pour attendre l'event
    const completedPromise = new Promise<{ orderId: number; status: string }>((resolve) => {
      processor.on('completed', resolve);
    });

    await processor.process(42);

    const result = await completedPromise;
    expect(result).toEqual({ orderId: 42, status: 'success' });
  });
});
```

### Pattern "once" pour les events async

```typescript
import { once } from 'node:events';

it('should emit data event', async () => {
  const emitter = new EventEmitter();

  // Programmer l'emission dans le futur
  setTimeout(() => emitter.emit('data', { value: 42 }), 100);

  // Attendre l'event (retourne un tableau d'arguments)
  vi.useFakeTimers();
  const promise = once(emitter, 'data');
  await vi.advanceTimersByTimeAsync(100);
  const [result] = await promise;

  expect(result).toEqual({ value: 42 });
  vi.useRealTimers();
});
```

---

## Custom event patterns (DOM-like)

```typescript
type EventHandler<T = unknown> = (data: T) => void;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  emit<T>(event: string, data: T): void {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }
}

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should deliver events to subscribers', () => {
    const handler = vi.fn();
    bus.on('user:created', handler);

    bus.emit('user:created', { id: 1, name: 'Alice' });

    expect(handler).toHaveBeenCalledWith({ id: 1, name: 'Alice' });
  });

  it('should support multiple subscribers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('order:placed', handler1);
    bus.on('order:placed', handler2);

    bus.emit('order:placed', { orderId: 42 });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('should unsubscribe correctly', () => {
    const handler = vi.fn();
    bus.on('event', handler);
    bus.off('event', handler);

    bus.emit('event', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not affect other events when unsubscribing', () => {
    const handler = vi.fn();
    bus.on('event-a', handler);
    bus.on('event-b', handler);
    bus.off('event-a', handler);

    bus.emit('event-a', 'a');
    bus.emit('event-b', 'b');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('b');
  });
});
```

---

## Le pattern waitFor (polling)

Parfois on doit attendre qu'une condition devienne vraie :

```typescript
// src/test-utils/wait-for.ts
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}
```

```typescript
// Utilisation dans les tests
describe('AsyncQueue', () => {
  it('should process all items eventually', async () => {
    const queue = new AsyncQueue();
    const results: number[] = [];

    queue.on('processed', (item: number) => results.push(item));

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    // Attendre que les 3 items soient traites
    await waitFor(() => results.length === 3, { timeout: 2000 });

    expect(results).toEqual([1, 2, 3]);
  });

  it('should timeout if processing takes too long', async () => {
    const queue = new AsyncQueue({ processingDelay: 10000 });
    queue.enqueue(1);

    await expect(
      waitFor(() => queue.isEmpty(), { timeout: 100 })
    ).rejects.toThrow('waitFor timed out');
  });
});
```

### waitFor avec fake timers

```typescript
describe('waitFor with fake timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should work with fake timers', async () => {
    let ready = false;

    // Simuler une condition qui devient vraie apres 500ms
    setTimeout(() => { ready = true; }, 500);

    const promise = waitFor(() => ready, { timeout: 1000, interval: 50 });

    // Avancer le temps
    await vi.advanceTimersByTimeAsync(500);

    await promise; // ne devrait pas rejeter
  });
});
```

---

## Tester debounce et throttle

### Debounce

```typescript
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };

  return debounced;
}

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should restart timer on rapid calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should pass latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledWith('third');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    debounced.cancel();

    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

### Throttle

```typescript
function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): T {
  let lastCall = 0;

  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 1000);

    throttled();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should block calls within the limit', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 1000);

    throttled();
    vi.advanceTimersByTime(500);
    throttled(); // blocked
    throttled(); // blocked

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should allow calls after the limit', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 1000);

    throttled();
    vi.advanceTimersByTime(1000);
    throttled(); // allowed

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throttle rapid burst', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 200);

    // Simuler un burst de 10 appels sur 1 seconde
    for (let i = 0; i < 10; i++) {
      throttled();
      vi.advanceTimersByTime(100);
    }

    // 200ms throttle sur 1000ms = ~5 appels autorises
    expect(fn).toHaveBeenCalledTimes(5);
  });
});
```

---

## Race conditions et ordre des tests

### Les tests doivent etre independants

```typescript
// MAUVAIS : les tests dependent d'un etat partage
let sharedDb: Database;

beforeAll(async () => {
  sharedDb = await createDatabase();
});

it('should create user', async () => {
  await sharedDb.insert('users', { id: 1, name: 'Alice' });
  const user = await sharedDb.findById('users', 1);
  expect(user.name).toBe('Alice');
});

it('should list users', async () => {
  // DEPEND du test precedent : Alice doit exister !
  const users = await sharedDb.findAll('users');
  expect(users).toHaveLength(1); // Fragile !
});

// BON : chaque test a son propre etat
beforeEach(async () => {
  sharedDb = await createDatabase();
  // OU : await sharedDb.clear();
});

it('should create user', async () => {
  await sharedDb.insert('users', { id: 1, name: 'Alice' });
  const user = await sharedDb.findById('users', 1);
  expect(user.name).toBe('Alice');
});

it('should list users after insert', async () => {
  // Arrange : chaque test cree ses donnees
  await sharedDb.insert('users', { id: 1, name: 'Alice' });

  const users = await sharedDb.findAll('users');
  expect(users).toHaveLength(1);
});
```

### Race conditions dans le code sous test

```typescript
// Code avec race condition potentielle
class Counter {
  private count = 0;

  async increment(): Promise<number> {
    const current = this.count;
    await delay(10); // simule une latence
    this.count = current + 1;
    return this.count;
  }

  getCount(): number {
    return this.count;
  }
}

describe('Counter race condition', () => {
  it('demonstrates race condition with concurrent increments', async () => {
    const counter = new Counter();

    // Lancer 3 increments en parallele
    const results = await Promise.all([
      counter.increment(),
      counter.increment(),
      counter.increment(),
    ]);

    // Race condition : tous lisent count=0, puis ecrivent count=1
    // Resultat attendu si pas de protection : count = 1 au lieu de 3
    expect(counter.getCount()).toBe(1); // BUG ! Devrait etre 3
  });
});
```

---

## Pieges courants et solutions

### 1. Oublier await

```typescript
// PIEGE : le test passe meme si fetchUser rejette
it('should return user', () => { // Pas async !
  expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alice' }); // Pas await !
});

// SOLUTION
it('should return user', async () => {
  await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alice' });
});
```

### 2. Rejections non-gerees

```typescript
// PIEGE : promesse rejetee non catchee
it('should handle errors', async () => {
  const promise = fetchUser(-1); // rejette mais non-catchee

  // Si on n'assert pas la rejection, node.js peut crash
  // ou le test peut passer par accident

  // SOLUTION : toujours assert la rejection
  await expect(promise).rejects.toThrow();
});
```

### 3. Fake timers et promesses

```typescript
// PIEGE : vi.advanceTimersByTime ne flush pas les microtasks
it('should not work', () => {
  const fn = vi.fn();
  delay(100).then(fn);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalled(); // ECHOUE : .then pas execute
});

// SOLUTION : utiliser la version async
it('should work', async () => {
  const fn = vi.fn();
  delay(100).then(fn);

  await vi.advanceTimersByTimeAsync(100);
  expect(fn).toHaveBeenCalled(); // PASSE
});
```

### 4. Setup/teardown async

```typescript
// PIEGE : oublier await dans beforeEach/afterEach
beforeEach(() => {
  // PAS await — la DB n'est peut-etre pas prete quand le test demarre
  resetDatabase();
});

// SOLUTION
beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await closeConnections();
});
```

### 5. Test qui ne finit jamais (timeout)

```typescript
// PIEGE : promesse qui ne se resolve jamais
it('should complete', async () => {
  await new Promise((resolve) => {
    // On attend un event qui n'arrive jamais...
    emitter.on('done', resolve);
    // Oubli d'appeler la methode qui emet 'done'
  });
  // Test timeout apres 5s !
});

// SOLUTION : ajouter un timeout explicite
it('should complete', async () => {
  const result = await Promise.race([
    new Promise((resolve) => {
      emitter.on('done', resolve);
      emitter.process(); // Ne pas oublier !
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), 1000)
    ),
  ]);

  expect(result).toBeDefined();
});

// OU : configurer le timeout du test
it('should complete', { timeout: 2000 }, async () => {
  // ...
});
```

### 6. Erreurs swallowed dans les callbacks

```typescript
// PIEGE : l'erreur d'assertion est attrapee par le try-catch du code sous test
it('should handle callback correctly', async () => {
  let capturedData: unknown;

  await processAsync((data) => {
    capturedData = data;
  });

  // Assert APRES que le callback a ete appele
  expect(capturedData).toEqual({ status: 'ok' });
});
```

---

## Exemple complet : service de notification avec retry

```typescript
// src/services/notification-service.ts
interface NotificationResult {
  sent: boolean;
  attempts: number;
  error?: string;
}

export class NotificationService {
  constructor(
    private readonly sender: { send: (to: string, message: string) => Promise<void> },
    private readonly maxRetries: number = 3,
    private readonly retryDelay: number = 1000
  ) {}

  async notify(to: string, message: string): Promise<NotificationResult> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.sender.send(to, message);
        return { sent: true, attempts: attempt };
      } catch (error) {
        if (attempt === this.maxRetries) {
          return {
            sent: false,
            attempts: attempt,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      }
    }
    return { sent: false, attempts: this.maxRetries, error: 'Unreachable' };
  }
}
```

```typescript
// src/services/notification-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from './notification-service';

describe('NotificationService', () => {
  let mockSender: { send: ReturnType<typeof vi.fn> };
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSender = { send: vi.fn() };
    service = new NotificationService(mockSender, 3, 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should send notification successfully on first attempt', async () => {
    mockSender.send.mockResolvedValue(undefined);

    const result = await service.notify('alice@test.com', 'Hello');

    expect(result).toEqual({ sent: true, attempts: 1 });
    expect(mockSender.send).toHaveBeenCalledWith('alice@test.com', 'Hello');
  });

  it('should retry and succeed on second attempt', async () => {
    mockSender.send
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce(undefined);

    const promise = service.notify('alice@test.com', 'Hello');

    // Avancer le temps pour le retry delay
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(result).toEqual({ sent: true, attempts: 2 });
    expect(mockSender.send).toHaveBeenCalledTimes(2);
  });

  it('should return failure after all retries exhausted', async () => {
    mockSender.send.mockRejectedValue(new Error('Persistent failure'));

    const promise = service.notify('alice@test.com', 'Hello');

    // Avancer le temps pour chaque retry
    await vi.advanceTimersByTimeAsync(1000); // retry 1 -> 2
    await vi.advanceTimersByTimeAsync(1000); // retry 2 -> 3

    const result = await promise;

    expect(result).toEqual({
      sent: false,
      attempts: 3,
      error: 'Persistent failure',
    });
    expect(mockSender.send).toHaveBeenCalledTimes(3);
  });

  it('should wait retryDelay between attempts', async () => {
    mockSender.send
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    const promise = service.notify('alice@test.com', 'Hello');

    // Pas encore retry
    expect(mockSender.send).toHaveBeenCalledTimes(1);

    // Avancer 999ms — toujours pas de retry
    await vi.advanceTimersByTimeAsync(999);
    expect(mockSender.send).toHaveBeenCalledTimes(1);

    // 1ms de plus — retry declenche
    await vi.advanceTimersByTimeAsync(1);
    expect(mockSender.send).toHaveBeenCalledTimes(2);

    await promise;
  });
});
```

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| [04 - Mocking et test doubles](./04-mocking-et-test-doubles) | [06 - Architecture testable](./06-architecture-testable) |

---

## Ressources

- [Quiz 05 : Testez vos connaissances](../quizzes/quiz-05-async.html)
- [Lab 05 : Tests asynchrones](../labs/lab-05-tests-asynchrones/)
- [Documentation Vitest : Async](https://vitest.dev/guide/async.html)
- [Documentation Vitest : Fake Timers](https://vitest.dev/api/vi.html#vi-usefaketimers)
- MDN — [Using Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- Jake Archibald — [Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/)
