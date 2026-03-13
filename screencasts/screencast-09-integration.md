# Screencast 09 — Tests d'integration

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/09-tests-integration.md`
- **Lab associe** : Lab 09
- **Prerequis** : Screencast 08

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Projet de demo avec Vitest + MSW + supertest
- [ ] Fichier `modules/09-tests-integration.md` ouvert
- [ ] Docker installe (pour la section Testcontainers)

## Script

### [00:00-02:00] Introduction — Definition et limites

> Un test d'integration verifie que plusieurs modules fonctionnent ensemble. Contrairement au test unitaire qui isole, le test d'integration connecte : service + DB, composant + store + API, middleware + handler.

**Action** : Afficher la comparaison.

```
        Unite            Integration            E2E
    ┌──────────┐     ┌──────────────┐     ┌──────────┐
    │ Fonction │     │ Service +    │     │ Browser  │
    │ pure     │     │ DB + API     │     │ reel     │
    │          │     │              │     │ full app │
    └──────────┘     └──────────────┘     └──────────┘
     Isole            2+ modules            Tout le stack
     Rapide           Moyen                 Lent
     Beaucoup         Quelques-uns          Peu
```

### [02:00-06:00] Tester une API Express avec supertest

> supertest permet de tester une API HTTP sans demarrer de serveur reel.

**Action** : Creer un test d'API.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('Tasks API', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp({ db: createTestDb() });
  });

  it('POST /api/tasks should create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Write tests', priority: 'high' })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(String),
      title: 'Write tests',
      priority: 'high',
      status: 'todo',
    });
  });

  it('GET /api/tasks should return all tasks', async () => {
    // Arrange — creer des donnees
    await request(app).post('/api/tasks').send({ title: 'Task 1' });
    await request(app).post('/api/tasks').send({ title: 'Task 2' });

    // Act
    const res = await request(app).get('/api/tasks').expect(200);

    // Assert
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Task 1');
  });

  it('GET /api/tasks/:id should return 404 for unknown task', async () => {
    await request(app).get('/api/tasks/unknown-id').expect(404);
  });
});
```

### [06:00-09:00] Integration DB — Setup et teardown propres

> L'enjeu principal des tests d'integration DB est l'isolation : chaque test doit partir d'un etat propre.

**Action** : Montrer les strategies d'isolation.

```typescript
import Database from 'better-sqlite3';

// Strategie 1 : DB in-memory par test
function createTestDb(): Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium'
    )
  `);
  return db;
}

// Strategie 2 : Transaction rollback
describe('with transaction rollback', () => {
  let db: Database;

  beforeEach(() => {
    db.exec('BEGIN');
  });

  afterEach(() => {
    db.exec('ROLLBACK');
  });
});

// Strategie 3 : Truncate tables
afterEach(() => {
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM users');
});
```

> La DB in-memory est la plus simple et la plus rapide. Le rollback de transaction est utile avec de gros schemas. Le truncate est le dernier recours.

### [09:00-12:30] Frontend — Composant + Store + Router + API

> Cote frontend, un test d'integration combine un composant avec son store, son router et ses appels API (via MSW).

**Action** : Montrer un test d'integration frontend.

```typescript
describe('TaskList integration', () => {
  it('should load tasks and allow filtering', async () => {
    // MSW retourne les donnees par defaut
    const { getByRole, findAllByRole, getByLabelText } = render(TaskListPage, {
      global: {
        plugins: [createTestRouter(), createTestStore()],
      },
    });

    // Attendre le chargement
    const items = await findAllByRole('listitem');
    expect(items).toHaveLength(5);

    // Filtrer par statut
    await userEvent.selectOptions(getByLabelText('Statut'), 'done');

    // Verifier le filtre
    const filtered = await findAllByRole('listitem');
    expect(filtered).toHaveLength(2);
  });

  it('should navigate to task detail on click', async () => {
    const { findByText } = render(TaskListPage, {
      global: { plugins: [createTestRouter(), createTestStore()] },
    });

    await userEvent.click(await findByText('Write tests'));

    // Le router a change
    expect(window.location.pathname).toBe('/tasks/1');
  });
});
```

### [12:30-15:00] Fixtures — Factories et builders

> Les fixtures sont les donnees de test. Les factories les rendent flexibles et maintenables.

**Action** : Creer une factory.

```typescript
// test/factories/task.factory.ts
let counter = 0;

export function createTask(overrides: Partial<Task> = {}): Task {
  counter++;
  return {
    id: `task-${counter}`,
    title: `Task ${counter}`,
    status: 'todo',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Utilisation dans les tests
it('should show high priority tasks first', async () => {
  const tasks = [
    createTask({ priority: 'low', title: 'Low task' }),
    createTask({ priority: 'high', title: 'High task' }),
    createTask({ priority: 'medium', title: 'Medium task' }),
  ];

  server.use(http.get('/api/tasks', () => HttpResponse.json(tasks)));

  const { findAllByRole } = render(TaskList);
  const items = await findAllByRole('listitem');
  expect(items[0]).toHaveTextContent('High task');
});
```

### [15:00-17:00] Testcontainers — Environnements reproductibles

> Pour les integrations complexes (PostgreSQL, Redis, Kafka), Testcontainers demarre des containers Docker a la volee.

**Action** : Montrer un exemple Testcontainers.

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

describe('with real PostgreSQL', () => {
  let container;
  let db;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();
    db = createConnection(container.getConnectionUri());
    await db.migrate();
  }, 30_000); // timeout 30s pour le demarrage

  afterAll(async () => {
    await db.close();
    await container.stop();
  });

  it('should persist and retrieve tasks', async () => {
    await db.insert('tasks', { title: 'Test task' });
    const tasks = await db.select('tasks');
    expect(tasks).toHaveLength(1);
  });
});
```

### [17:00-18:30] Recapitulatif

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Integration = 2+ modules connectes (pas tout le stack)
2. supertest pour les API, MSW pour le frontend
3. Isolation DB : in-memory > rollback > truncate
4. Factories pour des fixtures flexibles et maintenables
5. Testcontainers pour les deps complexes (PostgreSQL, Redis)
6. Les tests d'integration sont plus lents — les garder cibles

PROCHAINE ETAPE :
→ Screencast 10 : Playwright fondamentaux
```

## Points d'attention pour l'enregistrement
- La demo supertest est le moment cle — montrer le workflow complet POST + GET
- L'isolation DB est cruciale — bien montrer les 3 strategies
- Le test d'integration frontend combine tout ce qu'on a vu — prendre le temps
- Les factories sont un pattern qu'on reutilisera — bien les presenter
