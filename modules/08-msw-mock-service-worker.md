---
titre: MSW — Mock Service Worker
cours: 06-testing
notions: [interception réseau vs mock de fetch, handlers http get post, setupServer pour les tests, HttpResponse et réponses dynamiques, erreurs et latence delay, override de handler par test, resetHandlers lifecycle, MSW en dev avec setupWorker]
outcomes: [mocker une API au niveau réseau avec MSW 2, brancher setupServer dans Vitest avec le bon lifecycle, simuler erreurs et latence, overrider un handler pour un test précis]
prerequis: [07-tests-de-composants]
next: 09-tests-integration
libs: [{ name: vitest, version: ^4.1.9 }, { name: msw, version: ^2 }]
tribuzen: mocker l'API famille/invitation TribuZen avec MSW pour tester le front sans backend réel
last-reviewed: 2026-07
---

# MSW — Mock Service Worker

> **Outcomes — tu sauras FAIRE :** mocker une API REST au niveau réseau avec MSW 2 (`http`/`HttpResponse`), brancher `setupServer` dans Vitest avec le bon lifecycle, simuler erreurs HTTP et latence, et overrider un handler pour un seul test.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, le composant `InvitationList` fait un appel `GET /api/invitations?familyId=fam-1` pour afficher les invitations en attente. Le backend n'est pas encore prêt. La tentation : mocker `fetch` à la main avec `vi.stubGlobal('fetch', vi.fn())`. Le problème : le test devient couplé à la **fonction** `fetch` elle-même — si tu changes de client HTTP (axios, ky, wretch), le test casse sans que le comportement ait changé. Et si l'URL est mal construite, le mock ne le voit pas.

