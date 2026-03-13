// =============================================================================
// Lab 09 — Tests d'integration (Exercice)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, assertDeepEqual, run } =
  createTestRunner('Lab 09 — Tests d\'integration');

// =============================================================================
// Exercice 1 : createInMemoryDB — CRUD en memoire
// Implementez une base de donnees en memoire avec auto-increment d'ID.
// =============================================================================

// TODO: Implementez createInMemoryDB
// interface Entity { id: number; [key: string]: unknown; }
// function createInMemoryDB<T extends Entity>(): {
//   create: (data: Omit<T, 'id'>) => T;
//   findById: (id: number) => T | undefined;
//   findAll: () => T[];
//   update: (id: number, data: Partial<Omit<T, 'id'>>) => T | undefined;
//   delete: (id: number) => boolean;
//   clear: () => void;
//   count: () => number;
// }

// =============================================================================
// Exercice 2 : UserService + InMemoryDB
// Testez un service utilisateur integre avec la DB en memoire.
// =============================================================================

// TODO: Implementez createUserService
// interface User { id: number; name: string; email: string; role: string; }
// function createUserService(db: ReturnType<typeof createInMemoryDB<User>>): {
//   register: (name: string, email: string) => User;
//   findByEmail: (email: string) => User | undefined;
//   promote: (id: number) => User | undefined;
//   remove: (id: number) => boolean;
// }

// =============================================================================
// Exercice 3 : Transaction rollback
// Implementez un wrapper de transaction qui permet de rollback les changements.
// =============================================================================

// TODO: Implementez createTransaction
// function createTransaction<T extends Entity>(db: ReturnType<typeof createInMemoryDB<T>>): {
//   begin: () => void;
//   commit: () => void;
//   rollback: () => void;
// }

// =============================================================================
// Exercice 4 : Flux d'evenements
// OrderService cree une commande et emet un evenement.
// NotificationService ecoute et enregistre les notifications.
// =============================================================================

// TODO: Implementez createEventBus, createOrderService, createNotificationService

// =============================================================================
// Exercice 5 : Fixture factory
// Creez des factories qui generent des donnees de test avec des valeurs par defaut.
// =============================================================================

// TODO: Implementez createUserFactory, createOrderFactory

// =============================================================================
// Exercice 6 : Integration complete
// API Router + Service + DB + EventBus
// =============================================================================

// TODO: Implementez createApp

// =============================================================================
// Tests
// =============================================================================

