# Module 08 — MSW (Mock Service Worker)

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 3/5        | 90 min        | [Lab 08](../labs/lab-08-msw/) | [Quiz 08](../quizzes/quiz-08-msw.html) |

## Objectifs

- Comprendre pourquoi intercepter au niveau réseau plutot que mocker les modules
- Installer et configurer MSW pour Node (tests) et navigateur (dev)
- Écrire des handlers pour GET, POST, PUT, DELETE
- Gérer les paramètres dynamiques (path, query, body)
- Maîtriser le cycle de vie du serveur MSW
- Écrire des overrides per-test pour les cas d'erreur
- Appliquer MSW a des patterns de tests réels (CRUD, pagination, retry)

---

## Pourquoi MSW ?

### Le problème des mocks traditionnels

Quand on teste du code qui fait des appels HTTP, on a plusieurs options :

```typescript
// Option 1 : vi.mock() — mock au niveau module
vi.mock('./api/userApi', () => ({
  getUsers: vi.fn().mockResolvedValue([{ id: 1, name: 'Alice' }]),
}));

// Probleme : on ne teste pas le vrai code de fetch/axios
// Si l'URL change, le header manque, ou le parsing echoue, le test passe quand meme
```

```typescript
// Option 2 : axios interceptors ou mock d'axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Alice' }] }),
    create: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({ data: [] }),
    })),
  },
}));

// Probleme : couple au client HTTP (impossible de migrer d'axios a fetch)
// Probleme : syntaxe complexe pour recreer l'API d'axios
```

### La solution MSW : interception au niveau réseau

MSW intercepte les requêtes **au niveau de la couche réseau**, pas au niveau du code.

```
Votre code  →  fetch() / axios  →  [MSW intercepte ici]  →  Reponse simulee
                                          ↑
                                  Pas besoin de mocker
                                  fetch ou axios
```

Avantages :
- Le vrai code de `fetch()` ou `axios` est exécuté
- Les headers, l'URL, le body sont réellement construits et envoyes
- Si vous changez de client HTTP, les tests continuent de fonctionner
- Les handlers sont réutilisables entre tests Node et navigateur

### Comparaison des approches

| Critere | `vi.mock()` | Axios mock | MSW |
|---------|-------------|------------|-----|
| Niveau d'interception | Module | Client HTTP | Réseau |
| Teste le vrai fetch/axios | Non | Non | Oui |
| Agnostique du client HTTP | Non | Non | Oui |
| Reutilisable navigateur/Node | Non | Non | Oui |
| Complexite de setup | Faible | Moyenne | Moyenne (initiale) |
| Realisme | Faible | Moyen | Eleve |
| Maintenance | Fragile | Moyenne | Robuste |
| Supporte REST + GraphQL | Manuel | Manuel | Natif |

---

## Installation

```bash
# Avec pnpm
pnpm add -D msw

# Avec npm
npm install --save-dev msw

# Avec yarn
yarn add --dev msw
```

### Structure de fichiers recommandee

```
src/
  mocks/
    handlers.ts       # handlers par defaut (happy path)
    server.ts         # configuration du serveur Node (tests)
    browser.ts        # configuration du worker navigateur (dev)
    fixtures/
      users.ts        # donnees de test reutilisables
      products.ts
```

---

## Handlers : les bases

Un handler MSW définit comment repondre à une requête HTTP donnee.

### Import et syntaxe de base

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

// Structure d'un handler :
// http.<method>('<url>', ({ request, params, cookies }) => {
//   return HttpResponse.json(data, { status, headers });
// });
```

### GET — récupérer des donnees

```typescript
import { http, HttpResponse } from 'msw';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

const users: User[] = [
  { id: 1, name: 'Alice Martin', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Dupont', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie Durand', email: 'charlie@example.com', role: 'user' },
];

