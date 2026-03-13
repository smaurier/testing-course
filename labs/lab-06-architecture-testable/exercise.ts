// =============================================================================
// Lab 06 — Architecture testable (Exercices)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Injection de dependances
// Le NotificationService original est couple a une implementation concrete.
// Refactorez-le pour accepter ses dependances par injection.
// =============================================================================

// AVANT (couple) :
// class NotificationService {
//   async notify(userId: string, message: string) {
//     const response = await fetch(`/api/users/${userId}`);
//     const user = await response.json();
//     await fetch('/api/emails', { method: 'POST', body: JSON.stringify({ to: user.email, message }) });
//     console.log(`Email sent to ${user.email}`);
//   }
// }

// TODO: Definissez les interfaces et refactorez

interface UserRepository {
  findById(id: string): Promise<{ id: string; email: string; name: string }>;
}

interface EmailSender {
  send(to: string, message: string): Promise<void>;
}

class NotificationService {
  constructor(private _userRepo: UserRepository, private _emailSender: EmailSender) {}
  async notify(_userId: string, _message: string): Promise<void> {
    // TODO: implementez avec les dependances injectees
    throw new Error('Not implemented');
  }
}

// =============================================================================
// Exercise 2: Fonctions pures
// Extrayez les calculs purs du PriceCalculator
// =============================================================================

// TODO: implementez les fonctions pures
function calculateDiscount(_price: number, _discountPercent: number): number {
  throw new Error('Not implemented');
}

function calculateTax(_price: number, _taxRate: number): number {
  throw new Error('Not implemented');
}

function calculateTotal(_price: number, _discount: number, _tax: number): number {
  throw new Error('Not implemented');
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
  // TODO: implementez avec un Map interne
  async findAll(): Promise<T[]> { throw new Error('Not implemented'); }
  async findById(_id: string): Promise<T | null> { throw new Error('Not implemented'); }
  async create(_item: Omit<T, 'id'>): Promise<T> { throw new Error('Not implemented'); }
  async update(_id: string, _item: Partial<T>): Promise<T | null> { throw new Error('Not implemented'); }
  async delete(_id: string): Promise<boolean> { throw new Error('Not implemented'); }
}

// =============================================================================
// Exercise 4: Interface Segregation (ISP)
// Divisez un gros UserService en interfaces focalisees
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

// TODO: implementez chaque interface separement

// =============================================================================
// Exercise 5: Ports & Adapters — PaymentGateway
// =============================================================================

// Port (interface)
interface PaymentPort {
  charge(amount: number, currency: string, cardToken: string): Promise<{ transactionId: string; status: string }>;
  refund(transactionId: string): Promise<{ status: string }>;
}

// TODO: Implementez un FakePaymentAdapter pour les tests

// =============================================================================
// Exercise 6: Refactoring complet — FileProcessor
// =============================================================================

// AVANT (non-testable) :
// class FileProcessor {
//   process(filename: string) {
//     const content = fs.readFileSync(filename, 'utf-8');
//     const lines = content.split('\n').filter(l => l.trim() !== '');
//     const result = lines.map(l => l.toUpperCase()).join('\n');
//     fs.writeFileSync(`${filename}.processed`, result);
//     console.log(`Processed ${lines.length} lines`);
//   }
// }

// TODO: Refactorez avec DI + fonctions pures

// =============================================================================
// Tests (minimal — le fichier solution.ts contient tous les tests)
// =============================================================================

const { test, assert, run } = createTestRunner('Lab 06 — Architecture testable');

await test('Ex1: NotificationService with injected deps', async () => {
  // TODO: testez avec des mocks
  assert(true);
});

await test('Ex2: pure functions are testable', () => {
  // TODO
  assert(true);
});

await test('Ex3: InMemoryRepository CRUD', async () => {
  // TODO
  assert(true);
});

run();
