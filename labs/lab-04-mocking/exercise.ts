// =============================================================================
// Lab 04 — Mocking et test doubles (Exercices)
// =============================================================================

import { createTestRunner, createMockFn } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Types de test doubles
// Creez stub, spy, mock et fake pour l'interface Logger
// =============================================================================

interface Logger {
  info(message: string): void;
  error(message: string): void;
  getHistory(): string[];
}

function createStubLogger(): Logger {
  // TODO: un stub qui ne fait rien
  throw new Error('Not implemented');
}

function createSpyLogger(): Logger & { calls: { method: string; args: string[] }[] } {
  // TODO: un spy qui enregistre les appels
  throw new Error('Not implemented');
}

function createMockLogger(_expectedCalls: { method: string; args: string[] }[]): Logger & { verify(): void } {
  // TODO: un mock qui verifie les appels attendus
  throw new Error('Not implemented');
}

function createFakeLogger(): Logger {
  // TODO: un fake avec un vrai historique en memoire
  throw new Error('Not implemented');
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
  constructor(private _fetchFn: typeof fetch) {}
  async getById(_id: number): Promise<UserData> {
    // TODO: utilisez this._fetchFn pour appeler /api/users/:id
    throw new Error('Not implemented');
  }
}

// =============================================================================
// Exercise 3: Mocking de timers — Scheduler
// =============================================================================

class Scheduler {
  schedule(_callback: () => void, _delayMs: number, _timerFns?: { setTimeout: Function; clearTimeout: Function }): { cancel: () => void } {
    // TODO: planifie l'execution de callback apres delayMs
    throw new Error('Not implemented');
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
  constructor(private _db: Database) {}
  async findAll(): Promise<Product[]> {
    // TODO
    throw new Error('Not implemented');
  }
  async findById(_id: number): Promise<Product | null> {
    // TODO
    throw new Error('Not implemented');
  }
  async create(_product: Omit<Product, 'id'>): Promise<Product> {
    // TODO
    throw new Error('Not implemented');
  }
}

// =============================================================================
// Exercise 5: Mocking partiel
// =============================================================================

const mathUtils = {
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
  calculateTotal: function (price: number, quantity: number, tax: number): number {
    // TODO: utilise add et multiply en interne
    throw new Error('Not implemented');
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
  constructor(private _emailService: EmailService) {}
  async placeOrder(_order: Order): Promise<{ success: boolean; emailSent: boolean }> {
    // TODO: place l'ordre et envoie un email de confirmation
    throw new Error('Not implemented');
  }
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assert, run } = createTestRunner('Lab 04 — Mocking');

// --- Exercise 1 ---
await test('Ex1: stub logger does nothing', () => {
  const logger = createStubLogger();
  logger.info('test');
  logger.error('test');
  assertEqual(logger.getHistory().length, 0);
});
await test('Ex1: spy logger records calls', () => {
  const logger = createSpyLogger();
  logger.info('hello');
  logger.error('oops');
  assertEqual(logger.calls.length, 2);
});

// --- Exercise 2 ---
await test('Ex2: UserService.getById with mock fetch', async () => {
  const mockFetch = createMockFn<[string], Promise<Response>>();
  const user: UserData = { id: 1, name: 'Alice', email: 'alice@test.com' };
  mockFetch.mockImplementation(async () => ({ ok: true, json: async () => user } as Response));
  const service = new UserService(mockFetch as unknown as typeof fetch);
  const result = await service.getById(1);
  assertEqual(result.name, 'Alice');
});

// --- Exercise 3 ---
await test('Ex3: scheduler executes after delay', () => {
  // Would use fake timers in real Vitest
});

// --- Exercise 6 ---
await test('Ex6: OrderService sends confirmation email', async () => {
  const mockEmail: EmailService = {
    sendEmail: createMockFn<[string, string, string], Promise<boolean>>(),
  };
  (mockEmail.sendEmail as ReturnType<typeof createMockFn>).mockReturnValue(Promise.resolve(true));
  const service = new OrderService(mockEmail);
  const order: Order = { id: '1', customerEmail: 'a@b.com', items: [{ name: 'X', price: 10 }], total: 10 };
  const result = await service.placeOrder(order);
  assert(result.success);
  assert(result.emailSent);
});

run();
