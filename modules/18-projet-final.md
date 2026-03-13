# Module 18 — Projet final

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 5/5        | 480 min (8h)  | [Lab 18](../labs/lab-18-projet-final/) | [Quiz 18](../quizzes/quiz-18-projet-final.html) |

## Objectifs

- Appliquer l'ensemble des competences acquises dans les modules 01 a 17
- Construire une suite de tests complete pour une application reelle
- Rediger un document de strategie de test
- Livrer 10 deliverables couvrant tous les niveaux de la pyramide de tests
- Demontrer la maitrise des outils (Vitest, Playwright, MSW, k6, Zod, GitHub Actions)

---

## Contexte du projet

### L'application : Task Manager

Une application de gestion de taches avec :

- **Backend** : API REST Express.js + SQLite (via better-sqlite3)
- **Frontend** : application SPA (HTML/CSS/TypeScript, pas de framework)
- **Authentification** : JWT (login/register)
- **Fonctionnalites** : CRUD taches, filtres (statut, priorite, date), assignation, tags

### Architecture

```
task-manager/
├── src/
│   ├── server/
│   │   ├── app.ts                  # Express app factory
│   │   ├── server.ts               # Entrypoint
│   │   ├── db/
│   │   │   ├── database.ts         # SQLite connection
│   │   │   ├── migrations/         # Schema migrations
│   │   │   └── seeds/              # Donnees de test
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT verification
│   │   │   ├── validation.ts       # Zod validation middleware
│   │   │   └── error-handler.ts    # Error handling global
│   │   ├── routes/
│   │   │   ├── auth.routes.ts      # POST /auth/login, POST /auth/register
│   │   │   ├── tasks.routes.ts     # CRUD /api/tasks
│   │   │   └── users.routes.ts     # GET /api/users/me
│   │   ├── services/
│   │   │   ├── auth.service.ts     # Hash, JWT, login logic
│   │   │   ├── task.service.ts     # Task business logic
│   │   │   └── user.service.ts     # User management
│   │   └── schemas/
│   │       ├── task.schema.ts      # Zod schemas
│   │       ├── auth.schema.ts      # Zod schemas
│   │       └── user.schema.ts      # Zod schemas
│   └── client/
│       ├── index.html
│       ├── app.ts                  # Application principale
│       ├── api.ts                  # Client HTTP
│       ├── components/
│       │   ├── task-list.ts        # Liste des taches
│       │   ├── task-form.ts        # Formulaire creation/edition
│       │   ├── task-filters.ts     # Filtres
│       │   ├── login-form.ts       # Formulaire de connexion
│       │   └── header.ts           # Header avec user info
│       ├── services/
│       │   ├── auth.client.ts      # Gestion du token JWT
│       │   └── task.client.ts      # Logique metier client
│       └── utils/
│           ├── date-formatter.ts   # Formatage de dates
│           ├── validators.ts       # Validation cote client
│           └── dom-helpers.ts      # Utilitaires DOM
├── tests/
│   ├── unit/                       # Tests unitaires (Vitest)
│   ├── integration/                # Tests d'integration API (supertest)
│   ├── component/                  # Tests de composants client
│   ├── e2e/                        # Tests E2E (Playwright)
│   ├── performance/                # Tests de charge (k6)
│   ├── contract/                   # Tests de contrat (Zod)
│   └── mocks/                      # MSW handlers
├── .github/workflows/ci.yml       # Pipeline CI
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

### Endpoints API

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/auth/register` | Creer un compte | Non |
| POST | `/auth/login` | Se connecter (retourne JWT) | Non |
| GET | `/api/users/me` | Profil utilisateur | Oui |
| GET | `/api/tasks` | Lister les taches (avec filtres) | Oui |
| GET | `/api/tasks/:id` | Detail d'une tache | Oui |
| POST | `/api/tasks` | Creer une tache | Oui |
| PUT | `/api/tasks/:id` | Modifier une tache | Oui |
| DELETE | `/api/tasks/:id` | Supprimer une tache | Oui |
| PATCH | `/api/tasks/:id/status` | Changer le statut | Oui |

### Modele de donnees

