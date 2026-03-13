# Screencast 18 — Projet final

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/18-projet-final.md`
- **Lab associe** : Lab 18
- **Prerequis** : Screencasts 00 a 17

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Application Task Manager demarree
- [ ] Fichier `modules/18-projet-final.md` ouvert
- [ ] Tous les outils installes (Vitest, Playwright, MSW, k6, Stryker)

## Script

### [00:00-02:30] Introduction — L'application Task Manager

> Le projet final met en pratique tout ce qu'on a appris. L'application est un Task Manager complet avec un backend Express + SQLite et un frontend SPA en TypeScript. Vous devez construire une suite de tests complete couvrant tous les niveaux de la pyramide.

**Action** : Afficher l'architecture.

```
┌─────────────────────────────────────────┐
│              FRONTEND (SPA)             │
│  HTML/CSS/TypeScript                    │
│  ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │  Pages   │ │Components│ │ Store  │  │
│  └──────────┘ └──────────┘ └────────┘  │
└──────────────────┬──────────────────────┘
                   │ HTTP (fetch)
┌──────────────────▼──────────────────────┐
│              BACKEND (API)              │
│  Express.js + JWT                       │
│  ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │  Routes  │ │ Services │ │  Repos │  │
│  └──────────┘ └──────────┘ └────────┘  │
└──────────────────┬──────────────────────┘
                   │ SQL
                ┌──▼──┐
                │SQLite│
                └─────┘
```

### [02:30-05:30] Deliverable 1 — Strategie de test

> Avant d'ecrire une seule ligne de code, il faut une strategie. C'est le premier deliverable du projet.

**Action** : Montrer le template de strategie.

```markdown
# Strategie de test — Task Manager

## Niveaux de test
| Niveau       | Outil      | Scope                    | Objectif couverture |
|-------------|------------|--------------------------|---------------------|
| Unitaire    | Vitest     | Fonctions pures, services| 85%                 |
| Composant   | Vitest+DOM | Composants UI isoles     | 80%                 |
| Integration | Vitest+MSW | Service+DB, Comp+Store   | 70%                 |
| E2E         | Playwright | Flux utilisateur complets | Flux critiques      |
| Performance | k6         | Endpoints principaux     | p95 < 500ms         |

## Priorites de test
1. Authentification (critique — securite)
2. CRUD taches (coeur metier)
3. Filtres et tri (UX)
4. Assignation et tags (secondaire)

## Conventions
- Nommage : describe('NomModule') > it('should ...')
- Factories pour les donnees de test
- MSW pour tous les appels API en tests frontend
- Page Object Model pour les tests Playwright
```

### [05:30-09:00] Deliverables 2-4 — Tests unitaires, composants, integration

**Action** : Montrer les tests unitaires du backend.

```typescript
// tests/unit/task.service.test.ts
describe('TaskService', () => {
  it('should create task with default status', async () => {
    const repo = new InMemoryTaskRepository();
    const service = new TaskService(repo);

    const task = await service.create({ title: 'Test', priority: 'high' });

    expect(task.status).toBe('todo');
    expect(task.priority).toBe('high');
    expect(task.id).toBeDefined();
  });

  it('should throw on empty title', async () => {
    const repo = new InMemoryTaskRepository();
    const service = new TaskService(repo);

    await expect(service.create({ title: '', priority: 'low' }))
      .rejects.toThrow('Title is required');
  });
});
```

**Action** : Montrer un test de composant.

```typescript
// tests/components/task-card.test.ts
describe('TaskCard', () => {
  it('should display task info and emit delete on click', async () => {
    const task = createTask({ title: 'Write tests', priority: 'high' });
    const { getByText, getByRole, emitted } = render(TaskCard, {
      props: { task },
    });

    expect(getByText('Write tests')).toBeVisible();
    expect(getByText('high')).toBeVisible();

    await userEvent.click(getByRole('button', { name: 'Supprimer' }));
    expect(emitted('delete')).toEqual([[task.id]]);
  });
});
```

**Action** : Montrer un test d'integration API.

```typescript
// tests/integration/tasks-api.test.ts
describe('Tasks API Integration', () => {
  it('should create, list, and delete a task', async () => {
    const app = createApp({ db: createTestDb() });

    // Create
    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ title: 'Integration test' })
      .expect(201);

    // List
    const list = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    // Delete
    await request(app)
      .delete(`/api/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${testToken}`)
      .expect(204);
  });
});
```

### [09:00-12:00] Deliverables 5-7 — E2E, MSW, couverture

**Action** : Montrer un test E2E avec Page Object.

```typescript
// e2e/tasks.spec.ts
import { test, expect } from './fixtures';