export const handlers = [
  // GET /api/users — liste de tous les utilisateurs
  http.get('/api/users', () => {
    return HttpResponse.json(users);
  }),

  // GET /api/users/:id — un utilisateur par ID
  http.get('/api/users/:id', ({ params }) => {
    const { id } = params;
    const user = users.find((u) => u.id === Number(id));

    if (!user) {
      return HttpResponse.json(
        { error: 'User not found' },
        { status: 404 },
      );
    }

    return HttpResponse.json(user);
  }),
];
```

### POST — créer une ressource

```typescript
export const handlers = [
  // ...GET handlers

  http.post('/api/users', async ({ request }) => {
    const body = await request.json() as Omit<User, 'id'>;

    // Valider le body
    if (!body.name || !body.email) {
      return HttpResponse.json(
        { error: 'Name and email are required' },
        { status: 400 },
      );
    }

    const newUser: User = {
      id: users.length + 1,
      name: body.name,
      email: body.email,
      role: body.role ?? 'user',
    };

    return HttpResponse.json(newUser, { status: 201 });
  }),
];
```

### PUT — mettre a jour une ressource

```typescript
http.put('/api/users/:id', async ({ params, request }) => {
  const { id } = params;
  const body = await request.json() as Partial<User>;
  const userIndex = users.findIndex((u) => u.id === Number(id));

  if (userIndex === -1) {
    return HttpResponse.json(
      { error: 'User not found' },
      { status: 404 },
    );
  }

  const updatedUser: User = {
    ...users[userIndex],
    ...body,
    id: Number(id), // Ne pas permettre de changer l'ID
  };

  return HttpResponse.json(updatedUser);
}),
```

### DELETE — supprimer une ressource

```typescript
http.delete('/api/users/:id', ({ params }) => {
  const { id } = params;
  const user = users.find((u) => u.id === Number(id));

  if (!user) {
    return HttpResponse.json(
      { error: 'User not found' },
      { status: 404 },
    );
  }

  // Retourner 204 No Content
  return new HttpResponse(null, { status: 204 });
}),
```

---

## Handlers dynamiques

### Parametres de chemin (path params)

```typescript
// Route : /api/organizations/:orgId/teams/:teamId/members
http.get('/api/organizations/:orgId/teams/:teamId/members', ({ params }) => {
  const { orgId, teamId } = params;

  // params est type comme Record<string, string | readonly string[]>
  const members = getMembersForTeam(String(orgId), String(teamId));

  return HttpResponse.json({
    orgId,
    teamId,
    members,
    count: members.length,
  });
}),
```

### Parametres de requête (query params)

```typescript
// URL : /api/users?page=2&limit=10&sort=name&role=admin
http.get('/api/users', ({ request }) => {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Number(url.searchParams.get('limit') ?? '10');
  const sort = url.searchParams.get('sort') ?? 'id';
  const roleFilter = url.searchParams.get('role');

  let filteredUsers = [...users];

  // Filtrer par role si specifie
  if (roleFilter) {
    filteredUsers = filteredUsers.filter((u) => u.role === roleFilter);
  }

  // Trier
  filteredUsers.sort((a, b) => {
    const aVal = a[sort as keyof User];
    const bVal = b[sort as keyof User];
    return String(aVal).localeCompare(String(bVal));
  });

  // Paginer
  const start = (page - 1) * limit;
  const paginatedUsers = filteredUsers.slice(start, start + limit);

  return HttpResponse.json({
    data: paginatedUsers,
    pagination: {
      page,
      limit,
      total: filteredUsers.length,
      totalPages: Math.ceil(filteredUsers.length / limit),
    },
  });
}),
```

### Corps de requête (request body)

```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: User;
  expiresAt: string;
}

http.post('/api/auth/login', async ({ request }) => {
  const { email, password } = await request.json() as LoginRequest;

  // Simuler une verification
  if (email === 'alice@example.com' && password === 'correct-password') {
    const response: LoginResponse = {
      token: 'fake-jwt-token-abc123',
      user: { id: 1, name: 'Alice Martin', email, role: 'admin' },
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };
    return HttpResponse.json(response);
  }

  return HttpResponse.json(
    { error: 'Invalid credentials' },
    { status: 401 },
  );
}),
```

---

## HttpResponse : types de réponse

### JSON

```typescript
// Reponse JSON standard
HttpResponse.json({ data: 'value' });

// Avec status personnalise
HttpResponse.json({ id: 1 }, { status: 201 });

// Avec headers personnalises
HttpResponse.json(
  { data: 'value' },
  {
    status: 200,
    headers: {
      'X-Total-Count': '42',
      'X-Request-Id': 'req-abc-123',
    },
  },
);
```

### Texte brut

```typescript
// Reponse texte
HttpResponse.text('Hello, World!');

