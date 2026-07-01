# Lab 08 — MSW 2 : intercepter l'API famille/invitation TribuZen

> **Outcome :** à la fin, tu sais câbler MSW 2 (`http`/`HttpResponse`, `setupServer`) dans Vitest, écrire des handlers GET et POST, simuler des erreurs HTTP et réseau, et overrider un handler pour un test précis — avec le **vrai MSW 2**, pas un harnais simulé.
> **Vrai outil :** MSW 2 (`http`, `HttpResponse`, `delay`, `setupServer` depuis `msw/node`) + Vitest. Aucun `vi.stubGlobal('fetch')`.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Dans TribuZen, le composant `InvitationList` déclenche des appels réseau vers `/api/invitations`. Le backend n'est pas encore prêt. Tu vas intercepter ces appels avec MSW 2 au niveau réseau — le vrai `fetch` s'exécute, l'URL est réellement construite, MSW répond à la place du serveur.

Code de départ (**ne pas modifier** — tu écris uniquement les mocks et les tests) :

```typescript
// src/api/invitationApi.ts
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

export async function sendInvitation(familyId: string, email: string): Promise<Invitation> {
  const res = await fetch('/api/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyId, email }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

Ta mission : créer `src/mocks/handlers.ts`, `src/mocks/server.ts`, `vitest.setup.ts`, et `src/api/invitationApi.test.ts` pour couvrir tous les cas ci-dessous.

## Étapes (en friction)

1. **Handlers de base.** Crée `src/mocks/handlers.ts` avec deux handlers :
   - `http.get('/api/invitations', ...)` — lit le query param `familyId` depuis `request.url` et renvoie un tableau de 2 invitations (bob + alice) avec ce `familyId`. Status 200.
   - `http.post('/api/invitations', ...)` — lit le body (`await request.json()`), si `email` ou `familyId` manquent renvoie 400 ; sinon renvoie l'invitation créée avec `id: 'inv-new'` et `status: 'pending'`, status 201.

2. **Câbler le serveur.** Crée `src/mocks/server.ts` avec `setupServer(...handlers)`. Crée `vitest.setup.ts` avec le lifecycle canonique (`beforeAll` / `afterEach` / `afterAll`). Passe `{ onUnhandledRequest: 'error' }` à `server.listen()`. Ajoute `setupFiles: ['./vitest.setup.ts']` dans `vitest.config.ts`. À ce stade, un test vide doit passer sans erreur.

3. **Cas nominal GET.** Écris un test `fetchInvitations('fam-1')` : assert que le tableau a exactement 2 éléments, que le premier a `email: 'bob@tribu.fr'` et `status: 'pending'`, et que `familyId` est bien `'fam-1'` (preuve que l'URL a été réellement construite et que MSW a lu le query param).

4. **Override erreurs — `server.use()`.** Écris deux tests avec `server.use()` :
   - Override `HttpResponse.error()` → assert que `fetchInvitations` rejette (TypeError réseau — `fetch` rejette, pas `res.ok`).
   - Override `HttpResponse.json({...}, { status: 500 })` → assert que `fetchInvitations` rejette avec le message `'HTTP 500'`.
   Discrimine à voix haute : pourquoi l'assertion n'est pas la même pour les deux cas ?

5. **Cas nominal POST.** Teste `sendInvitation('fam-1', 'carol@tribu.fr')` : assert que la réponse a `id: 'inv-new'`, `email: 'carol@tribu.fr'`, `status: 'pending'`, `familyId: 'fam-1'`.

6. **Override 400 POST + restauration.** Override le handler POST pour renvoyer 400 (email manquant) ; assert `sendInvitation` rejette `'HTTP 400'`. Puis écris un test **sans override** qui prouve que `afterEach(() => server.resetHandlers())` a restauré le handler nominal (POST retourne à nouveau 201).

## Corrigé complet commenté

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';
import type { Invitation } from '../api/invitationApi';

export const handlers = [
  // Handler GET — intercepte /api/invitations?familyId=...
  // Le vrai fetch s'exécute : l'URL est construite côté client,
  // MSW lit request.url pour extraire le query param.
  http.get('/api/invitations', ({ request }) => {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId') ?? 'unknown';

    const invitations: Invitation[] = [
      { id: 'inv-1', email: 'bob@tribu.fr',   status: 'pending',  familyId },
      { id: 'inv-2', email: 'alice@tribu.fr', status: 'accepted', familyId },
    ];
    return HttpResponse.json(invitations);
    // HttpResponse.json = Content-Type: application/json + status 200 par défaut
  }),

  // Handler POST — intercepte POST /api/invitations
  // request.json() lit le body — le vrai Content-Type header est vérifié par MSW.
  http.post('/api/invitations', async ({ request }) => {
    const body = await request.json() as { email?: string; familyId?: string };

    // Validation métier : email et familyId obligatoires
    if (!body.email || !body.familyId) {
      return HttpResponse.json(
        { error: 'email and familyId required' },
        { status: 400 },
      );
    }

    // Simule une latence réaliste en dev — ici commenté pour ne pas
    // ralentir la suite de tests. À activer ponctuellement avec delay(200).
    // await delay(200);

    const created: Invitation = {
      id: 'inv-new',
      email: body.email,
      status: 'pending',
      familyId: body.familyId,
    };
    return HttpResponse.json(created, { status: 201 });
  }),
];
```

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
// setupServer crée un serveur d'interception Node.js (http/https).
// Pas de Service Worker ici : on est dans Vitest (Node), pas dans un navigateur.
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/mocks/server';

