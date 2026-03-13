// =============================================================================
// Lab 04 — Mocking et test doubles (Solution)
// =============================================================================

import { createTestRunner, createMockFn, assertCalledTimes, assertCalledWith, createFakeTimer } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Types de test doubles
// =============================================================================

interface Logger {
  info(message: string): void;
  error(message: string): void;
  getHistory(): string[];
}

// Stub : ne fait rien, retourne des valeurs par defaut
function createStubLogger(): Logger {
  return {
    info(_message: string): void {},
    error(_message: string): void {},
    getHistory(): string[] { return []; },
  };
}

// Spy : enregistre tous les appels
function createSpyLogger(): Logger & { calls: { method: string; args: string[] }[] } {
  const calls: { method: string; args: string[] }[] = [];
  return {
    calls,
    info(message: string): void { calls.push({ method: 'info', args: [message] }); },
    error(message: string): void { calls.push({ method: 'error', args: [message] }); },
    getHistory(): string[] { return calls.map(c => `[${c.method}] ${c.args[0]}`); },
  };
}

// Mock : verifie que les appels attendus sont effectues
function createMockLogger(expectedCalls: { method: string; args: string[] }[]): Logger & { verify(): void } {
  const actualCalls: { method: string; args: string[] }[] = [];
  return {
    info(message: string): void { actualCalls.push({ method: 'info', args: [message] }); },
    error(message: string): void { actualCalls.push({ method: 'error', args: [message] }); },
    getHistory(): string[] { return actualCalls.map(c => `[${c.method}] ${c.args[0]}`); },
    verify(): void {
      if (actualCalls.length !== expectedCalls.length) {
        throw new Error(`Expected ${expectedCalls.length} calls, got ${actualCalls.length}`);
      }
      for (let i = 0; i < expectedCalls.length; i++) {
        if (actualCalls[i].method !== expectedCalls[i].method ||
            JSON.stringify(actualCalls[i].args) !== JSON.stringify(expectedCalls[i].args)) {
          throw new Error(`Call ${i}: expected ${JSON.stringify(expectedCalls[i])}, got ${JSON.stringify(actualCalls[i])}`);
        }
      }
    },
  };
}

// Fake : implementation simplifiee mais fonctionnelle
function createFakeLogger(): Logger {
  const history: string[] = [];
  return {
    info(message: string): void { history.push(`[INFO] ${message}`); },
    error(message: string): void { history.push(`[ERROR] ${message}`); },
    getHistory(): string[] { return [...history]; },
  };
}

// =============================================================================
// Exercise 2: Mock fetch pour UserService
// =============================================================================

interface UserData {
  id: number;
  name: string;
  email: string;
}

class UserService {
  constructor(private fetchFn: (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown>; status?: number }>) {}

  async getById(id: number): Promise<UserData> {
    const response = await this.fetchFn(`/api/users/${id}`);
    if (!response.ok) throw new Error(`User not found: ${id}`);
    return response.json() as Promise<UserData>;
  }
}

// =============================================================================
// Exercise 3: Mocking de timers — Scheduler
// =============================================================================

interface TimerFns {
  setTimeout: (cb: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
}

class Scheduler {
  private timerFns: TimerFns;

  constructor(timerFns?: TimerFns) {
    this.timerFns = timerFns || {
      setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms) as unknown as number,
      clearTimeout: (id) => globalThis.clearTimeout(id),
    };
  }

  schedule(callback: () => void, delayMs: number): { cancel: () => void } {
    const id = this.timerFns.setTimeout(callback, delayMs);
    return {
      cancel: () => this.timerFns.clearTimeout(id),
    };
  }
}

// =============================================================================
// Exercise 4: Mock de database module
// =============================================================================

interface Database {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  insert(table: string, data: Record<string, unknown>): Promise<{ id: number }>;
  delete(table: string, id: number): Promise<boolean>;
}

interface Product {
  id: number;
  name: string;
  price: number;
}

class ProductRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Product[]> {
    return this.db.query<Product>('SELECT * FROM products');
  }

  async findById(id: number): Promise<Product | null> {
    const results = await this.db.query<Product>('SELECT * FROM products WHERE id = ?', [id]);
    return results.length > 0 ? results[0] : null;
  }

  async create(product: Omit<Product, 'id'>): Promise<Product> {
    const { id } = await this.db.insert('products', product as Record<string, unknown>);
    return { id, ...product };
  }

  async remove(id: number): Promise<boolean> {
    return this.db.delete('products', id);
  }
}

function createMockDatabase(): Database & { _queryResults: Map<string, unknown[]>; _nextInsertId: number } {
  const mock = {
    _queryResults: new Map<string, unknown[]>(),
    _nextInsertId: 1,
    async query<T>(sql: string, _params?: unknown[]): Promise<T[]> {
      return (mock._queryResults.get(sql) || []) as T[];
    },
    async insert(_table: string, _data: Record<string, unknown>): Promise<{ id: number }> {
      return { id: mock._nextInsertId++ };
    },
    async delete(_table: string, _id: number): Promise<boolean> {
      return true;
    },
  };
  return mock;
}

// =============================================================================
// Exercise 5: Mocking partiel
// =============================================================================

const mathUtils = {
  add(a: number, b: number): number { return a + b; },
  multiply(a: number, b: number): number { return a * b; },
  calculateTotal(price: number, quantity: number, taxRate: number): number {
    const subtotal = this.multiply(price, quantity);
    const tax = this.multiply(subtotal, taxRate);
    return this.add(subtotal, tax);
  },
};

// =============================================================================
// Exercise 6: DI — OrderService avec EmailService
// =============================================================================

interface EmailService {
  sendEmail(to: string, subject: string, body: string): Promise<boolean>;
}

interface Order {
  id: string;
  customerEmail: string;
  items: { name: string; price: number }[];
  total: number;
}

class OrderService {
  constructor(private emailService: EmailService) {}

  async placeOrder(order: Order): Promise<{ success: boolean; emailSent: boolean }> {
    // Validate order
    if (!order.items.length) {
      return { success: false, emailSent: false };
    }

    // Send confirmation email
    const subject = `Order Confirmation #${order.id}`;
    const body = `Thank you! Your order of ${order.items.length} item(s) totaling $${order.total} has been placed.`;

    let emailSent = false;
    try {
      emailSent = await this.emailService.sendEmail(order.customerEmail, subject, body);
    } catch {
      emailSent = false;
    }

    return { success: true, emailSent };
  }
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assertDeepEqual, assert, assertThrows, run } = createTestRunner('Lab 04 — Mocking');

// --- Exercise 1: Test doubles ---
await test('Ex1: stub logger does nothing, returns defaults', () => {
  const logger = createStubLogger();
  logger.info('test');
  logger.error('test');
  assertEqual(logger.getHistory().length, 0);
});

await test('Ex1: spy logger records all calls', () => {
  const logger = createSpyLogger();
  logger.info('hello');
  logger.error('oops');
  assertEqual(logger.calls.length, 2);
  assertEqual(logger.calls[0].method, 'info');
  assertEqual(logger.calls[0].args[0], 'hello');
  assertEqual(logger.calls[1].method, 'error');
});

await test('Ex1: mock logger verifies expected calls', () => {
  const logger = createMockLogger([
    { method: 'info', args: ['start'] },
    { method: 'error', args: ['fail'] },
  ]);
  logger.info('start');
  logger.error('fail');
  logger.verify(); // should not throw
});

await test('Ex1: mock logger fails on unexpected calls', () => {
  const logger = createMockLogger([
    { method: 'info', args: ['expected'] },
  ]);
  logger.info('expected');
  logger.error('unexpected');
  assertThrows(() => logger.verify());
});