// CSV
HttpResponse.text('name,email\nAlice,alice@test.com\nBob,bob@test.com', {
  headers: { 'Content-Type': 'text/csv' },
});
```

### Erreurs réseau

```typescript
import { HttpResponse, http } from 'msw';

// Erreur reseau (pas de reponse du serveur)
http.get('/api/unreachable', () => {
  return HttpResponse.error();
  // Provoque un TypeError: Failed to fetch
});

// Erreurs HTTP classiques
http.get('/api/forbidden', () => {
  return HttpResponse.json(
    { error: 'Forbidden', message: 'You do not have access' },
    { status: 403 },
  );
});

http.get('/api/server-error', () => {
  return HttpResponse.json(
    { error: 'Internal Server Error' },
    { status: 500 },
  );
});
```

### Simulation de delai

```typescript
import { http, HttpResponse, delay } from 'msw';

http.get('/api/slow-endpoint', async () => {
  // Simuler une latence de 2 secondes
  await delay(2000);

  return HttpResponse.json({ data: 'finally loaded' });
}),

// Delai aleatoire realiste
http.get('/api/realistic-endpoint', async () => {
  // Delai aleatoire entre 100ms et 500ms
  await delay();

  return HttpResponse.json({ data: 'loaded' });
}),

// Reponse qui ne se termine jamais (pour tester les timeouts)
http.get('/api/timeout-endpoint', async () => {
  await delay('infinite');

  return HttpResponse.json({ data: 'never reached' });
}),
```

---

## Configuration du serveur (Node / tests)

### Setup du serveur

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Intégration avec Vitest

```typescript
// src/setupTests.ts (ou vitest.setup.ts)
import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './mocks/server';

// Demarrer le serveur avant tous les tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error', // Erreur si une requete n'a pas de handler
  });
});

// Reinitialiser les handlers apres chaque test
// (supprime les overrides ajoutes via server.use())
afterEach(() => {
  server.resetHandlers();
});

// Arreter le serveur apres tous les tests
afterAll(() => {
  server.close();
});
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/setupTests.ts'],
    environment: 'jsdom', // ou 'happy-dom'
  },
});
```

### Cycle de vie du serveur

```
beforeAll  →  server.listen()     // Demarrer l'interception
                                   //
  test 1   →  (handlers par defaut)
  afterEach →  server.resetHandlers()  // Supprimer les overrides
                                   //
  test 2   →  server.use(override) // Ajouter un override temporaire
  afterEach →  server.resetHandlers()  // Retour aux handlers par defaut
                                   //
  test 3   →  (handlers par defaut)
  afterEach →  server.resetHandlers()
                                   //
afterAll   →  server.close()      // Arreter l'interception
```

### Options de `server.listen()`

```typescript
server.listen({
  // Que faire si une requete n'a pas de handler ?
  onUnhandledRequest: 'error',   // Lever une erreur (recommande pour les tests)
  // onUnhandledRequest: 'warn', // Afficher un warning
  // onUnhandledRequest: 'bypass', // Laisser passer (requete reelle)

  // Ou une fonction personnalisee
  // onUnhandledRequest(request, print) {
  //   if (request.url.includes('cdn.')) return; // Ignorer les CDN
  //   print.error();
  // },
});
```

---

## Overrides per-test avec `server.use()`

Le mécanisme le plus puissant de MSW : pouvoir redefinir un handler pour un test spécifique.

### Pattern de base

```typescript
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

