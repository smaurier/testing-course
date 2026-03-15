# Screencast 08 — MSW (Mock Service Worker)

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/08-msw-mock-service-worker.md`
- **Lab associe** : Lab 08
- **Prérequis** : Screencast 07

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal intégré ouvert
- [ ] Projet de demo avec Vitest + MSW installe
- [ ] Fichier `modules/08-msw-mock-service-worker.md` ouvert

## Script

### [00:00-02:30] Introduction — Pourquoi intercepter au niveau réseau ?

> Quand on teste du code qui fait des appels HTTP, on peut mocker le module (vi.mock), mocker fetch globalement, ou intercepter au niveau réseau avec MSW. MSW est la meilleure approche car elle ne change pas votre code.

**Action** : Comparer les trois approches.

```typescript
// Option 1 : vi.mock — fragile, couple au module
vi.mock('./api/userApi', () => ({
  getUsers: vi.fn().mockResolvedValue([{ id: 1, name: 'Alice' }]),
}));

// Option 2 : mock fetch global — bas niveau, verbeux
vi.spyOn(global, 'fetch').mockResolvedValue(
  new Response(JSON.stringify([{ id: 1, name: 'Alice' }]))
);

// Option 3 : MSW — intercepte au niveau reseau ✓
http.get('/api/users', () => {
  return HttpResponse.json([{ id: 1, name: 'Alice' }]);
});
```

> MSW intercepte les vraies requêtes HTTP. Votre code appelle vraiment `fetch`, la requête est capturee et une réponse simulee est retournee. Aucun mock, aucun changement de code.

### [02:30-05:30] Installation et configuration

**Action** : Installer et configurer MSW.

```bash
pnpm add -D msw
```

**Action** : Créer les handlers.

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice', email: 'alice@test.com' },
      { id: 2, name: 'Bob', email: 'bob@test.com' },
    ]);
  }),

  http.get('/api/users/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id: Number(id),
      name: 'Alice',
      email: 'alice@test.com',
    });
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 3, ...body },
      { status: 201 }
    );
  }),
];
```

**Action** : Configurer le serveur MSW pour les tests.

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

**Action** : Configurer le setup global.

```typescript
// src/setup-tests.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### [05:30-09:00] Écrire des handlers — GET, POST, PUT, DELETE

**Action** : Montrer la gamme complete des handlers.

```typescript
import { http, HttpResponse } from 'msw';

export const crudHandlers = [
  // GET collection
  http.get('/api/tasks', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let tasks = allTasks;
    if (status) tasks = tasks.filter(t => t.status === status);
    return HttpResponse.json(tasks);
  }),

  // GET single
  http.get('/api/tasks/:id', ({ params }) => {
    const task = allTasks.find(t => t.id === params.id);
    if (!task) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(task);
  }),

  // POST create
  http.post('/api/tasks', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'new-1', ...body }, { status: 201 });
  }),

  // PUT update
  http.put('/api/tasks/:id', async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  // DELETE
  http.delete('/api/tasks/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
```

### [09:00-12:00] Overrides per-test — Simuler les erreurs

> Les handlers par defaut couvrent le cas nominal. Pour tester les erreurs, on utilise `server.use()` pour ajouter un override temporaire.

**Action** : Demontrer les overrides.

```typescript
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';

describe('UserService', () => {
  it('should handle 500 error', async () => {
    // Override pour ce test uniquement
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        );
      })
    );

    await expect(fetchUsers()).rejects.toThrow('Server error');
  });

  it('should handle network failure', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.error(); // simule une erreur reseau
      })
    );

    await expect(fetchUsers()).rejects.toThrow('Network error');
  });

  it('should handle slow response', async () => {
    server.use(
      http.get('/api/users', async () => {
        await delay(5000); // simule une reponse lente
        return HttpResponse.json([]);
      })
    );

    await expect(fetchUsers({ timeout: 1000 })).rejects.toThrow('Timeout');
  });
});
```

> Le `afterEach(() => server.resetHandlers())` dans le setup global garantit que les overrides ne fuient pas entre les tests.

### [12:00-14:30] MSW en développement — Browser intégration

> MSW fonctionne aussi dans le navigateur pour le développement.

**Action** : Montrer la configuration browser.

```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// main.ts — demarrer MSW en dev uniquement
async function bootstrap() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
  // ... demarrer l'app
}
```

> Le même jeu de handlers est partage entre les tests et le développement. Un seul endroit pour définir les réponses API.

### [14:30-17:00] Patterns avances — Retry, pagination, auth

**Action** : Montrer un handler de pagination.

```typescript
http.get('/api/tasks', ({ request }) => {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Number(url.searchParams.get('limit') ?? '10');
  const start = (page - 1) * limit;
  const items = allTasks.slice(start, start + limit);

  return HttpResponse.json({
    data: items,
    total: allTasks.length,
    page,
    totalPages: Math.ceil(allTasks.length / limit),
  });
});
```

### [17:00-18:30] Récapitulatif

**Action** : Afficher le récapitulatif.

```
CE QU'IL FAUT RETENIR :
1. MSW intercepte au niveau reseau — pas de mock, pas de changement de code
2. Handlers pardefaut dans handlers.ts, overrides via server.use()
3. afterEach(() => server.resetHandlers()) pour l'isolation
4. onUnhandledRequest: 'error' pour detecter les requetes non-mockees
5. Meme handlers pour tests ET developpement

PROCHAINE ETAPE :
→ Screencast 09 : Tests d'integration
```

## Points d'attention pour l'enregistrement
- La comparaison vi.mock vs fetch mock vs MSW est le moment decisif
- Montrer que le code sous test ne change PAS avec MSW
- L'override per-test pour les erreurs est un pattern clé
- Insister sur onUnhandledRequest: 'error' — sans ça, les requêtes non-mockees passent silencieusement
