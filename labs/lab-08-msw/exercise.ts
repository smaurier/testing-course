// =============================================================================
// Lab 08 — MSW patterns (Exercice)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, assertDeepEqual, run } =
  createTestRunner('Lab 08 — MSW patterns');

// =============================================================================
// Exercice 1 : createMockServer — Intercepteur fetch simule
// Implementez un mock server qui enregistre des handlers URL -> reponse.
// Le server remplace temporairement une fonction fetchFn.
// =============================================================================

// TODO: Implementez les types et createMockServer
// type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
// interface MockResponse { status: number; body: unknown; headers?: Record<string, string>; }
// interface MockHandler { method: HttpMethod; url: string; handler: (req: { body?: unknown; params?: Record<string, string> }) => MockResponse; }
// interface MockServer {
//   addHandler: (method: HttpMethod, url: string, handler: MockHandler['handler']) => void;
//   fetch: (url: string, options?: { method?: HttpMethod; body?: string; headers?: Record<string, string> }) => MockResponse;
//   reset: () => void;
// }
// function createMockServer(): MockServer { ... }

// =============================================================================
// Exercice 2 : Test GET /api/users — Succes et erreur
// =============================================================================

// TODO: Utilisez createMockServer pour tester des requetes GET

// =============================================================================
// Exercice 3 : Test POST /api/users — Validation du body
// =============================================================================

// TODO: Handler POST qui valide le body (name requis, email requis)

// =============================================================================
// Exercice 4 : Handlers dynamiques — Path params (/api/users/:id)
// =============================================================================

// TODO: Ajoutez le support des path params dans createMockServer

// =============================================================================
// Exercice 5 : Simulation d'erreurs — Reseau, timeout, 500
// =============================================================================

// TODO: Handlers qui simulent differents types d'erreurs

// =============================================================================
// Exercice 6 : Test CRUD complet
// =============================================================================

// TODO: Cycle create → read → update → delete

// =============================================================================
// Tests
// =============================================================================