describe('UserList', () => {
  // Ce test utilise les handlers par defaut (happy path)
  it('should display list of users', async () => {
    render(UserList);

    const users = await screen.findAllByRole('listitem');
    expect(users).toHaveLength(3); // handlers par defaut retournent 3 users
  });

  // Ce test override le handler GET /api/users pour ce test uniquement
  it('should display empty state when no users', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json([]);
      }),
    );

    render(UserList);

    expect(await screen.findByText(/aucun utilisateur/i)).toBeTruthy();
  });

  // Ce test override pour simuler une erreur
  it('should display error message on API failure', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 },
        );
      }),
    );

    render(UserList);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /erreur lors du chargement/i,
    );
  });

  // Ce test override pour simuler une erreur reseau
  it('should handle network failure', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.error();
      }),
    );

    render(UserList);

    expect(await screen.findByText(/connexion impossible/i)).toBeTruthy();
  });

  // Apres chaque test, afterEach -> server.resetHandlers()
  // Les overrides sont automatiquement supprimes
});
```

### Override avec delai pour tester le loading state

```typescript
it('should show loading spinner while fetching', async () => {
  server.use(
    http.get('/api/users', async () => {
      await delay(1000); // Delai long pour voir le loading
      return HttpResponse.json(users);
    }),
  );

  render(UserList);

  // Le spinner doit etre visible immediatement
  expect(screen.getByRole('progressbar')).toBeTruthy();

  // Attendre que les donnees arrivent
  await screen.findAllByRole('listitem');

  // Le spinner doit avoir disparu
  expect(screen.queryByRole('progressbar')).toBeNull();
});
```

### Override ponctuel (une seule fois)

```typescript
import { http, HttpResponse } from 'msw';

// Le handler ne repond qu'une seule fois, puis revient au handler par defaut
server.use(
  http.get(
    '/api/users',
    () => {
      return HttpResponse.json(
        { error: 'Server Error' },
        { status: 500 },
      );
    },
    { once: true }, // Ne s'active qu'une seule fois
  ),
);

// Premier appel → 500 (override)
// Deuxieme appel → 200 (handler par defaut)
```

---

## Mode navigateur : `setupWorker`

MSW peut aussi intercepter les requêtes dans un vrai navigateur, utile pour le développement.

### Configuration

```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

### Initialisation conditionnelle

```typescript
// src/main.ts (ou index.ts)
async function enableMocking(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const { worker } = await import('./mocks/browser');

  await worker.start({
    onUnhandledRequest: 'bypass', // Laisser passer les requetes sans handler
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  });
}

enableMocking().then(() => {
  // Demarrer l'application
  createApp(App).mount('#app');
});
```

### Générer le service worker

```bash
# Generer le fichier mockServiceWorker.js dans le dossier public
npx msw init ./public --save
```

### Différence serveur vs worker

| Aspect | `setupServer` (Node) | `setupWorker` (Navigateur) |
|--------|---------------------|---------------------------|
| Environnement | Node.js (tests) | Navigateur (dev) |
| Mécanisme | Interception de `http`/`https` module | Service Worker |
| Necessite fichier SW | Non | Oui (`mockServiceWorker.js`) |
| DevTools réseau | Non visible | Visible dans l'onglet Network |
| Usage typique | Vitest, Jest | Storybook, dev local |

---

## Patterns de tests réels

### Pattern 1 : GET — afficher une liste

```typescript
// src/mocks/fixtures/products.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

export const mockProducts: Product[] = [
  { id: 'p1', name: 'Clavier mecanique', price: 129.99, category: 'peripheriques', inStock: true },
  { id: 'p2', name: 'Souris ergonomique', price: 79.99, category: 'peripheriques', inStock: true },
  { id: 'p3', name: 'Ecran 4K 27"', price: 449.99, category: 'ecrans', inStock: false },
  { id: 'p4', name: 'Webcam HD', price: 59.99, category: 'peripheriques', inStock: true },
];
```

```typescript
// src/mocks/handlers/productHandlers.ts
import { http, HttpResponse } from 'msw';
import { mockProducts } from '../fixtures/products';

export const productHandlers = [
  http.get('/api/products', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const inStock = url.searchParams.get('inStock');

    let filtered = [...mockProducts];

    if (category) {
      filtered = filtered.filter((p) => p.category === category);
    }
    if (inStock !== null) {
      filtered = filtered.filter((p) => p.inStock === (inStock === 'true'));
    }

    return HttpResponse.json({ products: filtered, total: filtered.length });
  }),
];
```

```typescript
// ProductList.test.ts
describe('ProductList', () => {
  it('should render all products', async () => {
    render(ProductList);

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(screen.getByText('Clavier mecanique')).toBeTruthy();
    expect(screen.getByText('Ecran 4K 27"')).toBeTruthy();
  });

  it('should filter by category', async () => {
    const user = userEvent.setup();
    render(ProductList);

    // Attendre le chargement initial
    await screen.findAllByRole('listitem');

    // Filtrer par categorie
    await user.selectOptions(
      screen.getByRole('combobox', { name: /categorie/i }),
      'ecrans',
    );

    // Verifier le filtre
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(screen.getByText('Ecran 4K 27"')).toBeTruthy();
  });

  it('should show "out of stock" badge for unavailable products', async () => {
    render(ProductList);

    await screen.findAllByRole('listitem');

    const outOfStockItem = screen.getByText('Ecran 4K 27"').closest('[role="listitem"]');
    expect(outOfStockItem?.textContent).toContain('Rupture de stock');
  });
});
```

