// =============================================================================
// Lab 06 — Architecture testable (Solution)
// =============================================================================

import { createTestRunner, createMockFn, assertCalledTimes } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Injection de dependances — NotificationService
// =============================================================================

interface UserRepository {
  findById(id: string): Promise<{ id: string; email: string; name: string }>;
}

interface EmailSender {
  send(to: string, message: string): Promise<void>;
}

class NotificationService {
  constructor(
    private userRepo: UserRepository,
    private emailSender: EmailSender,
  ) {}

  async notify(userId: string, message: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    await this.emailSender.send(user.email, message);
  }
}

// =============================================================================
// Exercise 2: Fonctions pures extraites du PriceCalculator
// =============================================================================

function calculateDiscount(price: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0 and 100');
  }
  return price * (discountPercent / 100);
}

function calculateTax(price: number, taxRate: number): number {
  return price * taxRate;
}

function calculateTotal(price: number, discount: number, tax: number): number {
  return price - discount + tax;
}

class PriceCalculator {
  constructor(private taxRate: number) {}

  calculate(price: number, discountPercent: number): { discount: number; tax: number; total: number } {
    const discount = calculateDiscount(price, discountPercent);
    const priceAfterDiscount = price - discount;
    const tax = calculateTax(priceAfterDiscount, this.taxRate);
    const total = calculateTotal(price, discount, tax);
    return { discount, tax, total };
  }
}

// =============================================================================
// Exercise 3: Repository pattern — InMemoryRepository
// =============================================================================

interface Entity {
  id: string;
}

interface Repository<T extends Entity> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(item: Omit<T, 'id'>): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

class InMemoryRepository<T extends Entity> implements Repository<T> {
  private store = new Map<string, T>();
  private nextId = 1;

  async findAll(): Promise<T[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async create(item: Omit<T, 'id'>): Promise<T> {
    const id = String(this.nextId++);
    const entity = { ...item, id } as T;
    this.store.set(id, entity);
    return entity;
  }

  async update(id: string, item: Partial<T>): Promise<T | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...item, id };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

// =============================================================================
// Exercise 4: Interface Segregation (ISP)
// =============================================================================

interface UserAuthenticator {
  login(email: string, password: string): Promise<{ token: string }>;
  logout(token: string): Promise<void>;
}

interface UserProfileManager {
  getProfile(userId: string): Promise<{ name: string; email: string }>;
  updateProfile(userId: string, data: { name?: string; email?: string }): Promise<void>;
}

interface UserPreferences {
  getPreferences(userId: string): Promise<Record<string, string>>;
  setPreference(userId: string, key: string, value: string): Promise<void>;
}

// Simple in-memory implementations for testing
class InMemoryAuthenticator implements UserAuthenticator {
  private tokens = new Map<string, string>();
  private users = new Map<string, { email: string; password: string }>();

  addUser(email: string, password: string): void {
    this.users.set(email, { email, password });
  }

