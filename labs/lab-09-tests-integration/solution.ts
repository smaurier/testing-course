// =============================================================================
// Lab 09 — Tests d'integration (Solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, assertDeepEqual, run } =
  createTestRunner('Lab 09 — Tests d\'integration');

// =============================================================================
// Exercice 1 : createInMemoryDB — CRUD en memoire
// =============================================================================

interface Entity {
  id: number;
  [key: string]: unknown;
}

function createInMemoryDB<T extends Entity>() {
  let nextId = 1;
  const store = new Map<number, T>();

  function create(data: Omit<T, 'id'>): T {
    const id = nextId++;
    const entity = { ...data, id } as T;
    store.set(id, entity);
    return entity;
  }

  function findById(id: number): T | undefined {
    return store.get(id);
  }

  function findAll(): T[] {
    return [...store.values()];
  }

  function update(id: number, data: Partial<Omit<T, 'id'>>): T | undefined {
    const existing = store.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    store.set(id, updated);
    return updated;
  }

  function remove(id: number): boolean {
    return store.delete(id);
  }

  function clear(): void {
    store.clear();
    nextId = 1;
  }

  function count(): number {
    return store.size;
  }

  // Snapshot support for transactions
  function snapshot(): { entries: [number, T][]; nextId: number } {
    return {
      entries: [...store.entries()].map(([k, v]) => [k, { ...v }]),
      nextId,
    };
  }

  function restore(snap: { entries: [number, T][]; nextId: number }): void {
    store.clear();
    snap.entries.forEach(([k, v]) => store.set(k, v));
    nextId = snap.nextId;
  }

  return { create, findById, findAll, update, delete: remove, clear, count, snapshot, restore };
}

// =============================================================================
// Exercice 2 : UserService + InMemoryDB
// =============================================================================

interface User extends Entity {
  id: number;
  name: string;
  email: string;
  role: string;
}

function createUserService(db: ReturnType<typeof createInMemoryDB<User>>) {
  function register(name: string, email: string): User {
    return db.create({ name, email, role: 'user' } as Omit<User, 'id'>);
  }

  function findByEmail(email: string): User | undefined {
    return db.findAll().find(u => u.email === email);
  }

  function promote(id: number): User | undefined {
    return db.update(id, { role: 'admin' });
  }

  function remove(id: number): boolean {
    return db.delete(id);
  }

  return { register, findByEmail, promote, remove };
}

// =============================================================================
// Exercice 3 : Transaction rollback
// =============================================================================

function createTransaction<T extends Entity>(db: ReturnType<typeof createInMemoryDB<T>>) {
  let snap: { entries: [number, T][]; nextId: number } | null = null;

  function begin(): void {
    snap = db.snapshot();
  }

  function commit(): void {
    snap = null;
  }

  function rollback(): void {
    if (snap) {
      db.restore(snap);
      snap = null;
    }
  }

  return { begin, commit, rollback };
}

// =============================================================================
// Exercice 4 : Flux d'evenements
// =============================================================================

interface AppEvent {
  type: string;
  payload: unknown;
}

function createEventBus() {
  const listeners = new Map<string, ((payload: unknown) => void)[]>();
  const history: AppEvent[] = [];

  function emit(type: string, payload: unknown): void {
    history.push({ type, payload });
    const handlers = listeners.get(type) || [];
    handlers.forEach(fn => fn(payload));
  }

  function on(type: string, handler: (payload: unknown) => void): void {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type)!.push(handler);
  }

  function getHistory(): AppEvent[] {
    return [...history];
  }

  function clear(): void {
    listeners.clear();
    history.length = 0;
  }

  return { emit, on, getHistory, clear };
}

function createOrderService(
  db: ReturnType<typeof createInMemoryDB<{ id: number; product: string; quantity: number; status: string }>>,
  eventBus: ReturnType<typeof createEventBus>
) {
  function createOrder(product: string, quantity: number) {
    const order = db.create({ product, quantity, status: 'created' } as Omit<{ id: number; product: string; quantity: number; status: string }, 'id'>);
    eventBus.emit('order:created', { orderId: order.id, product, quantity });
    return order;
  }

  return { createOrder };
}