### Pattern 2 : POST — créer une ressource

```typescript
describe('CreateProductForm', () => {
  it('should create a new product and show success', async () => {
    const user = userEvent.setup();
    render(CreateProductForm);

    await user.type(screen.getByLabelText(/nom du produit/i), 'Cable USB-C');
    await user.type(screen.getByLabelText(/prix/i), '19.99');
    await user.selectOptions(screen.getByLabelText(/categorie/i), 'peripheriques');

    await user.click(screen.getByRole('button', { name: /creer/i }));

    // Verifier le message de succes
    expect(await screen.findByText(/produit cree avec succes/i)).toBeTruthy();
  });

  it('should display validation error from server', async () => {
    server.use(
      http.post('/api/products', () => {
        return HttpResponse.json(
          { error: 'Product name already exists' },
          { status: 409 },
        );
      }),
    );

    const user = userEvent.setup();
    render(CreateProductForm);

    await user.type(screen.getByLabelText(/nom du produit/i), 'Clavier mecanique');
    await user.type(screen.getByLabelText(/prix/i), '99.99');
    await user.click(screen.getByRole('button', { name: /creer/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /ce nom de produit existe deja/i,
    );
  });
});
```

### Pattern 3 : Optimistic update

```typescript
describe('TodoItem — optimistic update', () => {
  it('should toggle todo immediately and revert on error', async () => {
    const user = userEvent.setup();

    // Handler initial : le todo est non complete
    server.use(
      http.get('/api/todos/1', () => {
        return HttpResponse.json({
          id: '1',
          title: 'Ecrire des tests',
          completed: false,
        });
      }),
    );

    render(TodoItem, { props: { todoId: '1' } });

    const checkbox = await screen.findByRole('checkbox', { name: /ecrire des tests/i });
    expect(checkbox).not.toBeChecked();

    // Le PATCH va echouer
    server.use(
      http.patch('/api/todos/1', () => {
        return HttpResponse.json(
          { error: 'Server error' },
          { status: 500 },
        );
      }),
    );

    // Cliquer pour cocher (optimistic update)
    await user.click(checkbox);

    // Immediatement coche (optimistic)
    expect(checkbox).toBeChecked();

    // Apres l'erreur, revient a non-coche (revert)
    await waitFor(() => {
      expect(checkbox).not.toBeChecked();
    });

    // Message d'erreur
    expect(screen.getByText(/impossible de mettre a jour/i)).toBeTruthy();
  });
});
```

### Pattern 4 : Retry

```typescript
describe('API retry logic', () => {
  it('should retry failed request and succeed on second attempt', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/data', () => {
        requestCount++;
        if (requestCount === 1) {
          return HttpResponse.json({ error: 'Temporary error' }, { status: 503 });
        }
        return HttpResponse.json({ value: 42 });
      }),
    );

    render(DataDisplay);

    // Apres retry automatique, les donnees doivent s'afficher
    expect(await screen.findByText('42')).toBeTruthy();
    expect(requestCount).toBe(2);
  });
});
```

### Pattern 5 : Pagination

```typescript
describe('PaginatedList', () => {
  it('should load next page on click', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/items', ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? '1');

        const allItems = Array.from({ length: 25 }, (_, i) => ({
          id: i + 1,
          name: `Item ${i + 1}`,
        }));

        const perPage = 10;
        const start = (page - 1) * perPage;
        const items = allItems.slice(start, start + perPage);

        return HttpResponse.json({
          items,
          page,
          totalPages: 3,
          total: 25,
        });
      }),
    );

    render(PaginatedList);

    // Page 1 : items 1-10
    const firstPageItems = await screen.findAllByRole('listitem');
    expect(firstPageItems).toHaveLength(10);
    expect(screen.getByText('Item 1')).toBeTruthy();

    // Cliquer sur "Page suivante"
    await user.click(screen.getByRole('button', { name: /suivante/i }));

    // Page 2 : items 11-20
    await waitFor(() => {
      expect(screen.getByText('Item 11')).toBeTruthy();
    });
    expect(screen.queryByText('Item 1')).toBeNull();
  });

  it('should disable next button on last page', async () => {
    server.use(
      http.get('/api/items', () => {
        return HttpResponse.json({
          items: [{ id: 21, name: 'Item 21' }],
          page: 3,
          totalPages: 3,
          total: 25,
        });
      }),
    );

    render(PaginatedList, { props: { initialPage: 3 } });

    await screen.findByText('Item 21');
    expect(screen.getByRole('button', { name: /suivante/i })).toBeDisabled();
  });
});
```

