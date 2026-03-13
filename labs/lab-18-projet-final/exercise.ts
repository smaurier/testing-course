// =============================================================================
// Lab 18 — Projet Final : Integration Complete (exercise)
// =============================================================================
// Instructions : implementez chaque fonction TODO puis lancez les tests.
// Commande : npx tsx labs/lab-18-projet-final/exercise.ts
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  createdAt: number;
  updatedAt: number;
}

interface TestPlan {
  unit: string[];
  integration: string[];
  e2e: string[];
  distribution: { unit: number; integration: number; e2e: number };
}

interface MockResponse {
  status: number;
  body: unknown;
}

interface TestReport {
  suites: Array<{ name: string; passed: number; failed: number; total: number }>;
  totalPassed: number;
  totalFailed: number;
  totalTests: number;
  coverage: number;
  duration: number;
  status: 'passed' | 'failed';
}

// -----------------------------------------------------------------------------
// Exercice 1 — createTestStrategy (pyramid distribution)
// -----------------------------------------------------------------------------

export function createTestStrategy(modules: string[]): TestPlan {
  // TODO: Generer un plan de test avec :
  // - Pour chaque module, generer des noms de tests unit, integration, e2e
  // - unit: "[module].validation", "[module].creation", "[module].update", "[module].deletion"
  // - integration: "[module].db-integration", "[module].service-integration"
  // - e2e: "[module].full-scenario"
  // - distribution: { unit: 60, integration: 30, e2e: 10 } (pourcentages approximatifs)
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 2 — TaskService (CRUD + validation)
// -----------------------------------------------------------------------------

export function createTaskService() {
  // TODO: Retourner un service avec :
  // - create(title, description): creer une tache (valider titre non vide)
  // - getById(id): retourner une tache ou undefined
  // - getAll(): retourner toutes les taches
  // - update(id, changes): mettre a jour une tache (throw si non trouvee)
  // - delete(id): supprimer une tache (throw si non trouvee)
  // - Chaque tache a un id unique, status='todo', createdAt/updatedAt
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 3 — InMemoryDB + Integration
// -----------------------------------------------------------------------------

export function createInMemoryDB<T extends { id: string }>() {
  // TODO: Retourner un store avec :
  // - insert(item): inserer un element
  // - findById(id): trouver par id
  // - findAll(): retourner tous les elements
  // - update(id, changes): mettre a jour
  // - remove(id): supprimer
  // - count(): nombre d'elements
  // - clear(): vider le store
  throw new Error('Not implemented');
}

export function createTaskServiceWithDB(db: ReturnType<typeof createInMemoryDB<Task>>) {
  // TODO: Meme interface que createTaskService mais utilise le db pour la persistence
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 4 — Mock API handlers
// -----------------------------------------------------------------------------

export function createMockAPIHandlers() {
  // TODO: Retourner un objet avec :
  // - handle(method, path, body?): router la requete et retourner MockResponse
  // - Supporter: GET /tasks, GET /tasks/:id, POST /tasks, PUT /tasks/:id, DELETE /tasks/:id
  // - Utiliser un TaskService interne
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 5 — E2E scenario (simulated)
// -----------------------------------------------------------------------------

export async function e2eScenario(api: ReturnType<typeof createMockAPIHandlers>): Promise<{
  steps: Array<{ action: string; status: number; success: boolean }>;
  passed: boolean;
}> {
  // TODO: Simuler le scenario complet :
  // 1. POST /tasks — creer une tache
  // 2. GET /tasks/:id — verifier la creation
  // 3. PUT /tasks/:id — editer le titre
  // 4. PUT /tasks/:id — marquer comme 'done'
  // 5. DELETE /tasks/:id — supprimer
  // 6. GET /tasks/:id — verifier la suppression (404)
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 6 — Full test report
// -----------------------------------------------------------------------------

export function createTestReportAggregator() {
  // TODO: Retourner un objet avec :
  // - addSuite(name, passed, failed): ajouter les resultats d'une suite
  // - setCoverage(percentage): definir le taux de couverture
  // - setDuration(ms): definir la duree totale
  // - generate(): generer le rapport (TestReport)
  throw new Error('Not implemented');
}

// =============================================================================
// Tests
// =============================================================================

async function main() {
  const { test, assert, assertEqual, assertThrows, assertDeepEqual, run } = createTestRunner('Lab 18 — Projet Final');

  // --- Exercice 1 ---
  await test('Ex1: createTestStrategy generates test plan', () => {
    const plan = createTestStrategy(['task', 'user']);
    assertEqual(plan.unit.length, 8);   // 4 per module
    assertEqual(plan.integration.length, 4); // 2 per module
    assertEqual(plan.e2e.length, 2);    // 1 per module
    assert(plan.unit.includes('task.validation'));
    assert(plan.integration.includes('user.db-integration'));
    assert(plan.e2e.includes('task.full-scenario'));
  });

  await test('Ex1: distribution follows pyramid', () => {
    const plan = createTestStrategy(['task']);
    // 4 unit + 2 integration + 1 e2e = 7 tests
    // unit: ~57%, integration: ~29%, e2e: ~14%
    assert(plan.distribution.unit > plan.distribution.integration);
    assert(plan.distribution.integration > plan.distribution.e2e);
  });

  // --- Exercice 2 ---
  await test('Ex2: TaskService create and getById', () => {
    const service = createTaskService();
    const task = service.create('My Task', 'Description here');
    assertEqual(task.title, 'My Task');
    assertEqual(task.description, 'Description here');
    assertEqual(task.status, 'todo');
    assert(task.id.length > 0);
    const found = service.getById(task.id);
    assertEqual(found?.title, 'My Task');
  });

  await test('Ex2: TaskService validation and update', () => {
    const service = createTaskService();
    assertThrows(() => service.create('', 'no title'), 'title');
    const task = service.create('Valid', 'desc');
    service.update(task.id, { status: 'done' });
    assertEqual(service.getById(task.id)?.status, 'done');
    assertThrows(() => service.update('nonexistent', {}));
  });

  await test('Ex2: TaskService delete and getAll', () => {
    const service = createTaskService();
    service.create('A', 'a');
    const b = service.create('B', 'b');
    assertEqual(service.getAll().length, 2);
    service.delete(b.id);
    assertEqual(service.getAll().length, 1);
    assertThrows(() => service.delete('nonexistent'));
  });

  // --- Exercice 3 ---
  await test('Ex3: InMemoryDB CRUD operations', () => {
    const db = createInMemoryDB<Task>();
    const task: Task = { id: '1', title: 'Test', description: 'd', status: 'todo', createdAt: 0, updatedAt: 0 };
    db.insert(task);
    assertEqual(db.count(), 1);
    assertEqual(db.findById('1')?.title, 'Test');
    db.update('1', { title: 'Updated' });
    assertEqual(db.findById('1')?.title, 'Updated');
    db.remove('1');
    assertEqual(db.count(), 0);
  });

  await test('Ex3: TaskService with DB integration', () => {
    const db = createInMemoryDB<Task>();
    const service = createTaskServiceWithDB(db);
    const task = service.create('Integrated', 'via DB');
    assertEqual(db.count(), 1);
    assertEqual(db.findById(task.id)?.title, 'Integrated');
    service.update(task.id, { status: 'in-progress' });
    assertEqual(db.findById(task.id)?.status, 'in-progress');
  });

  // --- Exercice 4 ---
  await test('Ex4: Mock API handlers — CRUD', () => {
    const api = createMockAPIHandlers();
    // Create
    const createRes = api.handle('POST', '/tasks', { title: 'API Task', description: 'via API' });
    assertEqual(createRes.status, 201);
    const created = createRes.body as Task;
    assert(created.id.length > 0);

    // Read
    const getRes = api.handle('GET', `/tasks/${created.id}`);
    assertEqual(getRes.status, 200);
    assertEqual((getRes.body as Task).title, 'API Task');

    // List
    const listRes = api.handle('GET', '/tasks');
    assertEqual(listRes.status, 200);
    assertEqual((listRes.body as Task[]).length, 1);

    // Update
    const updateRes = api.handle('PUT', `/tasks/${created.id}`, { title: 'Updated' });
    assertEqual(updateRes.status, 200);

    // Delete
    const deleteRes = api.handle('DELETE', `/tasks/${created.id}`);
    assertEqual(deleteRes.status, 204);
  });

  await test('Ex4: Mock API handlers — 404', () => {
    const api = createMockAPIHandlers();
    const res = api.handle('GET', '/tasks/nonexistent');
    assertEqual(res.status, 404);
  });

  // --- Exercice 5 ---
  await test('Ex5: e2e scenario completes all steps', async () => {
    const api = createMockAPIHandlers();
    const result = await e2eScenario(api);
    assertEqual(result.steps.length, 6);
    assertEqual(result.passed, true);
    assert(result.steps.every(s => s.success));
  });

  // --- Exercice 6 ---
  await test('Ex6: test report aggregation', () => {
    const aggregator = createTestReportAggregator();
    aggregator.addSuite('unit', 20, 1);
    aggregator.addSuite('integration', 8, 0);
    aggregator.addSuite('e2e', 3, 1);
    aggregator.setCoverage(85);
    aggregator.setDuration(5000);
    const report = aggregator.generate();
    assertEqual(report.totalPassed, 31);
    assertEqual(report.totalFailed, 2);
    assertEqual(report.totalTests, 33);
    assertEqual(report.coverage, 85);
    assertEqual(report.duration, 5000);
    assertEqual(report.status, 'failed'); // has failures
    assertEqual(report.suites.length, 3);
  });

  await test('Ex6: test report all passing', () => {
    const aggregator = createTestReportAggregator();
    aggregator.addSuite('unit', 10, 0);
    aggregator.addSuite('e2e', 5, 0);
    aggregator.setCoverage(92);
    aggregator.setDuration(3000);
    const report = aggregator.generate();
    assertEqual(report.status, 'passed');
    assertEqual(report.totalTests, 15);
  });

  run();
}

main();