/* Decommentez les tests au fur et a mesure

await test('Ex1: createMockServer retourne un serveur', () => {
  const server = createMockServer();
  assert(server !== null, 'Le serveur ne doit pas etre null');
  assert(typeof server.fetch === 'function', 'fetch doit etre une fonction');
});

await test('Ex1: handler GET basique', () => {
  const server = createMockServer();
  server.addHandler('GET', '/api/health', () => ({ status: 200, body: { status: 'ok' } }));
  const res = server.fetch('/api/health');
  assertEqual(res.status, 200);
  assertDeepEqual(res.body, { status: 'ok' });
});

await test('Ex1: route non trouvee retourne 404', () => {
  const server = createMockServer();
  const res = server.fetch('/api/unknown');
  assertEqual(res.status, 404);
});

await test('Ex2: GET /api/users retourne la liste', () => {
  const server = createMockServer();
  const users = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
  server.addHandler('GET', '/api/users', () => ({ status: 200, body: users }));
  const res = server.fetch('/api/users');
  assertEqual(res.status, 200);
  assertEqual((res.body as any[]).length, 2);
});

await test('Ex2: GET /api/users avec handler erreur', () => {
  const server = createMockServer();
  server.addHandler('GET', '/api/users', () => ({ status: 500, body: { error: 'DB connection failed' } }));
  const res = server.fetch('/api/users');
  assertEqual(res.status, 500);
});

await test('Ex3: POST /api/users valide le body', () => {
  const server = createMockServer();
  server.addHandler('POST', '/api/users', (req) => {
    const body = req.body as { name?: string; email?: string };
    if (!body?.name) return { status: 400, body: { error: 'name is required' } };
    if (!body?.email) return { status: 400, body: { error: 'email is required' } };
    return { status: 201, body: { id: 1, ...body } };
  });
  const res = server.fetch('/api/users', { method: 'POST', body: JSON.stringify({ name: 'Alice', email: 'alice@test.com' }) });
  assertEqual(res.status, 201);
});

await test('Ex3: POST /api/users rejette body invalide', () => {
  const server = createMockServer();
  server.addHandler('POST', '/api/users', (req) => {
    const body = req.body as { name?: string };
    if (!body?.name) return { status: 400, body: { error: 'name is required' } };
    return { status: 201, body: { id: 1, ...body } };
  });
  const res = server.fetch('/api/users', { method: 'POST', body: JSON.stringify({}) });
  assertEqual(res.status, 400);
});

await test('Ex4: path params /api/users/:id', () => {
  const server = createMockServer();
  const users = new Map([[1, { id: 1, name: 'Alice' }], [2, { id: 2, name: 'Bob' }]]);
  server.addHandler('GET', '/api/users/:id', (req) => {
    const id = Number(req.params!['id']);
    const user = users.get(id);
    if (!user) return { status: 404, body: { error: 'User not found' } };
    return { status: 200, body: user };
  });
  const res1 = server.fetch('/api/users/1');
  assertEqual(res1.status, 200);
  assertEqual((res1.body as any).name, 'Alice');
  const res2 = server.fetch('/api/users/99');
  assertEqual(res2.status, 404);
});

await test('Ex4: path params multiples /api/users/:userId/posts/:postId', () => {
  const server = createMockServer();
  server.addHandler('GET', '/api/users/:userId/posts/:postId', (req) => {
    return { status: 200, body: { userId: req.params!['userId'], postId: req.params!['postId'] } };
  });
  const res = server.fetch('/api/users/5/posts/42');
  assertDeepEqual(res.body, { userId: '5', postId: '42' });
});

await test('Ex5: simulation erreur serveur 500', () => {
  const server = createMockServer();
  server.addHandler('GET', '/api/crash', () => ({ status: 500, body: { error: 'Internal Server Error' } }));
  const res = server.fetch('/api/crash');
  assertEqual(res.status, 500);
});

await test('Ex5: simulation erreur reseau (status 0)', () => {
  const server = createMockServer();
  server.addHandler('GET', '/api/timeout', () => ({ status: 0, body: null }));
  const res = server.fetch('/api/timeout');
  assertEqual(res.status, 0);
  assertEqual(res.body, null);
});

await test('Ex6: CRUD complet — create, read, update, delete', () => {
  const server = createMockServer();
  const db = new Map<number, { id: number; name: string; email: string }>();
  let nextId = 1;

  server.addHandler('POST', '/api/users', (req) => {
    const body = req.body as { name: string; email: string };
    const user = { id: nextId++, ...body };
    db.set(user.id, user);
    return { status: 201, body: user };
  });

  server.addHandler('GET', '/api/users/:id', (req) => {
    const user = db.get(Number(req.params!['id']));
    return user ? { status: 200, body: user } : { status: 404, body: { error: 'Not found' } };
  });

  server.addHandler('PUT', '/api/users/:id', (req) => {
    const id = Number(req.params!['id']);
    const existing = db.get(id);
    if (!existing) return { status: 404, body: { error: 'Not found' } };
    const body = req.body as { name?: string; email?: string };
    const updated = { ...existing, ...body };
    db.set(id, updated);
    return { status: 200, body: updated };
  });

  server.addHandler('DELETE', '/api/users/:id', (req) => {
    const id = Number(req.params!['id']);
    if (!db.has(id)) return { status: 404, body: { error: 'Not found' } };
    db.delete(id);
    return { status: 204, body: null };
  });

  // Create
  const created = server.fetch('/api/users', { method: 'POST', body: JSON.stringify({ name: 'Alice', email: 'alice@test.com' }) });
  assertEqual(created.status, 201);
  const userId = (created.body as any).id;

  // Read
  const read = server.fetch(`/api/users/${userId}`);
  assertEqual(read.status, 200);
  assertEqual((read.body as any).name, 'Alice');

  // Update
  const updated = server.fetch(`/api/users/${userId}`, { method: 'PUT', body: JSON.stringify({ name: 'Alice Updated' }) });
  assertEqual(updated.status, 200);
  assertEqual((updated.body as any).name, 'Alice Updated');

  // Delete
  const deleted = server.fetch(`/api/users/${userId}`, { method: 'DELETE' });
  assertEqual(deleted.status, 204);

  // Verify deleted
  const notFound = server.fetch(`/api/users/${userId}`);
  assertEqual(notFound.status, 404);
});

*/

run();