function createNotificationService(eventBus: ReturnType<typeof createEventBus>) {
  const notifications: string[] = [];

  eventBus.on('order:created', (payload) => {
    const { product, quantity } = payload as { product: string; quantity: number };
    notifications.push(`Nouvelle commande : ${quantity}x ${product}`);
  });

  function getNotifications(): string[] {
    return [...notifications];
  }

  return { getNotifications };
}

// =============================================================================
// Exercice 5 : Fixture factory
// =============================================================================

let fixtureCounter = 0;

function createUserFixture(overrides?: Partial<Omit<User, 'id'>>): Omit<User, 'id'> {
  fixtureCounter++;
  return {
    name: `User_${fixtureCounter}`,
    email: `user${fixtureCounter}@test.com`,
    role: 'user',
    ...overrides,
  };
}

function createOrderFixture(overrides?: Partial<{ product: string; quantity: number; status: string }>) {
  fixtureCounter++;
  return {
    product: `Product_${fixtureCounter}`,
    quantity: 1,
    status: 'pending',
    ...overrides,
  };
}

// =============================================================================
// Exercice 6 : Integration complete — API Router + Service + DB + EventBus
// =============================================================================

function createApp() {
  const db = createInMemoryDB<User>();
  const eventBus = createEventBus();
  const userService = createUserService(db);

  function request(method: string, url: string, body?: unknown): { status: number; body: unknown } {
    // POST /api/users
    if (method === 'POST' && url === '/api/users') {
      const { name, email } = body as { name: string; email: string };
      const user = userService.register(name, email);
      eventBus.emit('user:created', { userId: user.id, name, email });
      return { status: 201, body: user };
    }

    // GET /api/users/:id
    const getMatch = url.match(/^\/api\/users\/(\d+)$/);
    if (method === 'GET' && getMatch) {
      const id = Number(getMatch[1]);
      const user = db.findById(id);
      if (!user) return { status: 404, body: { error: 'Not found' } };
      return { status: 200, body: user };
    }

    // DELETE /api/users/:id
    const delMatch = url.match(/^\/api\/users\/(\d+)$/);
    if (method === 'DELETE' && delMatch) {
      const id = Number(delMatch[1]);
      if (!db.findById(id)) return { status: 404, body: { error: 'Not found' } };
      db.delete(id);
      eventBus.emit('user:deleted', { userId: id });
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'Not found' } };
  }

  function getEvents(): AppEvent[] {
    return eventBus.getHistory();
  }

  return { request, getEvents };
}

// =============================================================================
// Tests
// =============================================================================

// --- Exercice 1 ---
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

// --- Exercice 2 ---
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

// --- Exercice 3 ---
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

// --- Exercice 4 ---
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

// --- Exercice 5 ---
await test('Ex5: fixture factory createUser avec defauts', () => {
  fixtureCounter = 0;
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
  fixtureCounter = 0;
  const order = createOrderFixture();
  assert(order.product.length > 0, 'Doit avoir un produit par defaut');
  assert(order.quantity > 0, 'Doit avoir une quantite > 0');
});

// --- Exercice 6 ---
await test('Ex6: integration complete — creation via API', () => {
  const app = createApp();
  const res = app.request('POST', '/api/users', { name: 'Alice', email: 'alice@test.com' });
  assertEqual(res.status, 201);
  assertEqual((res.body as User).name, 'Alice');
});

await test('Ex6: integration complete — lecture via API', () => {
  const app = createApp();
  app.request('POST', '/api/users', { name: 'Alice', email: 'alice@test.com' });
  const res = app.request('GET', '/api/users/1');
  assertEqual(res.status, 200);
  assertEqual((res.body as User).name, 'Alice');
});

await test('Ex6: integration complete — evenement emis apres creation', () => {
  const app = createApp();
  app.request('POST', '/api/users', { name: 'Alice', email: 'alice@test.com' });
  const events = app.getEvents();
  assertEqual(events.length, 1);
  assertEqual(events[0].type, 'user:created');
});

run();