```typescript
// src/server/schemas/task.schema.ts
import { z } from 'zod';

export const TaskStatusSchema = z.enum(['todo', 'in-progress', 'done', 'cancelled']);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const TaskSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  dueDate: z.string().datetime().nullable(),
  tags: z.array(z.string().max(50)).max(10),
  assigneeId: z.number().int().positive().nullable(),
  createdBy: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: TaskPrioritySchema.default('medium'),
  dueDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  assigneeId: z.number().int().positive().nullable().optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export const TaskFilterSchema = z.object({
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  assigneeId: z.coerce.number().int().positive().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type Task = z.infer<typeof TaskSchema>;
export type CreateTask = z.infer<typeof CreateTaskSchema>;
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;
export type TaskFilter = z.infer<typeof TaskFilterSchema>;
```

---

## Les 10 deliverables

### Deliverable 1 : Document de strategie de test

Redigez un document (1-2 pages) decrivant :

```markdown
# Strategie de test — Task Manager

## Pyramide de tests
- Unite : ~60% des tests (services, utils, validators)
- Integration : ~25% des tests (API routes + DB)
- E2E : ~15% des tests (parcours utilisateur critiques)

## Couverture cible
- Global : 80% statements, 75% branches
- Services : 90%+ (logique metier critique)
- Utils : 95%+ (fonctions pures)
- Routes : 80%+ (couvert via integration)

## Outils
- Vitest : unit + integration + composants
- Playwright : E2E + visual regression
- MSW : mocking API cote client
- k6 : performance
- Zod : contract validation
- GitHub Actions : CI/CD

## Environnements
- Local : SQLite in-memory pour les tests
- CI : GitHub Actions Ubuntu, Node 20
- Pas de staging automatise (hors scope)

## Conventions
- Fichiers : `*.test.ts` pour unit, `*.integration.test.ts` pour integration
- Nommage : describe('<Module>') > describe('<methode>') > it('should ...')
- Isolation : chaque test reset la DB (transaction rollback)
- Pas de tests sequentiels (chaque test est independant)
```

### Deliverable 2 : Tests unitaires (80%+ coverage)

