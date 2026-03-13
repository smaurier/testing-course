// =============================================================================
// Lab 18 — Projet Final : Integration Complete (solution)
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
  const unit: string[] = [];
  const integration: string[] = [];
  const e2e: string[] = [];

  for (const mod of modules) {
    unit.push(`${mod}.validation`, `${mod}.creation`, `${mod}.update`, `${mod}.deletion`);
    integration.push(`${mod}.db-integration`, `${mod}.service-integration`);
    e2e.push(`${mod}.full-scenario`);
  }

  const total = unit.length + integration.length + e2e.length;
  return {
    unit,
    integration,
    e2e,
    distribution: {
      unit: Math.round((unit.length / total) * 100),
      integration: Math.round((integration.length / total) * 100),
      e2e: Math.round((e2e.length / total) * 100),
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 2 — TaskService (CRUD + validation)
// -----------------------------------------------------------------------------

let _taskId = 0;

export function createTaskService() {
  const tasks = new Map<string, Task>();

  return {
    create(title: string, description: string): Task {
      if (!title || title.trim().length === 0) {
        throw new Error('Task title is required');
      }
      const now = Date.now();
      const task: Task = {
        id: `task-${++_taskId}`,
        title: title.trim(),
        description,
        status: 'todo',
        createdAt: now,
        updatedAt: now,
      };
      tasks.set(task.id, task);
      return { ...task };
    },

    getById(id: string): Task | undefined {
      const task = tasks.get(id);
      return task ? { ...task } : undefined;
    },

    getAll(): Task[] {
      return [...tasks.values()].map(t => ({ ...t }));
    },

    update(id: string, changes: Partial<Pick<Task, 'title' | 'description' | 'status'>>): Task {
      const task = tasks.get(id);
      if (!task) throw new Error(`Task not found: ${id}`);
      Object.assign(task, changes, { updatedAt: Date.now() });
      return { ...task };
    },

    delete(id: string): void {
      if (!tasks.has(id)) throw new Error(`Task not found: ${id}`);
      tasks.delete(id);
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 3 — InMemoryDB + Integration
// -----------------------------------------------------------------------------

export function createInMemoryDB<T extends { id: string }>() {
  const store = new Map<string, T>();

  return {
    insert(item: T): void {
      store.set(item.id, { ...item });
    },

    findById(id: string): T | undefined {
      const item = store.get(id);
      return item ? { ...item } : undefined;
    },

    findAll(): T[] {
      return [...store.values()].map(item => ({ ...item }));
    },

    update(id: string, changes: Partial<T>): void {
      const item = store.get(id);
      if (!item) throw new Error(`Item not found: ${id}`);
      Object.assign(item, changes);
      store.set(id, { ...item });
    },

    remove(id: string): void {
      store.delete(id);
    },

    count(): number {
      return store.size;
    },

    clear(): void {
      store.clear();
    },
  };
}

export function createTaskServiceWithDB(db: ReturnType<typeof createInMemoryDB<Task>>) {
  return {
    create(title: string, description: string): Task {
      if (!title || title.trim().length === 0) {
        throw new Error('Task title is required');
      }
      const now = Date.now();
      const task: Task = {
        id: `task-${++_taskId}`,
        title: title.trim(),
        description,
        status: 'todo',
        createdAt: now,
        updatedAt: now,
      };
      db.insert(task);
      return { ...task };
    },

    getById(id: string): Task | undefined {
      return db.findById(id);
    },

    getAll(): Task[] {
      return db.findAll();
    },

    update(id: string, changes: Partial<Pick<Task, 'title' | 'description' | 'status'>>): Task {
      const existing = db.findById(id);
      if (!existing) throw new Error(`Task not found: ${id}`);
      const updated = { ...changes, updatedAt: Date.now() };
      db.update(id, updated as Partial<Task>);
      return db.findById(id)!;
    },

    delete(id: string): void {
      const existing = db.findById(id);
      if (!existing) throw new Error(`Task not found: ${id}`);
      db.remove(id);
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 4 — Mock API handlers
// -----------------------------------------------------------------------------

export function createMockAPIHandlers() {
  const service = createTaskService();

  return {
    handle(method: string, path: string, body?: Record<string, unknown>): MockResponse {
      // GET /tasks
      if (method === 'GET' && path === '/tasks') {
        return { status: 200, body: service.getAll() };
      }

      // GET /tasks/:id
      const getMatch = path.match(/^\/tasks\/(.+)$/);
      if (method === 'GET' && getMatch) {
        const task = service.getById(getMatch[1]);
        if (!task) return { status: 404, body: { error: 'Not found' } };
        return { status: 200, body: task };
      }

      // POST /tasks
      if (method === 'POST' && path === '/tasks' && body) {
        try {
          const task = service.create(body.title as string, body.description as string);
          return { status: 201, body: task };
        } catch (err) {
          return { status: 400, body: { error: err instanceof Error ? err.message : String(err) } };
        }
      }

      // PUT /tasks/:id
      const putMatch = path.match(/^\/tasks\/(.+)$/);
      if (method === 'PUT' && putMatch && body) {
        try {
          const task = service.update(putMatch[1], body as Partial<Pick<Task, 'title' | 'description' | 'status'>>);
          return { status: 200, body: task };
        } catch (err) {
          return { status: 404, body: { error: err instanceof Error ? err.message : String(err) } };
        }
      }

      // DELETE /tasks/:id
      const delMatch = path.match(/^\/tasks\/(.+)$/);
      if (method === 'DELETE' && delMatch) {
        try {
          service.delete(delMatch[1]);
          return { status: 204, body: null };
        } catch (err) {
          return { status: 404, body: { error: err instanceof Error ? err.message : String(err) } };
        }
      }

      return { status: 405, body: { error: 'Method not allowed' } };
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 5 — E2E scenario (simulated)
// -----------------------------------------------------------------------------

export async function e2eScenario(api: ReturnType<typeof createMockAPIHandlers>): Promise<{
  steps: Array<{ action: string; status: number; success: boolean }>;
  passed: boolean;
}> {
  const steps: Array<{ action: string; status: number; success: boolean }> = [];

  // 1. Create task
  const createRes = api.handle('POST', '/tasks', { title: 'E2E Task', description: 'Testing e2e' });
  steps.push({ action: 'POST /tasks', status: createRes.status, success: createRes.status === 201 });
  const taskId = (createRes.body as Task).id;

  // 2. Verify creation
  const getRes = api.handle('GET', `/tasks/${taskId}`);
  steps.push({ action: `GET /tasks/${taskId}`, status: getRes.status, success: getRes.status === 200 });

  // 3. Edit title
  const editRes = api.handle('PUT', `/tasks/${taskId}`, { title: 'Updated E2E Task' });
  steps.push({ action: `PUT /tasks/${taskId} (edit)`, status: editRes.status, success: editRes.status === 200 });

  // 4. Mark as done
  const doneRes = api.handle('PUT', `/tasks/${taskId}`, { status: 'done' });
  steps.push({ action: `PUT /tasks/${taskId} (complete)`, status: doneRes.status, success: doneRes.status === 200 });

  // 5. Delete
  const deleteRes = api.handle('DELETE', `/tasks/${taskId}`);
  steps.push({ action: `DELETE /tasks/${taskId}`, status: deleteRes.status, success: deleteRes.status === 204 });

  // 6. Verify deletion
  const verifyRes = api.handle('GET', `/tasks/${taskId}`);
  steps.push({ action: `GET /tasks/${taskId} (verify deleted)`, status: verifyRes.status, success: verifyRes.status === 404 });

  return {
    steps,
    passed: steps.every(s => s.success),
  };
}

// -----------------------------------------------------------------------------
// Exercice 6 — Full test report
// -----------------------------------------------------------------------------

export function createTestReportAggregator() {
  const suites: Array<{ name: string; passed: number; failed: number; total: number }> = [];
  let coverage = 0;
  let duration = 0;

  return {
    addSuite(name: string, passed: number, failed: number): void {
      suites.push({ name, passed, failed, total: passed + failed });
    },

    setCoverage(percentage: number): void {
      coverage = percentage;
    },

    setDuration(ms: number): void {
      duration = ms;
    },

    generate(): TestReport {
      const totalPassed = suites.reduce((sum, s) => sum + s.passed, 0);
      const totalFailed = suites.reduce((sum, s) => sum + s.failed, 0);

      return {
        suites: [...suites],
        totalPassed,
        totalFailed,
        totalTests: totalPassed + totalFailed,
        coverage,
        duration,
        status: totalFailed > 0 ? 'failed' : 'passed',
      };
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

async function main() {
  const { test, assert, assertEqual, assertThrows, run } = createTestRunner('Lab 18 — Projet Final');

  // --- Exercice 1 ---
  await test('Ex1: createTestStrategy generates test plan', () => {
    const plan = createTestStrategy(['task', 'user']);
    assertEqual(plan.unit.length, 8);
    assertEqual(plan.integration.length, 4);
    assertEqual(plan.e2e.length, 2);
    assert(plan.unit.includes('task.validation'));
    assert(plan.integration.includes('user.db-integration'));
    assert(plan.e2e.includes('task.full-scenario'));
  });

  await test('Ex1: distribution follows pyramid', () => {
    const plan = createTestStrategy(['task']);
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
    const createRes = api.handle('POST', '/tasks', { title: 'API Task', description: 'via API' });
    assertEqual(createRes.status, 201);
    const created = createRes.body as Task;
    assert(created.id.length > 0);

    const getRes = api.handle('GET', `/tasks/${created.id}`);
    assertEqual(getRes.status, 200);
    assertEqual((getRes.body as Task).title, 'API Task');

    const listRes = api.handle('GET', '/tasks');
    assertEqual(listRes.status, 200);
    assertEqual((listRes.body as Task[]).length, 1);

    const updateRes = api.handle('PUT', `/tasks/${created.id}`, { title: 'Updated' });
    assertEqual(updateRes.status, 200);

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
    assertEqual(report.status, 'failed');
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