---

## Exemple complet : API CRUD avec handlers et tests

```typescript
// src/mocks/fixtures/articles.ts
export interface Article {
  id: string;
  title: string;
  content: string;
  author: string;
  publishedAt: string;
  tags: string[];
}

export const mockArticles: Article[] = [
  {
    id: 'a1',
    title: 'Introduction a TypeScript',
    content: 'TypeScript est un surensemble de JavaScript...',
    author: 'Alice Martin',
    publishedAt: '2025-01-15T10:00:00Z',
    tags: ['typescript', 'javascript'],
  },
  {
    id: 'a2',
    title: 'Les tests en pratique',
    content: 'Tester son code est essentiel...',
    author: 'Bob Dupont',
    publishedAt: '2025-02-20T14:30:00Z',
    tags: ['testing', 'vitest'],
  },
];
```

```typescript
// src/mocks/handlers/articleHandlers.ts
import { http, HttpResponse, delay } from 'msw';
import { mockArticles, type Article } from '../fixtures/articles';

let articles = [...mockArticles];

export const articleHandlers = [
  // LIST
  http.get('/api/articles', async ({ request }) => {
    await delay(100);
    const url = new URL(request.url);
    const tag = url.searchParams.get('tag');

    let result = [...articles];
    if (tag) {
      result = result.filter((a) => a.tags.includes(tag));
    }

    return HttpResponse.json({ articles: result, total: result.length });
  }),

  // GET by ID
  http.get('/api/articles/:id', async ({ params }) => {
    await delay(100);
    const article = articles.find((a) => a.id === params.id);

    if (!article) {
      return HttpResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    return HttpResponse.json(article);
  }),

  // CREATE
  http.post('/api/articles', async ({ request }) => {
    await delay(200);
    const body = await request.json() as Omit<Article, 'id' | 'publishedAt'>;

    if (!body.title || !body.content) {
      return HttpResponse.json(
        { error: 'Title and content are required' },
        { status: 400 },
      );
    }

    const newArticle: Article = {
      id: `a${articles.length + 1}`,
      title: body.title,
      content: body.content,
      author: body.author ?? 'Anonymous',
      publishedAt: new Date().toISOString(),
      tags: body.tags ?? [],
    };

    articles.push(newArticle);
    return HttpResponse.json(newArticle, { status: 201 });
  }),

  // UPDATE
  http.put('/api/articles/:id', async ({ params, request }) => {
    await delay(200);
    const body = await request.json() as Partial<Article>;
    const index = articles.findIndex((a) => a.id === params.id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    articles[index] = { ...articles[index], ...body, id: String(params.id) };
    return HttpResponse.json(articles[index]);
  }),

  // DELETE
  http.delete('/api/articles/:id', async ({ params }) => {
    await delay(100);
    const index = articles.findIndex((a) => a.id === params.id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    articles.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

// Helper pour reinitialiser les donnees entre les tests
export function resetArticles(): void {
  articles = [...mockArticles];
}
```