```typescript
// tests/unit/services/task.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from '../../../src/server/services/task.service';

describe('TaskService', () => {
  let taskService: TaskService;
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
    };
    taskService = new TaskService(mockDb as any);
  });

  describe('create', () => {
    it('should create a task with default values', () => {
      const mockStmt = {
        run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
      };
      const mockGetStmt = {
        get: vi.fn().mockReturnValue({
          id: 1,
          title: 'Test task',
          status: 'todo',
          priority: 'medium',
          tags: '[]',
          createdBy: 1,
        }),
      };
      mockDb.prepare
        .mockReturnValueOnce(mockStmt)
        .mockReturnValueOnce(mockGetStmt);

      const task = taskService.create(
        { title: 'Test task' },
        1, // userId
      );

      expect(task.id).toBe(1);
      expect(task.title).toBe('Test task');
      expect(task.status).toBe('todo');
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('should reject empty title', () => {
      expect(() =>
        taskService.create({ title: '' }, 1),
      ).toThrow();
    });

    it('should reject title longer than 200 characters', () => {
      expect(() =>
        taskService.create({ title: 'a'.repeat(201) }, 1),
      ).toThrow();
    });
  });

  describe('updateStatus', () => {
    it('should update task status', () => {
      const mockStmt = {
        run: vi.fn().mockReturnValue({ changes: 1 }),
      };
      const mockGetStmt = {
        get: vi.fn().mockReturnValue({
          id: 1,
          title: 'Task',
          status: 'in-progress',
          createdBy: 1,
        }),
      };
      mockDb.prepare
        .mockReturnValueOnce(mockGetStmt) // findById
        .mockReturnValueOnce(mockStmt)     // update
        .mockReturnValueOnce(mockGetStmt); // return updated

      const task = taskService.updateStatus(1, 'in-progress', 1);
      expect(task.status).toBe('in-progress');
    });

    it('should throw if task does not belong to user', () => {
      const mockGetStmt = {
        get: vi.fn().mockReturnValue({
          id: 1,
          title: 'Task',
          status: 'todo',
          createdBy: 2, // Different user
        }),
      };
      mockDb.prepare.mockReturnValueOnce(mockGetStmt);

      expect(() =>
        taskService.updateStatus(1, 'done', 999),
      ).toThrow('Unauthorized');
    });

    it('should throw for invalid status transition', () => {
      const mockGetStmt = {
        get: vi.fn().mockReturnValue({
          id: 1, title: 'Task', status: 'done', createdBy: 1,
        }),
      };
      mockDb.prepare.mockReturnValueOnce(mockGetStmt);

      // "done" -> "todo" n'est pas autorise
      expect(() =>
        taskService.updateStatus(1, 'todo', 1),
      ).toThrow('Invalid status transition');
    });
  });

  describe('list', () => {
    it('should return paginated results', () => {
      const mockCountStmt = {
        get: vi.fn().mockReturnValue({ count: 50 }),
      };
      const mockListStmt = {
        all: vi.fn().mockReturnValue(
          Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            title: `Task ${i + 1}`,
            status: 'todo',
            tags: '[]',
          })),
        ),
      };
      mockDb.prepare
        .mockReturnValueOnce(mockCountStmt)
        .mockReturnValueOnce(mockListStmt);

      const result = taskService.list({ page: 1, limit: 20 }, 1);

      expect(result.items).toHaveLength(20);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(3);
    });

    it('should filter by status', () => {
      const mockCountStmt = { get: vi.fn().mockReturnValue({ count: 5 }) };
      const mockListStmt = { all: vi.fn().mockReturnValue([]) };
      mockDb.prepare
        .mockReturnValueOnce(mockCountStmt)
        .mockReturnValueOnce(mockListStmt);

      taskService.list({ status: 'done', page: 1, limit: 20 }, 1);

      // Verifier que la requete SQL contient le filtre
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('status = ?'),
      );
    });
  });
});

// tests/unit/utils/date-formatter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeDate, formatDueDate, isOverdue } from '../../../src/client/utils/date-formatter';

describe('date-formatter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelativeDate', () => {
    it('should return "just now" for dates less than 1 minute ago', () => {
      const date = new Date('2025-06-15T11:59:30Z');
      expect(formatRelativeDate(date)).toBe('just now');
    });

    it('should return "5 minutes ago"', () => {
      const date = new Date('2025-06-15T11:55:00Z');
      expect(formatRelativeDate(date)).toBe('5 minutes ago');
    });

    it('should return "yesterday"', () => {
      const date = new Date('2025-06-14T12:00:00Z');
      expect(formatRelativeDate(date)).toBe('yesterday');
    });
  });

  describe('isOverdue', () => {
    it('should return true for past due dates', () => {
      expect(isOverdue('2025-06-14T00:00:00Z')).toBe(true);
    });

    it('should return false for future due dates', () => {
      expect(isOverdue('2025-06-16T00:00:00Z')).toBe(false);
    });

    it('should return false for null due date', () => {
      expect(isOverdue(null)).toBe(false);
    });
  });
});

// tests/unit/utils/validators.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, sanitizeInput } from '../../../src/client/utils/validators';

describe('validators', () => {
  describe('validateEmail', () => {
    it.each([
      ['user@example.com', true],
      ['name+tag@domain.co.uk', true],
      ['invalid', false],
      ['@domain.com', false],
      ['user@', false],
      ['', false],
    ])('validateEmail("%s") should return %s', (email, expected) => {
      expect(validateEmail(email)).toBe(expected);
    });
  });

  describe('validatePassword', () => {
    it('should require minimum 8 characters', () => {
      expect(validatePassword('Abc123!')).toEqual({
        valid: false,
        errors: expect.arrayContaining(['Minimum 8 characters']),
      });
    });

    it('should require uppercase, lowercase, number, and special char', () => {
      const result = validatePassword('abcdefgh');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one uppercase letter');
      expect(result.errors).toContain('At least one number');
    });

    it('should accept a strong password', () => {
      expect(validatePassword('Str0ng!Pass')).toEqual({
        valid: true,
        errors: [],
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should strip HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>'))
        .toBe('alert("xss")');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });
  });
});
```

### Deliverable 3 : Tests d'integration API