  async login(email: string, password: string): Promise<{ token: string }> {
    const user = this.users.get(email);
    if (!user || user.password !== password) throw new Error('Invalid credentials');
    const token = `token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.tokens.set(token, email);
    return { token };
  }

  async logout(token: string): Promise<void> {
    if (!this.tokens.delete(token)) throw new Error('Invalid token');
  }

  isLoggedIn(token: string): boolean {
    return this.tokens.has(token);
  }
}

class InMemoryProfileManager implements UserProfileManager {
  private profiles = new Map<string, { name: string; email: string }>();

  setProfile(userId: string, profile: { name: string; email: string }): void {
    this.profiles.set(userId, { ...profile });
  }

  async getProfile(userId: string): Promise<{ name: string; email: string }> {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error(`User ${userId} not found`);
    return { ...profile };
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error(`User ${userId} not found`);
    if (data.name !== undefined) profile.name = data.name;
    if (data.email !== undefined) profile.email = data.email;
  }
}

class InMemoryPreferences implements UserPreferences {
  private prefs = new Map<string, Record<string, string>>();

  async getPreferences(userId: string): Promise<Record<string, string>> {
    return { ...(this.prefs.get(userId) || {}) };
  }

  async setPreference(userId: string, key: string, value: string): Promise<void> {
    if (!this.prefs.has(userId)) this.prefs.set(userId, {});
    this.prefs.get(userId)![key] = value;
  }
}

// =============================================================================
// Exercise 5: Ports & Adapters — PaymentGateway
// =============================================================================

// Port (interface)
interface PaymentPort {
  charge(amount: number, currency: string, cardToken: string): Promise<{ transactionId: string; status: string }>;
  refund(transactionId: string): Promise<{ status: string }>;
}

// Fake adapter for tests
class FakePaymentAdapter implements PaymentPort {
  private transactions = new Map<string, { amount: number; currency: string; status: string }>();
  private nextTxId = 1;
  shouldFail = false;

  async charge(amount: number, currency: string, _cardToken: string): Promise<{ transactionId: string; status: string }> {
    if (this.shouldFail) throw new Error('Payment declined');
    const transactionId = `tx-${this.nextTxId++}`;
    this.transactions.set(transactionId, { amount, currency, status: 'charged' });
    return { transactionId, status: 'charged' };
  }

  async refund(transactionId: string): Promise<{ status: string }> {
    const tx = this.transactions.get(transactionId);
    if (!tx) throw new Error(`Transaction ${transactionId} not found`);
    tx.status = 'refunded';
    return { status: 'refunded' };
  }

  getTransaction(id: string) {
    return this.transactions.get(id);
  }
}

// Domain service using the port
class PaymentService {
  constructor(private paymentPort: PaymentPort) {}

  async processPayment(amount: number, currency: string, cardToken: string): Promise<{ transactionId: string; status: string }> {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.paymentPort.charge(amount, currency, cardToken);
  }

  async processRefund(transactionId: string): Promise<{ status: string }> {
    return this.paymentPort.refund(transactionId);
  }
}

// =============================================================================
// Exercise 6: Refactoring complet — FileProcessor
// =============================================================================

// Port: file system abstraction
interface FileSystem {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}

// Pure functions extracted
function parseLines(content: string): string[] {
  return content.split('\n').filter(line => line.trim() !== '');
}

function transformLines(lines: string[]): string[] {
  return lines.map(line => line.toUpperCase());
}

function formatOutput(lines: string[]): string {
  return lines.join('\n');
}

// Refactored FileProcessor with DI
class FileProcessor {
  constructor(private fs: FileSystem) {}

  async process(inputPath: string, outputPath: string): Promise<{ linesProcessed: number }> {
    const content = await this.fs.read(inputPath);
    const lines = parseLines(content);
    const transformed = transformLines(lines);
    const output = formatOutput(transformed);
    await this.fs.write(outputPath, output);
    return { linesProcessed: lines.length };
  }
}

// In-memory fake file system for testing
class InMemoryFileSystem implements FileSystem {
  private files = new Map<string, string>();

  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return content;
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assertDeepEqual, assert, assertThrows, run } = createTestRunner('Lab 06 — Architecture testable');

// --- Exercise 1: DI — NotificationService ---
await test('Ex1: NotificationService calls userRepo and emailSender', async () => {
  const findById = createMockFn<[string], Promise<{ id: string; email: string; name: string }>>();
  findById.mockImplementation(async (id) => ({ id, email: `${id}@test.com`, name: 'Test User' }));
  const send = createMockFn<[string, string], Promise<void>>();
  send.mockReturnValue(Promise.resolve());

  const service = new NotificationService({ findById }, { send });
  await service.notify('user-1', 'Hello!');

  assertCalledTimes(findById, 1);
  assertCalledTimes(send, 1);
  assertEqual(send.calls[0][0], 'user-1@test.com');
  assertEqual(send.calls[0][1], 'Hello!');
});

await test('Ex1: NotificationService propagates userRepo errors', async () => {
  const findById = createMockFn<[string], Promise<{ id: string; email: string; name: string }>>();
  findById.mockImplementation(async () => { throw new Error('User not found'); });
  const send = createMockFn<[string, string], Promise<void>>();

  const service = new NotificationService({ findById }, { send });
  let threw = false;
  try { await service.notify('unknown', 'msg'); } catch { threw = true; }
  assert(threw, 'Should propagate error');
  assertCalledTimes(send, 0);
});

// --- Exercise 2: Pure functions ---
await test('Ex2: calculateDiscount computes correctly', () => {
  assertEqual(calculateDiscount(100, 20), 20);
  assertEqual(calculateDiscount(50, 10), 5);
  assertEqual(calculateDiscount(100, 0), 0);
});

await test('Ex2: calculateDiscount rejects invalid percentages', () => {
  assertThrows(() => calculateDiscount(100, -5));
  assertThrows(() => calculateDiscount(100, 150));
});

await test('Ex2: calculateTax computes correctly', () => {
  assertEqual(calculateTax(100, 0.2), 20);
  assertEqual(calculateTax(80, 0.1), 8);
});

await test('Ex2: calculateTotal computes correctly', () => {
  assertEqual(calculateTotal(100, 20, 16), 96);
});

await test('Ex2: PriceCalculator combines pure functions', () => {
  const calc = new PriceCalculator(0.2);
  const result = calc.calculate(100, 10);
  // discount = 10, priceAfterDiscount = 90, tax = 18, total = 100 - 10 + 18 = 108
  assertEqual(result.discount, 10);
  assertEqual(result.tax, 18);
  assertEqual(result.total, 108);
});

// --- Exercise 3: InMemoryRepository ---
await test('Ex3: create and findAll', async () => {
  interface Task extends Entity { title: string }
  const repo = new InMemoryRepository<Task>();
  await repo.create({ title: 'Task 1' } as Omit<Task, 'id'>);
  await repo.create({ title: 'Task 2' } as Omit<Task, 'id'>);
  const all = await repo.findAll();
  assertEqual(all.length, 2);
});

await test('Ex3: findById returns item or null', async () => {
  interface Task extends Entity { title: string }
  const repo = new InMemoryRepository<Task>();
  const created = await repo.create({ title: 'Find me' } as Omit<Task, 'id'>);
  const found = await repo.findById(created.id);
  assert(found !== null);
  assertEqual(found!.title, 'Find me');
  const notFound = await repo.findById('999');
  assertEqual(notFound, null);
});

await test('Ex3: update modifies item', async () => {
  interface Task extends Entity { title: string }
  const repo = new InMemoryRepository<Task>();
  const created = await repo.create({ title: 'Original' } as Omit<Task, 'id'>);
  const updated = await repo.update(created.id, { title: 'Updated' });
  assert(updated !== null);
  assertEqual(updated!.title, 'Updated');
  assertEqual(updated!.id, created.id);
});

await test('Ex3: update returns null for missing item', async () => {
  interface Task extends Entity { title: string }
  const repo = new InMemoryRepository<Task>();
  const result = await repo.update('999', { title: 'X' });
  assertEqual(result, null);
});

await test('Ex3: delete removes item', async () => {
  interface Task extends Entity { title: string }
  const repo = new InMemoryRepository<Task>();
  const created = await repo.create({ title: 'Delete me' } as Omit<Task, 'id'>);
  const deleted = await repo.delete(created.id);
  assert(deleted);
  assertEqual(await repo.findById(created.id), null);
});

await test('Ex3: delete returns false for missing item', async () => {
  interface Task extends Entity { title: string }
  const repo = new InMemoryRepository<Task>();
  const deleted = await repo.delete('999');
  assert(!deleted);
});

// --- Exercise 4: Interface Segregation ---
await test('Ex4: authenticator handles login/logout', async () => {
  const auth = new InMemoryAuthenticator();
  auth.addUser('alice@test.com', 'secret');
  const { token } = await auth.login('alice@test.com', 'secret');
  assert(auth.isLoggedIn(token));
  await auth.logout(token);
  assert(!auth.isLoggedIn(token));
});

await test('Ex4: authenticator rejects wrong password', async () => {
  const auth = new InMemoryAuthenticator();
  auth.addUser('bob@test.com', 'correct');
  let threw = false;
  try { await auth.login('bob@test.com', 'wrong'); } catch { threw = true; }
  assert(threw);
});

await test('Ex4: profile manager CRUD', async () => {
  const pm = new InMemoryProfileManager();
  pm.setProfile('u1', { name: 'Alice', email: 'alice@test.com' });
  const profile = await pm.getProfile('u1');
  assertEqual(profile.name, 'Alice');
  await pm.updateProfile('u1', { name: 'Alice Updated' });
  const updated = await pm.getProfile('u1');
  assertEqual(updated.name, 'Alice Updated');
  assertEqual(updated.email, 'alice@test.com');
});

await test('Ex4: preferences isolation per user', async () => {
  const prefs = new InMemoryPreferences();
  await prefs.setPreference('u1', 'theme', 'dark');
  await prefs.setPreference('u2', 'theme', 'light');
  const u1Prefs = await prefs.getPreferences('u1');
  const u2Prefs = await prefs.getPreferences('u2');
  assertEqual(u1Prefs['theme'], 'dark');
  assertEqual(u2Prefs['theme'], 'light');
});

// --- Exercise 5: Ports & Adapters ---
await test('Ex5: FakePaymentAdapter handles charge', async () => {
  const adapter = new FakePaymentAdapter();
  const result = await adapter.charge(100, 'EUR', 'tok_123');
  assertEqual(result.status, 'charged');
  assert(result.transactionId.startsWith('tx-'));
});

await test('Ex5: FakePaymentAdapter handles refund', async () => {
  const adapter = new FakePaymentAdapter();
  const { transactionId } = await adapter.charge(100, 'EUR', 'tok_123');
  const refund = await adapter.refund(transactionId);
  assertEqual(refund.status, 'refunded');
  assertEqual(adapter.getTransaction(transactionId)?.status, 'refunded');
});

await test('Ex5: FakePaymentAdapter simulates failure', async () => {
  const adapter = new FakePaymentAdapter();
  adapter.shouldFail = true;
  let threw = false;
  try { await adapter.charge(100, 'EUR', 'tok_123'); } catch { threw = true; }
  assert(threw);
});

await test('Ex5: PaymentService validates amount', async () => {
  const adapter = new FakePaymentAdapter();
  const service = new PaymentService(adapter);
  let threw = false;
  try { await service.processPayment(0, 'EUR', 'tok_123'); } catch { threw = true; }
  assert(threw);
});

await test('Ex5: PaymentService delegates to port', async () => {
  const adapter = new FakePaymentAdapter();
  const service = new PaymentService(adapter);
  const result = await service.processPayment(50, 'USD', 'tok_456');
  assertEqual(result.status, 'charged');
});

// --- Exercise 6: Refactored FileProcessor ---
await test('Ex6: parseLines filters empty lines', () => {
  const lines = parseLines('hello\n\nworld\n  \nfoo');
  assertDeepEqual(lines, ['hello', 'world', 'foo']);
});

await test('Ex6: transformLines uppercases', () => {
  assertDeepEqual(transformLines(['hello', 'world']), ['HELLO', 'WORLD']);
});

await test('Ex6: formatOutput joins with newlines', () => {
  assertEqual(formatOutput(['A', 'B', 'C']), 'A\nB\nC');
});

await test('Ex6: FileProcessor with InMemoryFileSystem', async () => {
  const fs = new InMemoryFileSystem();
  fs.addFile('input.txt', 'hello\nworld\n\nfoo');

  const processor = new FileProcessor(fs);
  const result = await processor.process('input.txt', 'output.txt');

  assertEqual(result.linesProcessed, 3);
  assertEqual(fs.getFile('output.txt'), 'HELLO\nWORLD\nFOO');
});

await test('Ex6: FileProcessor handles missing file', async () => {
  const fs = new InMemoryFileSystem();
  const processor = new FileProcessor(fs);
  let threw = false;
  try { await processor.process('missing.txt', 'out.txt'); } catch { threw = true; }
  assert(threw);
});

await test('Ex6: FileProcessor with empty file', async () => {
  const fs = new InMemoryFileSystem();
  fs.addFile('empty.txt', '');

  const processor = new FileProcessor(fs);
  const result = await processor.process('empty.txt', 'output.txt');

  assertEqual(result.linesProcessed, 0);
  assertEqual(fs.getFile('output.txt'), '');
});

run();