await test('Ex1: fake logger maintains real history', () => {
  const logger = createFakeLogger();
  logger.info('first');
  logger.error('second');
  const history = logger.getHistory();
  assertEqual(history.length, 2);
  assertEqual(history[0], '[INFO] first');
  assertEqual(history[1], '[ERROR] second');
});

// --- Exercise 2: Mock fetch ---
await test('Ex2: UserService.getById returns user on success', async () => {
  const user: UserData = { id: 1, name: 'Alice', email: 'alice@test.com' };
  const mockFetch = createMockFn<[string], Promise<{ ok: boolean; json: () => Promise<unknown> }>>();
  mockFetch.mockImplementation(async () => ({ ok: true, json: async () => user }));

  const service = new UserService(mockFetch);
  const result = await service.getById(1);
  assertEqual(result.name, 'Alice');
  assertEqual(result.email, 'alice@test.com');
  assertCalledWith(mockFetch, ['/api/users/1']);
});

await test('Ex2: UserService.getById throws on not found', async () => {
  const mockFetch = createMockFn<[string], Promise<{ ok: boolean; json: () => Promise<unknown> }>>();
  mockFetch.mockImplementation(async () => ({ ok: false, json: async () => null }));

  const service = new UserService(mockFetch);
  let threw = false;
  try { await service.getById(999); } catch { threw = true; }
  assert(threw, 'Should throw for not found user');
});

await test('Ex2: mock fetch called exactly once', async () => {
  const mockFetch = createMockFn<[string], Promise<{ ok: boolean; json: () => Promise<unknown> }>>();
  mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ id: 1, name: 'X', email: 'x' }) }));

  const service = new UserService(mockFetch);
  await service.getById(1);
  assertCalledTimes(mockFetch, 1);
});

// --- Exercise 3: Fake timer with Scheduler ---
await test('Ex3: scheduler executes callback after delay', () => {
  const timer = createFakeTimer();
  const callback = createMockFn();

  const scheduler = new Scheduler({
    setTimeout: timer.setTimeout,
    clearTimeout: timer.clearTimeout,
  });
  scheduler.schedule(callback, 1000);

  assertCalledTimes(callback, 0);
  timer.tick(999);
  assertCalledTimes(callback, 0);
  timer.tick(1);
  assertCalledTimes(callback, 1);
});

await test('Ex3: scheduler cancel prevents execution', () => {
  const timer = createFakeTimer();
  const callback = createMockFn();

  const scheduler = new Scheduler({
    setTimeout: timer.setTimeout,
    clearTimeout: timer.clearTimeout,
  });
  const { cancel } = scheduler.schedule(callback, 1000);

  timer.tick(500);
  cancel();
  timer.tick(1000);
  assertCalledTimes(callback, 0);
});

await test('Ex3: multiple scheduled tasks', () => {
  const timer = createFakeTimer();
  const cb1 = createMockFn();
  const cb2 = createMockFn();

  const scheduler = new Scheduler({
    setTimeout: timer.setTimeout,
    clearTimeout: timer.clearTimeout,
  });
  scheduler.schedule(cb1, 100);
  scheduler.schedule(cb2, 200);

  timer.tick(150);
  assertCalledTimes(cb1, 1);
  assertCalledTimes(cb2, 0);

  timer.tick(50);
  assertCalledTimes(cb2, 1);
});

// --- Exercise 4: Mock database ---
await test('Ex4: ProductRepository.findAll queries database', async () => {
  const db = createMockDatabase();
  const products: Product[] = [
    { id: 1, name: 'Widget', price: 9.99 },
    { id: 2, name: 'Gadget', price: 19.99 },
  ];
  db._queryResults.set('SELECT * FROM products', products);

  const repo = new ProductRepository(db);
  const result = await repo.findAll();
  assertEqual(result.length, 2);
  assertEqual(result[0].name, 'Widget');
});