```typescript
// tests/integration/tasks.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app';
import { initDatabase, resetDatabase } from '../../src/server/db/database';
import type { Express } from 'express';

describe('Tasks API Integration', () => {
  let app: Express;
  let authToken: string;

  beforeAll(async () => {
    const db = initDatabase(':memory:');
    app = createApp(db);

    // Creer un utilisateur et obtenir un token
    await request(app)
      .post('/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'Str0ng!Pass' });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'Str0ng!Pass' });

    authToken = loginRes.body.token;
  });

  beforeEach(() => {
    resetDatabase(); // Transaction rollback
  });

  describe('POST /api/tasks', () => {
    it('should create a task and return 201', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'New task',
          priority: 'high',
          tags: ['feature', 'v2'],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'New task',
        status: 'todo',
        priority: 'high',
        tags: ['feature', 'v2'],
      });
      expect(res.body.id).toBeGreaterThan(0);
    });

    it('should return 400 for missing title', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ priority: 'low' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Unauthorized task' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/tasks', () => {
    it('should list tasks with pagination', async () => {
      // Creer 25 taches
      for (let i = 0; i < 25; i++) {
        await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: `Task ${i}` });
      }

      const res = await request(app)
        .get('/api/tasks?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(10);
      expect(res.body.total).toBe(25);
      expect(res.body.totalPages).toBe(3);
    });

    it('should filter by status', async () => {
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Todo task' });

      const res = await request(app)
        .get('/api/tasks?status=todo')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.body.items.every((t: any) => t.status === 'todo')).toBe(true);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update a task', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Original title' });

      const updateRes = await request(app)
        .put(`/api/tasks/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated title', priority: 'urgent' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.title).toBe('Updated title');
      expect(updateRes.body.priority).toBe('urgent');
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app)
        .put('/api/tasks/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Ghost task' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task and return 204', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'To be deleted' });

      const deleteRes = await request(app)
        .delete(`/api/tasks/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(204);

      // Verifier la suppression
      const getRes = await request(app)
        .get(`/api/tasks/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});
```

### Deliverable 4 : Tests de composants

```typescript
// tests/component/task-list.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskList } from '../../src/client/components/task-list';