```typescript
// src/features/articles/__tests__/ArticleList.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { resetArticles } from '../../../mocks/handlers/articleHandlers';
import ArticleList from '../ArticleList.vue';

describe('ArticleList', () => {
  beforeEach(() => {
    resetArticles();
  });

  it('should display all articles', async () => {
    render(ArticleList);

    expect(await screen.findByText('Introduction a TypeScript')).toBeTruthy();
    expect(screen.getByText('Les tests en pratique')).toBeTruthy();
  });

  it('should filter articles by tag', async () => {
    const user = userEvent.setup();
    render(ArticleList);

    await screen.findByText('Introduction a TypeScript');

    await user.click(screen.getByRole('button', { name: /typescript/i }));

    await waitFor(() => {
      expect(screen.getByText('Introduction a TypeScript')).toBeTruthy();
      expect(screen.queryByText('Les tests en pratique')).toBeNull();
    });
  });

  it('should handle delete with confirmation', async () => {
    const user = userEvent.setup();
    render(ArticleList);

    await screen.findByText('Introduction a TypeScript');

    // Cliquer sur le bouton supprimer du premier article
    const deleteButtons = screen.getAllByRole('button', { name: /supprimer/i });
    await user.click(deleteButtons[0]);

    // Confirmer la suppression
    await user.click(screen.getByRole('button', { name: /confirmer/i }));

    // L'article doit disparaitre
    await waitFor(() => {
      expect(screen.queryByText('Introduction a TypeScript')).toBeNull();
    });

    // L'autre article est toujours la
    expect(screen.getByText('Les tests en pratique')).toBeTruthy();
  });

  it('should show error toast on delete failure', async () => {
    server.use(
      http.delete('/api/articles/:id', () => {
        return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
      }),
    );

    const user = userEvent.setup();
    render(ArticleList);

    await screen.findByText('Introduction a TypeScript');

    const deleteButtons = screen.getAllByRole('button', { name: /supprimer/i });
    await user.click(deleteButtons[0]);
    await user.click(screen.getByRole('button', { name: /confirmer/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /impossible de supprimer/i,
    );

    // L'article est toujours present
    expect(screen.getByText('Introduction a TypeScript')).toBeTruthy();
  });
});
```

---

## Bonnes pratiques

1. **Handlers par defaut = happy path** : les handlers dans `handlers.ts` representent le scenario nominal
2. **Overrides per-test pour les erreurs** : utiliser `server.use()` pour les cas d'erreur, pas les handlers par defaut
3. **`onUnhandledRequest: 'error'`** : détecter les appels API non prévus
4. **Fixtures typees** : utiliser les memes interfaces TypeScript que le code de production
5. **`resetHandlers()` dans `afterEach`** : garantir l'isolation entre tests
6. **Pas de logique metier dans les handlers** : garder les handlers simples, pas de vraie base de donnees
7. **Organiser par domaine** : un fichier de handlers par feature (`userHandlers.ts`, `productHandlers.ts`)
8. **Tester les headers** : vérifier que les tokens d'authentification sont envoyes
9. **Utiliser `delay()` avec parcimonie** : seulement quand on teste le loading state
10. **`once: true`** pour les scenarios de retry : le premier appel echoue, le suivant reussit

---

## Exercice pratique

Implementez les handlers MSW et les tests pour une API de gestion de taches (todos) :
- `GET /api/todos` — lister toutes les taches (avec filtre `?status=completed`)
- `POST /api/todos` — créer une tache
- `PATCH /api/todos/:id` — mettre a jour le statut
- `DELETE /api/todos/:id` — supprimer une tache

Tests à écrire :
1. Afficher la liste des taches
2. Créer une nouvelle tache (happy path + erreur validation)
3. Cocher/decocher une tache (optimistic update + revert on error)
4. Supprimer une tache (avec confirmation)

> Solution dans le [Lab 08](../labs/lab-08-msw/)

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [07 - Tests de composants](./07-tests-de-composants) | [09 - Tests d'intégration](./09-tests-integration) |

---

## Ressources

- [Quiz 08 : Testez vos connaissances](../quizzes/quiz-08-msw.html)
- [Lab 08 : MSW en pratique](../labs/lab-08-msw/)
- MSW — [Documentation officielle](https://mswjs.io/docs/)
- MSW — [Getting Started](https://mswjs.io/docs/getting-started)
- MSW — [Network behavior](https://mswjs.io/docs/concepts/request-handler)
- Kent C. Dodds — [Stop mocking fetch](https://kentcdodds.com/blog/stop-mocking-fetch)
- Artem Zakharchenko — [Thinking in MSW](https://mswjs.io/docs/philosophy)

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 08 msw](../screencasts/screencast-08-msw.md)
2. **Lab** : [lab-08-msw](../labs/lab-08-msw/README)
3. **Quiz** : [quiz 08 msw](../quizzes/quiz-08-msw.html)
:::