await test('Ex4: ProductRepository.findById returns null when not found', async () => {
  const db = createMockDatabase();
  db._queryResults.set('SELECT * FROM products WHERE id = ?', []);

  const repo = new ProductRepository(db);
  const result = await repo.findById(999);
  assertEqual(result, null);
});

await test('Ex4: ProductRepository.create returns product with id', async () => {
  const db = createMockDatabase();
  db._nextInsertId = 42;

  const repo = new ProductRepository(db);
  const result = await repo.create({ name: 'New Item', price: 29.99 });
  assertEqual(result.id, 42);
  assertEqual(result.name, 'New Item');
  assertEqual(result.price, 29.99);
});

await test('Ex4: ProductRepository.remove delegates to database', async () => {
  const db = createMockDatabase();
  const repo = new ProductRepository(db);
  const result = await repo.remove(1);
  assert(result, 'Should return true on successful delete');
});

// --- Exercise 5: Partial mocking ---
await test('Ex5: calculateTotal uses multiply and add internally', () => {
  const result = mathUtils.calculateTotal(100, 3, 0.2);
  // 100*3 = 300 subtotal, 300*0.2 = 60 tax, 300+60 = 360
  assertEqual(result, 360);
});

await test('Ex5: partial mock — spy on multiply, keep add real', () => {
  const originalMultiply = mathUtils.multiply;
  const multiplySpy = createMockFn<[number, number], number>();
  multiplySpy.mockImplementation((a: number, b: number) => a * b);
  mathUtils.multiply = multiplySpy;

  const result = mathUtils.calculateTotal(50, 2, 0.1);
  // 50*2 = 100, 100*0.1 = 10, 100+10 = 110
  assertEqual(result, 110);
  assert(multiplySpy.calls.length >= 2, 'multiply should be called at least twice');

  // Restore
  mathUtils.multiply = originalMultiply;
});

await test('Ex5: real functions still work after restore', () => {
  assertEqual(mathUtils.add(3, 4), 7);
  assertEqual(mathUtils.multiply(3, 4), 12);
});

// --- Exercise 6: OrderService with DI ---
await test('Ex6: OrderService sends confirmation email on success', async () => {
  const sendEmail = createMockFn<[string, string, string], Promise<boolean>>();
  sendEmail.mockReturnValue(Promise.resolve(true));
  const emailService: EmailService = { sendEmail };

  const service = new OrderService(emailService);
  const order: Order = {
    id: 'ORD-001',
    customerEmail: 'alice@test.com',
    items: [{ name: 'Widget', price: 10 }],
    total: 10,
  };
  const result = await service.placeOrder(order);
  assert(result.success);
  assert(result.emailSent);
  assertCalledTimes(sendEmail, 1);
  assertCalledWith(sendEmail, ['alice@test.com', 'Order Confirmation #ORD-001', 'Thank you! Your order of 1 item(s) totaling $10 has been placed.']);
});

await test('Ex6: OrderService handles email failure gracefully', async () => {
  const sendEmail = createMockFn<[string, string, string], Promise<boolean>>();
  sendEmail.mockImplementation(async () => { throw new Error('SMTP down'); });
  const emailService: EmailService = { sendEmail };

  const service = new OrderService(emailService);
  const order: Order = {
    id: 'ORD-002',
    customerEmail: 'bob@test.com',
    items: [{ name: 'Gadget', price: 20 }],
    total: 20,
  };
  const result = await service.placeOrder(order);
  assert(result.success, 'Order should still succeed');
  assert(!result.emailSent, 'Email should not be sent');
});

await test('Ex6: OrderService rejects empty orders', async () => {
  const sendEmail = createMockFn<[string, string, string], Promise<boolean>>();
  const emailService: EmailService = { sendEmail };

  const service = new OrderService(emailService);
  const order: Order = { id: 'ORD-003', customerEmail: 'x@test.com', items: [], total: 0 };
  const result = await service.placeOrder(order);
  assert(!result.success);
  assertCalledTimes(sendEmail, 0);
});

assertDeepEqual; // keep import used

run();