describe('TaskList component', () => {
  let dom: JSDOM;
  let container: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
    container = dom.window.document.getElementById('app')!;
  });

  it('should render a list of tasks', () => {
    const tasks = [
      { id: 1, title: 'Task 1', status: 'todo', priority: 'high' },
      { id: 2, title: 'Task 2', status: 'done', priority: 'low' },
    ];

    const taskList = new TaskList(container, dom.window.document);
    taskList.render(tasks);

    const items = container.querySelectorAll('[data-testid="task-item"]');
    expect(items.length).toBe(2);
  });

  it('should display empty state when no tasks', () => {
    const taskList = new TaskList(container, dom.window.document);
    taskList.render([]);

    const emptyState = container.querySelector('[data-testid="empty-state"]');
    expect(emptyState).not.toBeNull();
    expect(emptyState!.textContent).toContain('No tasks');
  });

  it('should highlight overdue tasks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

    const tasks = [
      { id: 1, title: 'Overdue', status: 'todo', dueDate: '2025-06-10T00:00:00Z' },
    ];

    const taskList = new TaskList(container, dom.window.document);
    taskList.render(tasks);

    const item = container.querySelector('[data-testid="task-item"]');
    expect(item!.classList.contains('task--overdue')).toBe(true);

    vi.useRealTimers();
  });

  it('should emit delete event when delete button clicked', () => {
    const onDelete = vi.fn();
    const tasks = [{ id: 1, title: 'Task 1', status: 'todo' }];

    const taskList = new TaskList(container, dom.window.document);
    taskList.onDelete(onDelete);
    taskList.render(tasks);

    const deleteBtn = container.querySelector('[data-testid="delete-task-1"]') as HTMLButtonElement;
    deleteBtn.click();

    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
```

### Deliverable 5 : MSW handlers

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';
import type { Task, CreateTask } from '../../src/server/schemas/task.schema';

let taskIdCounter = 1;
let tasks: Task[] = [];

export function resetMockData(): void {
  taskIdCounter = 1;
  tasks = [
    {
      id: taskIdCounter++,
      title: 'Setup project',
      description: 'Initialize the repository',
      status: 'done',
      priority: 'high',
      dueDate: null,
      tags: ['setup'],
      assigneeId: null,
      createdBy: 1,
      createdAt: '2025-06-01T10:00:00Z',
      updatedAt: '2025-06-01T10:00:00Z',
    },
    {
      id: taskIdCounter++,
      title: 'Write tests',
      description: 'Add unit and integration tests',
      status: 'in-progress',
      priority: 'high',
      dueDate: '2025-06-20T00:00:00Z',
      tags: ['testing', 'quality'],
      assigneeId: 1,
      createdBy: 1,
      createdAt: '2025-06-10T10:00:00Z',
      updatedAt: '2025-06-12T14:30:00Z',
    },
  ];
}

resetMockData();

export const handlers = [
  // Auth
  http.post('/auth/login', async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === 'test@example.com' && body.password === 'Str0ng!Pass') {
      return HttpResponse.json({
        token: 'mock-jwt-token-123',
        user: { id: 1, name: 'Test User', email: body.email },
      });
    }

    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),

  // List tasks
  http.get('/api/tasks', async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);

    let filtered = [...tasks];
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }

    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return HttpResponse.json({
      items,
      total: filtered.length,
      page,
      totalPages: Math.ceil(filtered.length / limit),
    });
  }),

  // Get task
  http.get('/api/tasks/:id', async ({ params }) => {
    await delay(50);
    const task = tasks.find((t) => t.id === Number(params.id));
    if (!task) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return HttpResponse.json(task);
  }),

  // Create task
  http.post('/api/tasks', async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as CreateTask;

    const newTask: Task = {
      id: taskIdCounter++,
      title: body.title,
      description: body.description ?? '',
      status: 'todo',
      priority: body.priority ?? 'medium',
      dueDate: body.dueDate ?? null,
      tags: body.tags ?? [],
      assigneeId: body.assigneeId ?? null,
      createdBy: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    return HttpResponse.json(newTask, { status: 201 });
  }),

  // Delete task
  http.delete('/api/tasks/:id', async ({ params }) => {
    await delay(50);
    const index = tasks.findIndex((t) => t.id === Number(params.id));
    if (index === -1) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }
    tasks.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
```

### Deliverable 6 : Tests E2E avec Playwright

```typescript
// tests/e2e/page-objects/login.page.ts
import type { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByTestId('login-error');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

// tests/e2e/page-objects/tasks.page.ts
import type { Page, Locator } from '@playwright/test';

export class TasksPage {
  readonly addButton: Locator;
  readonly taskList: Locator;
  readonly emptyState: Locator;
  readonly filterStatus: Locator;
  readonly searchInput: Locator;

  constructor(private page: Page) {
    this.addButton = page.getByRole('button', { name: 'New task' });
    this.taskList = page.getByTestId('task-list');
    this.emptyState = page.getByTestId('empty-state');
    this.filterStatus = page.getByLabel('Status filter');
    this.searchInput = page.getByPlaceholder('Search tasks...');
  }

  async goto(): Promise<void> {
    await this.page.goto('/tasks');
  }

  async createTask(title: string, priority: string = 'medium'): Promise<void> {
    await this.addButton.click();
    await this.page.getByLabel('Title').fill(title);
    await this.page.getByLabel('Priority').selectOption(priority);
    await this.page.getByRole('button', { name: 'Create' }).click();
    await this.page.getByText(title).waitFor();
  }

  async deleteTask(title: string): Promise<void> {
    const row = this.page.locator('[data-testid="task-item"]', { hasText: title });
    await row.getByRole('button', { name: 'Delete' }).click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
    await row.waitFor({ state: 'detached' });
  }

  taskCount(): Promise<number> {
    return this.page.locator('[data-testid="task-item"]').count();
  }
}

// tests/e2e/fixtures/auth.fixture.ts
import { test as base } from '@playwright/test';
import { LoginPage } from '../page-objects/login.page';
import { TasksPage } from '../page-objects/tasks.page';

type Fixtures = {
  loginPage: LoginPage;
  tasksPage: TasksPage;
  authenticatedPage: TasksPage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  tasksPage: async ({ page }, use) => {
    await use(new TasksPage(page));
  },

  authenticatedPage: async ({ page }, use) => {
    // Se connecter avant chaque test
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'Str0ng!Pass');
    await page.waitForURL('/tasks');

    await use(new TasksPage(page));
  },
});

export { expect } from '@playwright/test';

// tests/e2e/tasks.spec.ts
import { test, expect } from './fixtures/auth.fixture';

test.describe('Task Management', () => {
  test('should create a new task', async ({ authenticatedPage }) => {
    await authenticatedPage.createTask('Write documentation', 'high');

    const count = await authenticatedPage.taskCount();
    expect(count).toBeGreaterThan(0);

    await expect(
      authenticatedPage.taskList.getByText('Write documentation'),
    ).toBeVisible();
  });

  test('should delete a task', async ({ authenticatedPage }) => {
    await authenticatedPage.createTask('Temporary task');
    await authenticatedPage.deleteTask('Temporary task');

    await expect(
      authenticatedPage.taskList.getByText('Temporary task'),
    ).not.toBeVisible();
  });

  test('should filter tasks by status', async ({ authenticatedPage }) => {
    await authenticatedPage.filterStatus.selectOption('done');

    const tasks = authenticatedPage.taskList.locator('[data-testid="task-item"]');
    const count = await tasks.count();

    for (let i = 0; i < count; i++) {
      await expect(tasks.nth(i).getByTestId('task-status')).toHaveText('done');
    }
  });
});

test.describe('Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page).toHaveURL('/login');
  });

  test('should show error for invalid credentials', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('wrong@example.com', 'wrongpass');

    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Invalid credentials');
  });
});
```

### Deliverable 7 : Pipeline CI (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm eslint . --max-warnings 0
      - run: pnpm tsc --noEmit

  unit:
    name: Unit & Integration Tests
    needs: quality
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run --coverage --reporter=junit --outputFile=results/junit.xml
      - uses: codecov/codecov-action@v4
        if: always()
        with:
          file: ./coverage/lcov.info
          token: ${{ secrets.CODECOV_TOKEN }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: |
            results/
            coverage/

  e2e:
    name: E2E Tests
    needs: quality
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps chromium
      - run: pnpm build
      - run: pnpm playwright test --shard=${{ matrix.shard }}/2
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: traces-${{ matrix.shard }}
          path: test-results/

  contract:
    name: Contract Tests
    needs: quality
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run tests/contract/
```

### Deliverable 8 : Test de performance k6

```javascript
// tests/performance/task-api-load.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let authToken = '';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 25 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'avg<200'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{group:::Task CRUD}': ['p(95)<800'],
  },
};

export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'perf@example.com',
    password: 'Str0ng!Pass',
  }), { headers: { 'Content-Type': 'application/json' } });

  return { token: JSON.parse(loginRes.body).token };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  group('Task CRUD', () => {
    // Create
    const createRes = http.post(`${BASE_URL}/api/tasks`, JSON.stringify({
      title: `Perf task ${Date.now()}`,
      priority: 'medium',
    }), { headers });

    check(createRes, {
      'create: 201': (r) => r.status === 201,
      'create < 500ms': (r) => r.timings.duration < 500,
    });

    if (createRes.status === 201) {
      const taskId = JSON.parse(createRes.body).id;

      // Read
      const getRes = http.get(`${BASE_URL}/api/tasks/${taskId}`, { headers });
      check(getRes, { 'get: 200': (r) => r.status === 200 });

      // Delete
      const delRes = http.del(`${BASE_URL}/api/tasks/${taskId}`, null, { headers });
      check(delRes, { 'delete: 204': (r) => r.status === 204 });
    }
  });

  group('Task Listing', () => {
    const listRes = http.get(`${BASE_URL}/api/tasks?page=1&limit=20`, { headers });
    check(listRes, {
      'list: 200': (r) => r.status === 200,
      'list < 300ms': (r) => r.timings.duration < 300,
    });
  });

  sleep(Math.random() * 2 + 0.5);
}
```

### Deliverable 9 : Tests de contrat Zod

```typescript
// tests/contract/task-schema.test.ts
import { describe, it, expect } from 'vitest';
import {
  TaskSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskFilterSchema,
} from '../../src/server/schemas/task.schema';