// Lifecycle canonique MSW — non négociable, dans cet ordre.
beforeAll(() =>
  server.listen({
    // 'error' : tout appel réseau sans handler MSW lève une erreur immédiatement.
    // Détecte les oublis de handler avant qu'ils n'arrivent en prod.
    onUnhandledRequest: 'error',
  }),
);

// CRITIQUE : retire les overrides ajoutés via server.use() dans chaque test.
// Les handlers de BASE (handlers.ts) restent actifs.
// Sans ce hook, un override dans le test A pollue le test B.
afterEach(() => server.resetHandlers());

// Coupe l'interception proprement après toute la suite.
afterAll(() => server.close());
```

```typescript
// vitest.config.ts (extrait)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // setupFiles s'exécute une fois par fichier de test, avant les imports.
    // Cela garantit que server.listen() est appelé avant tout describe/it.
    setupFiles: ['./vitest.setup.ts'],
    environment: 'node', // ou 'jsdom' si tu testes des composants Vue
  },
});
```

```typescript
// src/api/invitationApi.test.ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { fetchInvitations, sendInvitation } from './invitationApi';

// ─── GET /api/invitations — cas nominal ──────────────────────────────────────

describe('fetchInvitations', () => {
  it('retourne 2 invitations pour fam-1 (handler de base)', async () => {
    const result = await fetchInvitations('fam-1');

    // Le tableau provient du handler GET qui lit familyId depuis l'URL.
    expect(result).toHaveLength(2);

    // Preuve que l'URL `/api/invitations?familyId=fam-1` a été réellement
    // construite côté client ET que MSW a lu le query param :
    // si fetchInvitations avait mal construit l'URL, familyId serait 'unknown'.
    expect(result[0]).toMatchObject({
      email: 'bob@tribu.fr',
      status: 'pending',
      familyId: 'fam-1',
    });
    expect(result[1]).toMatchObject({
      email: 'alice@tribu.fr',
      status: 'accepted',
      familyId: 'fam-1',
    });
  });

  // ─── Erreur réseau (panne totale) ───────────────────────────────────────────

  it('rejette sur panne réseau — HttpResponse.error()', async () => {
    // server.use() PRÉFIXE la liste : ce handler est consulté EN PREMIER.
    // Le handler de base GET ne répond pas pendant CE test.
    server.use(
      http.get('/api/invitations', () => HttpResponse.error()),
      // HttpResponse.error() = panne réseau : la connexion échoue.
      // fetch() REJETTE avec TypeError: Failed to fetch.
      // fetchInvitations ne voit jamais res.ok — c'est le catch réseau qui s'active.
    );

    // On n'assert pas un message précis car le message TypeError est spécifique
    // à l'environnement (Node vs jsdom). On vérifie juste que ça rejette.
    await expect(fetchInvitations('fam-1')).rejects.toThrow();
  });

  // ─── Erreur serveur HTTP 500 ─────────────────────────────────────────────────

  it('rejette sur HTTP 500 avec le bon message', async () => {
    server.use(
      http.get('/api/invitations', () =>
        // HttpResponse.json({}, { status: 500 }) = réponse HTTP VALIDE avec code 500.
        // fetch() RÉSOUT (Promise ne rejette PAS) avec res.ok === false.
        // C'est fetchInvitations qui teste !res.ok et lance l'erreur métier.
        // DIFFÉRENCE CLÉ vs HttpResponse.error() : ici le réseau fonctionne.
        HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      ),
    );

    await expect(fetchInvitations('fam-1')).rejects.toThrow('HTTP 500');
  });

  // ─── Preuve de restauration après les overrides ──────────────────────────────

  it('le handler de base est restauré après les overrides (resetHandlers)', async () => {
    // afterEach(() => server.resetHandlers()) a retiré les deux overrides
    // des tests précédents. Le handler GET nominal répond à nouveau.
    const result = await fetchInvitations('fam-1');
    expect(result).toHaveLength(2);
  });
});

// ─── POST /api/invitations — cas nominal ─────────────────────────────────────