test.describe('Task Management', () => {
  test('should create, edit, and complete a task', async ({ authenticatedPage, tasksPage }) => {
    await tasksPage.goto();

    // Create
    await tasksPage.createTask('Ecrire le rapport', 'high');
    await expect(tasksPage.taskByTitle('Ecrire le rapport')).toBeVisible();

    // Edit
    await tasksPage.editTask('Ecrire le rapport', { title: 'Rapport final' });
    await expect(tasksPage.taskByTitle('Rapport final')).toBeVisible();

    // Complete
    await tasksPage.completeTask('Rapport final');
    await expect(tasksPage.taskByTitle('Rapport final')).toHaveClass(/completed/);
  });
});
```

**Action** : Montrer les seuils de couverture.

```
OBJECTIFS DE COUVERTURE :
━━━━━━━━━━━━━━━━━━━━━━━
Backend services   : 90% branches, 85% lines
Backend routes     : 80% lines
Frontend composants: 80% lines
Frontend store     : 85% lines
Global             : 80% lines, 75% branches
Mutation score     : > 70% (Stryker)
```

### [12:00-14:30] Deliverables 8-9 — CI/CD et performance

**Action** : Montrer le pipeline complet.

```yaml
# .github/workflows/ci.yml — Pipeline du projet final
jobs:
  quality:
    steps:
      - run: pnpm lint && pnpm type-check

  unit-integration:
    steps:
      - run: pnpm test:coverage
      - run: npx stryker run
      - uses: codecov/codecov-action@v4

  e2e:
    strategy:
      matrix:
        shard: [1, 2]
    steps:
      - run: npx playwright test --shard=${{ matrix.shard }}/2

  performance:
    steps:
      - run: k6 run k6/load-test.js
      - run: npx lhci autorun
```

### [14:30-16:30] Deliverable 10 — Document de synthese

**Action** : Montrer le contenu attendu.

```
DOCUMENT DE SYNTHESE :
━━━━━━━━━━━━━━━━━━━━━
1. Strategie de test choisie (avec justification)
2. Couverture finale (screenshot du rapport)
3. Score de mutation Stryker
4. Resultats k6 (p95 latence, taux d'erreur)
5. Score Lighthouse CI
6. Nombre de tests par categorie (unite, integration, E2E)
7. Temps total d'execution de la suite
8. Lecons apprises et points d'amelioration
```

### [16:30-18:00] Criteres d'evaluation

**Action** : Afficher la grille.

```
CRITERE                         | POINTS | SEUIL MINIMUM
--------------------------------|--------|---------------
Tests unitaires (quantite+qual) | 20     | 15 tests, 80% couv.
Tests de composants             | 15     | 8 tests
Tests d'integration             | 15     | 5 tests
Tests E2E (POM + fixtures)      | 15     | 3 flux complets
MSW handlers                    | 10     | Handlers CRUD + erreurs
Couverture + mutations          | 10     | 80% couv, 70% mutations
CI/CD pipeline                  | 10     | Pipeline fonctionnel
Document de strategie           | 5      | Structure complete
```

### [18:00-19:30] Recapitulatif du cours

**Action** : Afficher le recapitulatif final.

```
CE QUE VOUS AVEZ APPRIS EN 18 MODULES :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fondamentaux : pyramide, AAA, isolation, determinisme
Vitest       : matchers, mocking, fake timers, snapshots
Architecture : injection de dependances, fonctions pures, hexagonal
Composants   : comportement > implementation, selecteurs accessibles
MSW          : intercepter le reseau, handlers partages
Integration  : supertest, factories, Testcontainers
Playwright   : auto-wait, POM, fixtures, regression visuelle
Couverture   : metriques, seuils, mutation testing
CI/CD        : pipeline, sharding, pre-commit hooks
Avance       : flaky tests, TDD/BDD, contract testing, performance

Vous avez tous les outils pour construire des suites de tests
robustes, maintenables et rapides. Bonne chance pour le projet !
```

## Points d'attention pour l'enregistrement
- Ce screencast est un guide pour le projet — etre clair sur les attentes
- Montrer des extraits de code concrets pour chaque deliverable
- La grille d'evaluation doit etre affichee clairement
- Terminer sur une note motivante — c'est le dernier screencast
- Rappeler que le cours complet est dans les modules pour reference