describe('Task Contract Tests', () => {
  describe('TaskSchema', () => {
    it('should validate a complete task', () => {
      const result = TaskSchema.safeParse({
        id: 1,
        title: 'Test task',
        description: 'A description',
        status: 'todo',
        priority: 'high',
        dueDate: '2025-06-20T00:00:00Z',
        tags: ['feature'],
        assigneeId: 1,
        createdBy: 1,
        createdAt: '2025-06-15T10:00:00Z',
        updatedAt: '2025-06-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = TaskSchema.safeParse({
        id: 1,
        title: 'Test',
        status: 'invalid-status',
        priority: 'high',
        tags: [],
        createdBy: 1,
        createdAt: '2025-06-15T10:00:00Z',
        updatedAt: '2025-06-15T10:00:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('should reject tags exceeding limit', () => {
      const result = CreateTaskSchema.safeParse({
        title: 'Test',
        tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('API response shape', () => {
    it('should match the expected list response shape', () => {
      const ListResponseSchema = TaskFilterSchema.transform(() => null); // Just for validation

      // Simuler une reponse API
      const apiResponse = {
        items: [
          {
            id: 1,
            title: 'Task 1',
            status: 'todo',
            priority: 'medium',
            tags: [],
            createdBy: 1,
            createdAt: '2025-06-15T10:00:00Z',
            updatedAt: '2025-06-15T10:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      };

      // Valider chaque item
      for (const item of apiResponse.items) {
        const result = TaskSchema.safeParse(item);
        expect(result.success).toBe(true);
      }
    });
  });
});
```

### Deliverable 10 : Documentation

Le dernier deliverable est un README dans le dossier `tests/` qui explique :

- Comment lancer chaque type de tests
- Les conventions de nommage
- La structure des dossiers de tests
- Les commandes disponibles

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit/",
    "test:integration": "vitest run tests/integration/",
    "test:component": "vitest run tests/component/",
    "test:contract": "vitest run tests/contract/",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:perf": "k6 run tests/performance/task-api-load.js",
    "test:all": "pnpm test:coverage && pnpm test:e2e"
  }
}
```

---

## Criteres de notation

| Deliverable | Points | Criteres |
|-------------|--------|----------|
| 1. Strategie de test | 5 | Complete, realiste, justifiee |
| 2. Tests unitaires | 15 | 80%+ coverage, cas limites, isolation |
| 3. Tests integration API | 15 | CRUD complet, auth, erreurs, DB rollback |
| 4. Tests composants | 10 | Rendu, events, etats, isolation DOM |
| 5. MSW handlers | 5 | Realistes, coherents, resetables |
| 6. Tests E2E | 15 | Page Objects, fixtures auth, parcours complets |
| 7. Pipeline CI | 15 | Jobs paralleles, caching, artifacts, sharding |
| 8. Test perf k6 | 5 | Scenarios, thresholds, checks |
| 9. Contract tests Zod | 10 | Schemas complets, cas invalides |
| 10. Documentation | 5 | Claire, commandes fonctionnelles |
| **Total** | **100** | |

### Bonus (jusqu'a 20 points supplementaires)

| Bonus | Points | Description |
|-------|--------|-------------|
| Mutation testing | +5 | Stryker configure, 80%+ mutation score sur les services |
| Visual regression | +5 | Playwright screenshots comparaison |
| Accessibilite (a11y) | +5 | axe-core dans les tests E2E |
| Flaky detection | +5 | Script de detection + quarantaine CI |

---

## Conseils

1. **Commencez par la strategie** : definir ce que vous allez tester avant de coder
2. **Tests unitaires d'abord** : ils sont les plus rapides a ecrire et a debugger
3. **Testez les cas d'erreur** : les chemins d'erreur sont souvent les plus critiques
4. **Isolez chaque test** : aucun test ne doit dependre d'un autre
5. **Nommez clairement** : `it('should return 401 when token is expired')` pas `it('test auth')`
6. **Ne visez pas 100%** : 80% de couverture avec des tests de qualite > 100% de couverture superficielle
7. **CI d'abord** : configurez le pipeline tot, puis ajoutez les tests au fur et a mesure
8. **Commitez souvent** : chaque deliverable = un commit minimum

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| [17 - Performance testing](./17-performance-testing) | -- (fin de la formation) |

---

## Ressources

- [Quiz 18 : Testez vos connaissances](../quizzes/quiz-18-projet-final.html)
- [Lab 18 : Projet final](../labs/lab-18-projet-final/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [k6 Documentation](https://k6.io/docs/)
- [Zod Documentation](https://zod.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