describe('sendInvitation', () => {
  it('crée une invitation et retourne 201 (handler de base)', async () => {
    const result = await sendInvitation('fam-1', 'carol@tribu.fr');

    // Le handler POST lit le body : email et familyId sont lus depuis JSON.stringify(...)
    // Si le code omettait Content-Type ou mal-sérialisait le body,
    // MSW verrait un body vide → 400. vi.stubGlobal('fetch') ne l'aurait pas détecté.
    expect(result).toEqual({
      id: 'inv-new',
      email: 'carol@tribu.fr',
      status: 'pending',
      familyId: 'fam-1',
    });
  });

  // ─── Override 400 POST ───────────────────────────────────────────────────────

  it('rejette sur HTTP 400 (email manquant — override per-test)', async () => {
    server.use(
      // Simule le cas où le client envoie un body invalide.
      // On override le POST pour forcer une réponse 400.
      http.post('/api/invitations', () =>
        HttpResponse.json({ error: 'email required' }, { status: 400 }),
      ),
    );

    // sendInvitation construit toujours un body valide dans ce test,
    // mais le handler override renvoie 400 quoi qu'il arrive.
    await expect(sendInvitation('fam-1', 'carol@tribu.fr')).rejects.toThrow('HTTP 400');
  });

  it('le handler POST de base est restauré après l\'override 400', async () => {
    // Preuve que resetHandlers() en afterEach a nettoyé l'override 400.
    // Le handler nominal (201) répond à nouveau.
    const result = await sendInvitation('fam-1', 'dave@tribu.fr');
    expect(result.status).toBe('pending');
    expect(result.id).toBe('inv-new');
  });

  // ─── Latence simulée (delay) ─────────────────────────────────────────────────

  it('tolère une latence simulée de 200 ms (delay)', async () => {
    server.use(
      http.post('/api/invitations', async ({ request }) => {
        // delay(ms) = Promise wrappée autour de setTimeout.
        // Le test attend réellement 200 ms mais reste déterministe.
        // Utile pour tester un état de chargement ou un timeout applicatif.
        await delay(200);
        const body = await request.json() as { email: string; familyId: string };
        return HttpResponse.json(
          { id: 'inv-delayed', email: body.email, status: 'pending', familyId: body.familyId },
          { status: 201 },
        );
      }),
    );

    const result = await sendInvitation('fam-1', 'eve@tribu.fr');
    expect(result.id).toBe('inv-delayed');
  });
});
```

Points de validation par le coach : (a) `onUnhandledRequest: 'error'` détecte tout appel réseau non couvert — si tu oublies un handler, le test s'arrête immédiatement ; (b) `HttpResponse.error()` rejette `fetch` (TypeError) alors que status 500 résout `fetch` avec `res.ok === false` — deux chemins de gestion d'erreur côté client distincts ; (c) `server.use()` préfixe sans écraser — `afterEach(() => server.resetHandlers())` retire uniquement les overrides per-test, les handlers de base restent actifs ; (d) `delay()` de MSW est une simple Promise et ne nécessite pas de fake timers Vitest.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 25 min**, avec la contrainte suivante :

L'API TribuZen expose désormais `GET /api/invitations/:id` (par identifiant unique) et `DELETE /api/invitations/:id`. Câble deux nouveaux handlers dans `handlers.ts` :
- GET `/:id` — lit `params.id` ; si `id === 'inv-missing'` renvoie 404, sinon renvoie l'invitation complète.
- DELETE `/:id` — renvoie 204 (No Content) avec `new HttpResponse(null, { status: 204 })`.

Écris les tests correspondants, y compris un override per-test pour le cas 404. Sans relire le corrigé, câble le lifecycle du zéro dans un nouveau fichier `vitest.setup.ts` vierge. Discrimine à voix haute : pourquoi `params.id` est `string | string[]` et comment tu le types proprement ?

Bonus : implémente le pattern `{ once: true }` sur le handler GET `/:id` pour simuler un retry — 1er appel → 503, 2e appel → handler de base.

## Application TribuZen

Porte cette couche dans le vrai repo `smaurier/tribuzen` :

1. Copie `src/mocks/handlers.ts` et `src/mocks/server.ts` dans le projet. Les types `Invitation` et `Family` sont importés depuis `types/index.ts` — pas de duplication.
2. Le même `src/mocks/handlers.ts` alimente `setupServer` (tests Vitest) **et** `setupWorker` (dev local). Crée `src/mocks/browser.ts` avec `setupWorker(...handlers)` et active-le dans `src/main.ts` uniquement si `import.meta.env.MODE === 'development'`. Lance `npx msw init ./public --save` pour générer le Service Worker.
3. `InvitationList.vue` fait des appels `fetchInvitations` au montage. Dans les tests de composants (module 07), MSW est déjà actif via `vitest.setup.ts` — les appels réseau du composant sont interceptés sans aucun `vi.mock`. Écris un test `InvitationList.test.ts` qui monte le composant et vérifie que les 2 invitations du handler de base s'affichent dans le DOM.
4. Commit `smaurier/tribuzen` : `test(msw): handlers invitation GET+POST + lifecycle Vitest — sans backend réel`.