/* Decommentez les tests au fur et a mesure

await test('Ex1: InMemoryDB create et findById', () => {
  const db = createInMemoryDB<{ id: number; name: string }>();
  const item = db.create({ name: 'Alice' });
  assertEqual(item.id, 1);
  assertEqual(item.name, 'Alice');
  const found = db.findById(1);
  assertEqual(found!.name, 'Alice');
});

await test('Ex1: InMemoryDB findAll', () => {
  const db = createInMemoryDB<{ id: number; name: string }>();
  db.create({ name: 'Alice' });
  db.create({ name: 'Bob' });
  assertEqual(db.findAll().length, 2);
  assertEqual(db.count(), 2);
});

await test('Ex1: InMemoryDB update et delete', () => {
  const db = createInMemoryDB<{ id: number; name: string }>();
  db.create({ name: 'Alice' });
  const updated = db.update(1, { name: 'Alicia' });
  assertEqual(updated!.name, 'Alicia');
  const deleted = db.delete(1);
  assertEqual(deleted, true);
  assertEqual(db.count(), 0);
});

await test('Ex2: UserService register et findByEmail', () => {
  const db = createInMemoryDB<User>();
  const service = createUserService(db);
  const user = service.register('Alice', 'alice@test.com');
  assertEqual(user.name, 'Alice');
  assertEqual(user.role, 'user');
  const found = service.findByEmail('alice@test.com');
  assertEqual(found!.name, 'Alice');
});

await test('Ex2: UserService promote change le role', () => {
  const db = createInMemoryDB<User>();
  const service = createUserService(db);
  const user = service.register('Alice', 'alice@test.com');
  const promoted = service.promote(user.id);
  assertEqual(promoted!.role, 'admin');
});

await test('Ex2: UserService remove supprime l\'utilisateur', () => {
  const db = createInMemoryDB<User>();
  const service = createUserService(db);
  const user = service.register('Alice', 'alice@test.com');
  assertEqual(service.remove(user.id), true);
  assertEqual(service.findByEmail('alice@test.com'), undefined);
});

await test('Ex3: transaction rollback restaure l\'etat', () => {
  const db = createInMemoryDB<{ id: number; name: string }>();
  db.create({ name: 'Alice' });
  const tx = createTransaction(db);
  tx.begin();
  db.create({ name: 'Bob' });
  assertEqual(db.count(), 2);
  tx.rollback();
  assertEqual(db.count(), 1);
  assertEqual(db.findAll()[0].name, 'Alice');
});

await test('Ex3: transaction commit conserve les changements', () => {
  const db = createInMemoryDB<{ id: number; name: string }>();
  const tx = createTransaction(db);
  tx.begin();
  db.create({ name: 'Alice' });
  tx.commit();
  assertEqual(db.count(), 1);
});

await test('Ex4: OrderService emet un evenement capte par NotificationService', () => {
  const eventBus = createEventBus();
  const orderDb = createInMemoryDB<{ id: number; product: string; quantity: number; status: string }>();
  const orderService = createOrderService(orderDb, eventBus);
  const notificationService = createNotificationService(eventBus);

  const order = orderService.createOrder('Laptop', 1);
  assertEqual(order.status, 'created');
  assertEqual(notificationService.getNotifications().length, 1);
  assert(notificationService.getNotifications()[0].includes('Laptop'), 'Notification doit mentionner le produit');
});

await test('Ex4: plusieurs commandes generent plusieurs notifications', () => {
  const eventBus = createEventBus();
  const orderDb = createInMemoryDB<{ id: number; product: string; quantity: number; status: string }>();
  const orderService = createOrderService(orderDb, eventBus);
  const notificationService = createNotificationService(eventBus);

  orderService.createOrder('Laptop', 1);
  orderService.createOrder('Phone', 2);
  assertEqual(notificationService.getNotifications().length, 2);
});

await test('Ex5: fixture factory createUser avec defauts', () => {
  const user = createUserFixture();
  assert(user.name.length > 0, 'Doit avoir un nom par defaut');
  assert(user.email.includes('@'), 'Doit avoir un email par defaut');
  assertEqual(user.role, 'user');
});

await test('Ex5: fixture factory createUser avec overrides', () => {
  const user = createUserFixture({ name: 'Bob', role: 'admin' });
  assertEqual(user.name, 'Bob');
  assertEqual(user.role, 'admin');
});

await test('Ex5: fixture factory createOrder avec defauts', () => {
  const order = createOrderFixture();
  assert(order.product.length > 0, 'Doit avoir un produit par defaut');
  assert(order.quantity > 0, 'Doit avoir une quantite > 0');
});

await test('Ex6: integration complete — creation via API', () => {
  const app = createApp();
  const res = app.request('POST', '/api/users', { name: 'Alice', email: 'alice@test.com' });
  assertEqual(res.status, 201);
  assertEqual((res.body as any).name, 'Alice');
});

await test('Ex6: integration complete — lecture via API', () => {
  const app = createApp();
  app.request('POST', '/api/users', { name: 'Alice', email: 'alice@test.com' });
  const res = app.request('GET', '/api/users/1');
  assertEqual(res.status, 200);
  assertEqual((res.body as any).name, 'Alice');
});

await test('Ex6: integration complete — evenement emis apres creation', () => {
  const app = createApp();
  app.request('POST', '/api/users', { name: 'Alice', email: 'alice@test.com' });
  const events = app.getEvents();
  assertEqual(events.length, 1);
  assertEqual(events[0].type, 'user:created');
});

*/

run();