```typescript
// src/api/invitationApi.ts — le code à tester (ne pas toucher)
export interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  familyId: string;
}

export async function fetchInvitations(familyId: string): Promise<Invitation[]> {
  const res = await fetch(`/api/invitations?familyId=${familyId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

Question centrale : comment tester `fetchInvitations` sans backend réel et sans mocker `fetch` ? Réponse : **MSW intercepte au niveau réseau**, sous `fetch`, sous axios, sous tout client HTTP. Le vrai `fetch` s'exécute — l'URL est réellement construite — et MSW renvoie une réponse simulée à la couche réseau.

## 2. Théorie complète, concise

### Interception réseau vs mock de fetch

`vi.stubGlobal('fetch', vi.fn())` remplace la **fonction** `fetch`. Le code de construction de la requête (URL, headers, body) ne s'exécute plus. Si l'URL est mal formée ou si un header d'auth est oublié, le test reste vert.

MSW intercepte **en aval** de `fetch` et d'axios, au niveau du module `http`/`https` de Node (en test) ou d'un Service Worker (en navigateur). Le vrai `fetch` s'exécute ; MSW intercepte la requête sortante et renvoie une réponse simulée. Le code de production est entièrement exercé.

| Critère | `vi.stubGlobal('fetch')` | MSW |
|---------|--------------------------|-----|
| Niveau | Remplacement de `fetch` | Couche réseau |
| Vrai `fetch` exécuté | Non | Oui |
| URL/headers vérifiés | Non | Oui |
| Agnostique du client HTTP | Non | Oui |
| Réutilisable navigateur/Node | Non | Oui |

### Handlers — `http.get` / `http.post`

Un handler MSW associe une méthode + une URL pattern à un **résolveur** qui renvoie une `HttpResponse`.

```typescript
import { http, HttpResponse } from 'msw';

http.get('/api/invitations', ({ request }) => {
  const url = new URL(request.url);
  const familyId = url.searchParams.get('familyId');
  return HttpResponse.json([
    { id: 'inv-1', email: 'bob@tribu.fr', status: 'pending', familyId },
  ]);
});
```

Le résolveur reçoit `{ request, params, cookies }` :
- `request` — `Request` standard Fetch API (headers, body, url, method)
- `params` — path params extraits du pattern (`:id` → `params.id`)
- `cookies` — cookies de la requête

`HttpResponse.json(data, init?)` construit une réponse JSON avec `Content-Type: application/json`. `init` accepte `{ status, statusText, headers }`.

```typescript
// Status personnalisé
HttpResponse.json({ error: 'Not found' }, { status: 404 });

// Headers personnalisés
HttpResponse.json(data, {
  status: 200,
  headers: { 'X-Total-Count': '42' },
});
```

### `setupServer` + lifecycle dans Vitest

`setupServer` (importé de `msw/node`) crée le serveur d'interception pour Node.js :

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

Le **lifecycle** est canonique et non négociable :

```typescript
// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { setupFiles: ['./vitest.setup.ts'] },
});
```

Pourquoi chaque hook ?
- `beforeAll` / `server.listen()` — active l'interception avant la suite
- `afterEach` / `server.resetHandlers()` — retire les overrides per-test (`server.use(...)`), les handlers de base restent
- `afterAll` / `server.close()` — coupe l'interception proprement

`onUnhandledRequest: 'error'` : tout appel réseau sans handler lève une erreur — détecte les appels imprévus avant qu'ils ne passent en production.

### Réponses dynamiques

Le résolveur lit la requête et répond de façon dynamique :

```typescript
// Path params
http.get('/api/invitations/:id', ({ params }) => {
  const { id } = params; // string | string[]
  if (id === 'inv-missing') {
    return HttpResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return HttpResponse.json({ id, email: 'bob@tribu.fr', status: 'pending' });
});

// Query params
http.get('/api/invitations', ({ request }) => {
  const url = new URL(request.url);
  const familyId = url.searchParams.get('familyId') ?? 'unknown';
  return HttpResponse.json([{ id: 'inv-1', email: 'bob@tribu.fr', familyId }]);
});

// Body POST
http.post('/api/invitations', async ({ request }) => {
  const body = await request.json() as { email: string; familyId: string };
  if (!body.email) {
    return HttpResponse.json({ error: 'email required' }, { status: 400 });
  }
  return HttpResponse.json(
    { id: 'inv-new', ...body, status: 'pending' },
    { status: 201 },
  );
});
```

### `HttpResponse.error()` vs status HTTP d'erreur

Distinction critique :

- `HttpResponse.error()` — **panne réseau** : la connexion échoue. Le `Promise` de `fetch` **rejette** avec `TypeError: Failed to fetch`. Simule un serveur injoignable, une coupure réseau.
- `HttpResponse.json({}, { status: 500 })` — **réponse HTTP** avec code d'erreur : le réseau fonctionne, le serveur répond. `fetch` **résout** avec `res.ok === false`. Il faut tester `res.ok` pour détecter l'erreur.

```typescript
// Panne réseau — fetch rejette (TypeError)
http.get('/api/invitations', () => HttpResponse.error());

// Erreur serveur — fetch résout, res.ok === false
http.get('/api/invitations', () =>
  HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
);
```

### Latence simulée — `delay`

```typescript
import { http, HttpResponse, delay } from 'msw';

// Latence fixe
http.get('/api/invitations', async () => {
  await delay(300); // 300 ms
  return HttpResponse.json([]);
});

// Latence réaliste aléatoire (~100-500ms)
http.get('/api/invitations', async () => {
  await delay();
  return HttpResponse.json([]);
});

// Répond jamais (tester un timeout)
http.get('/api/invitations', async () => {
  await delay('infinite');
  return HttpResponse.json([]); // jamais atteint
});
```

`delay` est utile pour tester un état de chargement (`loading spinner`) ou un comportement de timeout. À utiliser avec parcimonie dans les handlers de base pour ne pas ralentir la suite de tests.

### Override per-test — `server.use()`

`server.use(handler)` **préfixe** la liste des handlers : la version per-test est consultée en premier. Après `afterEach(() => server.resetHandlers())`, l'override est retiré et le handler de base reprend.

```typescript
it('affiche une erreur réseau', () => {
  server.use(
    http.get('/api/invitations', () => HttpResponse.error()),
  );
  // … le handler de base ne s'applique pas ici
});

it('affiche un état vide', () => {
  server.use(
    http.get('/api/invitations', () => HttpResponse.json([])),
  );
  // …
});
// afterEach → resetHandlers() : les deux overrides sont retirés
```

Option `{ once: true }` : le handler s'active une seule fois puis cède au suivant. Utile pour les scénarios de retry.

```typescript
server.use(
  http.get('/api/invitations', () =>
    HttpResponse.json({ error: 'temp' }, { status: 503 }),
  { once: true }),
);
// 1er appel → 503 ; 2e appel → handler de base
```

### `setupWorker` en dev navigateur

En environnement navigateur (dev local, Storybook), MSW utilise un Service Worker enregistré dans `public/` :

```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

```typescript
// src/main.ts — activation conditionnelle uniquement en dev
async function enableMocking() {
  if (import.meta.env.MODE !== 'development') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

enableMocking().then(() => createApp(App).mount('#app'));
```

```bash
# Générer le service worker dans public/
npx msw init ./public --save
```

Les **mêmes `handlers`** alimentent `setupServer` (tests) et `setupWorker` (dev) — pas de duplication.

| | `setupServer` (Node) | `setupWorker` (Navigateur) |
|--|--|--|
| Usage | Vitest, tests | Dev local, Storybook |
| Mécanisme | Interception `http`/`https` Node | Service Worker |
| Fichier SW requis | Non | Oui (`public/mockServiceWorker.js`) |
| Network DevTools | Non | Oui |

## 3. Worked examples

### Exemple A — brancher MSW dans Vitest pour l'API invitation TribuZen

Objectif : tester `fetchInvitations` avec des handlers MSW — pas de backend réel, vrai `fetch` exécuté.

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/invitations', ({ request }) => {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId') ?? 'unknown';

    return HttpResponse.json([
      { id: 'inv-1', email: 'bob@tribu.fr',   status: 'pending',  familyId },
      { id: 'inv-2', email: 'alice@tribu.fr', status: 'accepted', familyId },
    ]);
  }),

  http.post('/api/invitations', async ({ request }) => {
    const body = await request.json() as { email: string; familyId: string };

    if (!body.email || !body.familyId) {
      return HttpResponse.json({ error: 'email and familyId required' }, { status: 400 });
    }

    return HttpResponse.json(
      { id: 'inv-new', email: body.email, status: 'pending', familyId: body.familyId },
      { status: 201 },
    );
  }),
];
```

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```typescript
// src/api/invitationApi.test.ts
import { describe, it, expect } from 'vitest';
import { fetchInvitations } from './invitationApi';

describe('fetchInvitations', () => {
  it('retourne la liste des invitations pour une famille', async () => {
    const invitations = await fetchInvitations('fam-1');

    expect(invitations).toHaveLength(2);
    expect(invitations[0]).toMatchObject({
      email: 'bob@tribu.fr',
      status: 'pending',
    });
  });
});
```

Pas-à-pas : (1) les handlers de base couvrent le happy path — pas de `server.use` dans les tests nominaux ; (2) `onUnhandledRequest: 'error'` détecte tout appel réseau sans handler (protection contre les oublis) ; (3) le vrai `fetch` s'exécute — l'URL `/api/invitations?familyId=fam-1` est réellement construite et interceptée par MSW ; (4) les types sont partagés avec le code de production.

### Exemple B — override per-test pour les cas d'erreur

Tester les branches d'erreur sans polluer les handlers de base.

```typescript
// src/api/invitationApi.test.ts (suite)
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

describe('fetchInvitations — cas d\'erreur', () => {
  it('rejette sur panne réseau (TypeError)', async () => {
    // Override pour CE test : panne réseau totale
    server.use(
      http.get('/api/invitations', () => HttpResponse.error()),
    );
    // fetch rejette avec TypeError: Failed to fetch
    await expect(fetchInvitations('fam-1')).rejects.toThrow();
  });

  it('rejette sur erreur serveur HTTP 500', async () => {
    // Override : réponse HTTP 500 — fetch résout, res.ok === false
    server.use(
      http.get('/api/invitations', () =>
        HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
      ),
    );
    // fetchInvitations teste res.ok et lance l'erreur métier
    await expect(fetchInvitations('fam-1')).rejects.toThrow('HTTP 500');
  });

  it('après les overrides, le handler de base est restauré', async () => {
    // Preuve que resetHandlers() a nettoyé les deux overrides ci-dessus
    const invitations = await fetchInvitations('fam-1');
    expect(invitations).toHaveLength(2);
  });
});
```

Pas-à-pas : (1) `server.use()` préfixe la liste — le handler de base ne répond pas pendant ce test ; (2) `HttpResponse.error()` simule une panne réseau, le `Promise` de `fetch` rejette ; (3) le handler 500 simule un serveur défaillant — `fetchInvitations` doit détecter `!res.ok` et rejeter ; (4) le troisième test prouve que `afterEach(() => server.resetHandlers())` a bien nettoyé les deux overrides.

## 4. Pièges & misconceptions

- **Mocker `fetch` à la main (`vi.stubGlobal`).** Le code de construction de la requête ne s'exécute pas. Si l'URL contient une faute, si un header d'auth est oublié ou si le `Content-Type` manque dans le POST, le test reste vert. *Correct* : MSW intercepte après `fetch` — l'URL et les headers sont réellement construits et visibles dans `request`.

- **Oublier `resetHandlers()` en `afterEach`.** Les overrides ajoutés via `server.use()` persistent pour les tests suivants. Le test A passe en isolation mais échoue quand il suit le test B qui a ajouté un override d'erreur. *Correct* : `afterEach(() => server.resetHandlers())` dans `vitest.setup.ts` — global, systématique, pas à redéclarer dans chaque describe.

- **Handler trop rigide sur l'URL.** Un handler `http.get('/api/invitations')` matche les URLs relatives en environment jsdom/happy-dom. En Node pur sans base URL configurée, il peut falloir une URL absolue. Si le test retourne une requête non interceptée et que `onUnhandledRequest: 'error'` est actif, on le voit immédiatement. *Correct* : tester avec `onUnhandledRequest: 'error'` pour détecter les mismatches tôt.

- **Confondre `HttpResponse.error()` et un status 5xx.** `HttpResponse.error()` = panne réseau, `fetch` **rejette** (il faut un `try/catch`). Status 500 = réponse HTTP valide, `fetch` **résout** avec `res.ok === false` (il faut vérifier `res.ok`). La gestion côté client est différente. *Correct* : utiliser `HttpResponse.error()` pour tester les `catch` réseau, status 5xx pour tester la gestion de `!res.ok`.

- **Utiliser l'API MSW v1 (`rest`, `ctx.json`).** L'API v1 était `rest.get(url, (req, res, ctx) => res(ctx.json(data)))`. Elle est **supprimée** en MSW v2. *Correct* : `http.get(url, () => HttpResponse.json(data))` — les résolveurs renvoient directement une `Response` ou `HttpResponse`.

## 5. Ancrage TribuZen

Couche fil-rouge : **mocker l'API famille/invitation TribuZen avec MSW pour tester le front sans backend réel** (`smaurier/tribuzen`).

- `GET /api/invitations?familyId=…` — handler de base dans `src/mocks/handlers.ts` : retourne la liste des invitations en attente/acceptées pour une famille. `InvitationList.vue` s'appuie dessus pour ses tests de composants (module 07 testait le composant isolé avec des props ; module 08 teste le composant avec l'appel réseau réel intercepté).
- `POST /api/invitations` — handler avec validation du body (email + familyId obligatoires). Testé avec `server.use()` pour le cas 400 (email manquant) et 409 (déjà invité).
- En dev local, la même configuration `src/mocks/handlers.ts` + `src/mocks/browser.ts` alimente `setupWorker` : le front TribuZen démarre avec `npm run dev` et toutes les routes invitation/famille répondent via MSW Service Worker, sans backend démarré.
- Les handlers partagent les types TypeScript de production (`Invitation`, `Family`) — pas de drift entre le mock et le vrai contrat d'API.

## 6. Points clés

1. MSW intercepte au niveau réseau, sous `fetch` et axios : le vrai code client s'exécute, l'URL et les headers sont réellement construits.
2. En MSW v2 : `import { http, HttpResponse, delay } from 'msw'` — pas de `rest`, pas de `ctx.json`.
3. Un handler = `http.<méthode>(pattern, résolveur)` ; le résolveur reçoit `{ request, params, cookies }` et renvoie `HttpResponse.json(data, init?)`.
4. `setupServer` (import `msw/node`) pour les tests Node/Vitest ; `setupWorker` (import `msw/browser`) pour le dev navigateur via Service Worker.
5. Lifecycle canonique Vitest : `beforeAll(() => server.listen())` / `afterEach(() => server.resetHandlers())` / `afterAll(() => server.close())`.
6. `server.use(handler)` préfixe les handlers pour le test courant ; `resetHandlers()` retire les overrides, les handlers de base restent.
7. `HttpResponse.error()` = panne réseau (TypeError, fetch rejette) ; status 5xx = réponse HTTP d'erreur (fetch résout, `res.ok === false`).
8. `delay(ms | undefined | 'infinite')` simule la latence ; `{ once: true }` active un handler une seule fois (pattern retry).

## 7. Seeds Anki

```
Pourquoi MSW est préférable à vi.stubGlobal('fetch') ?|MSW intercepte au niveau réseau — le vrai fetch s'exécute et l'URL/headers sont construits. vi.stubGlobal remplace fetch et ne teste pas le code de construction de la requête.
Quelle est la syntaxe MSW v2 pour un handler GET qui renvoie du JSON ?|http.get('/url', () => HttpResponse.json(data)) — import { http, HttpResponse } from 'msw'
Quel est le lifecycle MSW canonique dans Vitest ?|beforeAll(() => server.listen()) / afterEach(() => server.resetHandlers()) / afterAll(() => server.close())
À quoi sert server.resetHandlers() en afterEach ?|Retirer les handlers ajoutés via server.use() pendant le test courant, pour éviter la pollution entre tests. Les handlers de base restent intacts.
Différence entre HttpResponse.error() et HttpResponse.json({}, { status: 500 }) ?|error() simule une panne réseau — fetch rejette (TypeError). status 500 est une réponse HTTP — fetch résout avec res.ok === false.
Comment overrider un handler pour un seul test en MSW 2 ?|server.use(http.get('/url', () => HttpResponse.json(...))); resetHandlers() en afterEach retire l'override automatiquement.
Comment simuler 300ms de latence dans un handler MSW 2 ?|import { delay } from 'msw', puis await delay(300) dans le résolveur avant de retourner HttpResponse.json(...)
Différence setupServer vs setupWorker ?|setupServer (msw/node) pour les tests Node/Vitest ; setupWorker (msw/browser) pour le dev navigateur via Service Worker.
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-08-msw/`. Tu y câbles `setupServer` dans Vitest, écris les handlers invitation TribuZen (`http.get`, `http.post`), et testes les cas nominal, 500, erreur réseau et override per-test — en **MSW 2 réel**. Corrigé complet commenté + variante J+30 dans le README du lab.
