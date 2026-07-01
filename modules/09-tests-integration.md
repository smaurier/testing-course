---
titre: Tests d'intégration
cours: 06-testing
notions: [portée d'un test d'intégration, tester plusieurs unités ensemble, doublures aux frontières seulement, tester un flux réel bout en bout, intégration vs unit vs e2e, place dans la pyramide des tests, données de test et fixtures]
outcomes: [situer le test d'intégration entre unit et e2e, tester un flux traversant plusieurs modules, décider quoi mocker aux frontières et quoi garder réel]
prerequis: [08-msw-mock-service-worker]
next: 10-playwright-fondamentaux
libs: [{ name: vitest, version: ^4.1.9 }, { name: msw, version: ^2 }]
tribuzen: tester le flux d'invitation TribuZen (logique domaine + API mockée MSW) en intégration
last-reviewed: 2026-07
---

# Tests d'intégration

> **Outcomes — tu sauras FAIRE :** situer un test d'intégration dans la pyramide, tester un flux traversant plusieurs modules en laissant tourner la vraie logique et en mockant uniquement la frontière HTTP avec MSW, fabriquer des fixtures propres.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen. Un membre invite `bob@tribu.fr` dans sa famille. Ce flux traverse **trois couches** dans ton code :

1. `validateEmail(email)` — règle métier pure (pas de @ → erreur)
2. `InvitationService.invite(familyId, email)` — orchestre validation + appel réseau
3. `POST /api/invitations` — persistance côté serveur (frontière externe)

Un **test unitaire** testerait `validateEmail` seule, avec tout le reste mocké. Un **test e2e** lancerait l'appli dans un navigateur réel. Ce que tu veux ici : un **test d'intégration** — vérifier que les couches 1 et 2 s'assemblent correctement, avec la **vraie logique de domaine**, et la couche 3 (HTTP) interceptée par MSW.

```ts
// src/invitation/invitation-domain.ts
export function validateEmail(email: string): void {
  if (!email.includes('@')) throw new Error('EMAIL_INVALIDE');
}

// src/invitation/invitation-service.ts
import { validateEmail } from './invitation-domain';

export interface ApiClient {
  postInvitation(familyId: string, email: string): Promise<{ id: string }>;
}

export class InvitationService {
  constructor(private api: ApiClient) {}

  async invite(familyId: string, email: string): Promise<{ id: string }> {
    validateEmail(email);                              // logique domaine réelle
    return this.api.postInvitation(familyId, email);  // frontière HTTP → MSW
  }
}
```

Question centrale : que doit-on mocker ici ? La réponse contre-intuitive : **seulement `POST /api/invitations`**, pas `validateEmail`, pas l'orchestration dans `invite()`. La théorie explique pourquoi.

## 2. Théorie complète, concise

### Intégration vs unit vs e2e

| | Unit | Intégration | E2E |
|---|---|---|---|
| Scope | 1 module isolé | 2+ modules ensemble | App entière |
| Dépendances | Toutes mockées | Frontières seulement | Aucune |
| Logique de domaine | Souvent mockée | Réelle | Réelle |
| Exemple | `validateEmail` seul | `InvitationService` + domaine + MSW | Playwright, vrai navigateur |
| Vitesse | < 5 ms | 20 – 200 ms | 5 – 30 s |
| Ce qu'il prouve | Logique interne | Assemblage réel entre modules | Parcours utilisateur |

Le test d'intégration est le niveau où tu vérifies que les pièces s'emboîtent — pas que chaque pièce fonctionne seule (unit), ni que l'utilisateur peut cliquer de bout en bout (e2e).

### La pyramide des tests

```
        /\
       /E2E\        peu, lents, chers — prouvent le parcours utilisateur
      /------\
     / Intég. \     vérifient l'assemblage multi-modules, frontières mockées
    /----------\
   /    Unit    \   nombreux, rapides, couvrent la logique métier fine
  /______________\
```

Règle pratique : **beaucoup d'unitaires, moins d'intégrations, encore moins d'e2e**. L'intégration complète la pyramide au milieu : elle attrape les bugs d'assemblage qu'un test unitaire ne peut pas voir (mauvais contrat d'interface, ordre d'appel erroné, propagation d'erreur manquante).

### Doublures aux frontières seulement

Principe central : **laisser la logique applicative tourner réellement** et ne mocker que ce qui franchit une frontière externe (réseau, base de données, système de fichiers, horloge).

Si tu mockes aussi `validateEmail` dans un test "d'intégration", tu testes uniquement que `InvitationService` *appelle* `validateEmail` — tu ne testes plus que la validation fonctionne dans le flux réel. Le test ne vaut pas plus qu'un test unitaire avec un mock supplémentaire.

Frontières typiques à mocker en intégration :
- **HTTP** → MSW (`setupServer` / `msw/node`, module 08)
- **Base de données** → base de test dédiée ou SQLite en mémoire
- **Email, SMS, paiement** → adapter que tu possèdes, mocké via DI

Ce qu'on ne mocke **jamais** en intégration :
- Validation métier (`validateEmail`, `validateFamilyQuota`)
- Calculs, transformations, règles de gestion
- Orchestration interne du service

### Tester un flux réel bout en bout (côté application)

"Bout en bout" ici ne signifie pas navigateur : cela signifie **de l'entrée publique du service jusqu'à sa sortie observable**, en laissant toute la logique interne s'exécuter réellement.

```ts
// Test d'intégration : validateEmail + InvitationService s'exécutent pour de vrai.
// Seul l'appel HTTP est intercepté par MSW.
it("rejette un email invalide sans appeler l'API", async () => {
  await expect(service.invite('fam-1', 'pas-un-email')).rejects.toThrow('EMAIL_INVALIDE');
  // validateEmail a bien tourné — MSW n'a pas été sollicité
});
```

### Données de test et fixtures

Les tests d'intégration nécessitent des données d'entrée cohérentes entre plusieurs tests. Deux patterns complémentaires :

**Factory function** — retourne un objet valide avec des overrides possibles :

```ts
// test/factories/invitation.factory.ts
export const makeInvitePayload = (overrides: { familyId?: string; email?: string } = {}) => ({
  familyId: 'fam-1',
  email: 'bob@tribu.fr',
  ...overrides,
});

// Usage : makeInvitePayload({ email: 'alice@tribu.fr' })
// → { familyId: 'fam-1', email: 'alice@tribu.fr' }
```

**Fixture statique** — objets nommés pour les cas de bord récurrents :

```ts
// test/fixtures/invitations.ts
export const INVITE_NOMINAL    = { familyId: 'fam-1', email: 'bob@tribu.fr' };
export const INVITE_EMAIL_KO   = { familyId: 'fam-1', email: 'pas-un-email' };
export const INVITE_QUOTA_FULL = { familyId: 'fam-plein', email: 'bob@tribu.fr' };
```

Préfère les **factories** dès que tu as plusieurs variants du même objet (un seul `overrides` suffit). Préfère les **fixtures statiques** pour les cas nommés réutilisés tels quels dans toute la suite.

## 3. Worked examples

### Exemple A — flux invitation complet avec MSW

Contexte : `InvitationService` utilise un `ApiClient` réel qui fait `fetch`. MSW intercepte les appels réseau côté Node.js sans modifier le code de production.

```ts
// test/integration/invitation-flow.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { InvitationService } from '../../src/invitation/invitation-service';

// ── Factory ──────────────────────────────────────────────────────────────────
const makePayload = (overrides: { familyId?: string; email?: string } = {}) => ({
  familyId: 'fam-1',
  email: 'bob@tribu.fr',
  ...overrides,
});

// ── Frontière HTTP (MSW) ──────────────────────────────────────────────────────
// On mocke uniquement le réseau. validateEmail s'exécute réellement dans invite().
const server = setupServer(
  http.post('/api/invitations', async ({ request }) => {
    const body = await request.json() as { familyId: string; email: string };
    return HttpResponse.json({ id: 'inv-test-1', ...body }, { status: 201 });
  }),
);

// Lifecycle MSW + Vitest : standard à appliquer tel quel dans toute suite d'intégration.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers()); // annule les surcharges server.use après chaque test
afterAll(() => server.close());

// ── ApiClient réel (fetch) ────────────────────────────────────────────────────
const apiClient = {
  postInvitation: async (familyId: string, email: string) => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId, email }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<{ id: string }>;
  },
};

// Service instancié une fois (stateless) — pas de beforeEach nécessaire.
const service = new InvitationService(apiClient);

describe('InvitationService — intégration (domaine réel + frontière MSW)', () => {
  it('crée une invitation avec un email valide (cas nominal)', async () => {
    const { familyId, email } = makePayload();
    const result = await service.invite(familyId, email);

    // validateEmail a tourné réellement et n'a pas levé.
    // apiClient.postInvitation a été intercepté par MSW → retour attendu.
    expect(result).toEqual({ id: 'inv-test-1', familyId, email });
  });

  it("rejette un email invalide avant tout appel réseau", async () => {
    const { familyId } = makePayload();

    // validateEmail lève immédiatement → fetch n'est jamais appelé.
    // onUnhandledRequest:'error' déclencherait un échec si fetch était quand même appelé.
    await expect(service.invite(familyId, 'pas-un-email')).rejects.toThrow('EMAIL_INVALIDE');
  });

  it("propage une erreur 409 retournée par l'API", async () => {
    // Surcharge du handler pour ce test uniquement — resetHandlers() en afterEach annule.
    server.use(
      http.post('/api/invitations', () =>
        HttpResponse.json({ code: 'ALREADY_INVITED' }, { status: 409 }),
      ),
    );
    const { familyId, email } = makePayload({ email: 'alice@tribu.fr' });

    // La validation passe (email valide) → POST est appelé, MSW retourne 409.
    await expect(service.invite(familyId, email)).rejects.toThrow('HTTP 409');
  });
});
```

Pas-à-pas :
1. `setupServer` + `beforeAll(server.listen)` — MSW tourne en Node.js et intercepte `fetch` sans patcher le code de prod.
2. `onUnhandledRequest: 'error'` — si un test laisse partir un `fetch` non prévu, le test échoue immédiatement ; filet de sécurité contre les fuites vers une vraie API.
3. `afterEach(server.resetHandlers())` — la surcharge `server.use(...)` dans le test 409 ne fuite pas sur le test suivant.
4. `validateEmail` s'exécute **réellement** dans `invite()` — c'est exactement ce qui différencie ce test d'un test unitaire : on prouve l'assemblage.

### Exemple B — factory + handler de quota

Un deuxième handler (`GET /api/families/:familyId/members/count`) s'ajoute et la factory devient essentielle pour les variants :

```ts
// Handlers étendus
const server = setupServer(
  http.get('/api/families/:familyId/members/count', () =>
    HttpResponse.json({ count: 3 }),           // quota OK par défaut (3 < 10)
  ),
  http.post('/api/invitations', async ({ request }) => {
    const body = await request.json() as { familyId: string; email: string };
    return HttpResponse.json({ id: 'inv-test-1', ...body }, { status: 201 });
  }),
);

// Test : quota atteint (surcharge pour ce test, reset auto après)
it('rejette quand le quota famille est atteint', async () => {
  server.use(
    http.get('/api/families/:familyId/members/count', () =>
      HttpResponse.json({ count: 10 }),       // quota plein → rejet avant POST
    ),
  );
  const { familyId, email } = makePayload();

  await expect(service.invite(familyId, email)).rejects.toThrow('QUOTA_FAMILLE_ATTEINT');
  // POST /api/invitations n'a pas été appelé : la validation domaine a levé avant.
});
```

La factory `makePayload({ email: 'alice@tribu.fr' })` change le seul paramètre pertinent par test — les autres restent à leur valeur par défaut sans répétition.

## 4. Pièges & misconceptions

- **Tout mocker = test unitaire déguisé.** Si tu remplace aussi `validateEmail` par un `vi.fn()`, tu testes uniquement que le service *appelle* la validation — tu ne testes plus qu'elle fonctionne dans le flux réel. Le test n'apporte rien de plus qu'un test unitaire. *Correct* : mocker uniquement la frontière HTTP (MSW) ou DB, jamais le cœur métier.
- **Test trop large, test fragile.** Un test qui traverse 8 modules, 3 services et 2 bases de données est difficile à déboguer quand il échoue — la cause peut venir de n'importe où. *Correct* : délimiter le scope à un flux applicatif précis (ex. "invitation") avec une seule frontière mockée. Si le scope doit grandir encore, c'est un signal de passer en e2e Playwright.
- **Confondre intégration et e2e.** Un test e2e pilote un navigateur réel (Playwright) et valide le parcours utilisateur cliquable. Un test d'intégration ne touche jamais le DOM. *Correct* : aucun `page.goto`, aucun `screen.getByRole` dans une suite Vitest d'intégration — ces assertions appartiennent aux couches composant (Testing Library) ou e2e (Playwright).
- **Oublier `server.resetHandlers()`.** Un `server.use(...)` à l'intérieur d'un test surcharge le handler jusqu'à la fin de la suite si on ne remet pas à zéro. Le test suivant hérite d'un comportement inattendu. *Correct* : `afterEach(() => server.resetHandlers())` systématique.
- **État partagé mutable entre tests.** Construire un service qui accumule un état interne (ex. cache) et le partager entre tests sans reset brise l'isolation. *Correct* : les objets stateless (apiClient, service sans état interne) peuvent être partagés ; les objets à état (`Map`, `Set`, compteurs) se reconstruisent en `beforeEach`.

## 5. Ancrage TribuZen

Couche fil-rouge : **tester le flux d'invitation TribuZen (logique domaine + API mockée MSW) en intégration** (`smaurier/tribuzen`).

En pratique dans le repo :

- `src/invitation/invitation-domain.ts` — `validateEmail`, `validateFamilyQuota` : logique pure, s'exécute réellement dans les tests d'intégration, jamais mockée.
- `src/invitation/invitation-service.ts` — `InvitationService.invite` : point d'entrée du test, orchestre domaine + appel `POST /api/invitations`.
- `test/msw/handlers/invitations.ts` — handlers MSW définis au module 08, réutilisés tels quels dans les tests d'intégration (un seul point de vérité pour les contrats d'API).
- La suite d'intégration prouve que la chaîne complète côté frontend (`validateEmail` → `InvitationService` → fetch intercepté) se comporte correctement pour les cas nominaux, erreurs de domaine et erreurs API.

Module suivant (10 — Playwright) : le même flux mais depuis un vrai navigateur, sans MSW, avec des vraies requêtes HTTP.

## 6. Points clés

1. Un test d'intégration teste 2+ modules ensemble avec la vraie logique de domaine, sans mocker le cœur métier.
2. Pyramide : beaucoup d'unit (fast, cheap) → moins d'intégration → peu d'e2e (slow, costly).
3. Mocker uniquement les frontières externes : HTTP avec MSW, DB avec une base de test — jamais la logique applicative interne.
4. Lifecycle MSW en Vitest : `beforeAll(server.listen({ onUnhandledRequest: 'error' }))` + `afterEach(server.resetHandlers())` + `afterAll(server.close())`.
5. `server.use(...)` dans un test surcharge un handler pour ce test seulement — `resetHandlers` l'annule en `afterEach`.
6. `onUnhandledRequest: 'error'` est un filet de sécurité : tout appel réseau non déclaré fait échouer le test immédiatement.
7. Factory `makeX(overrides?)` : objet valide par défaut, variant par test en un seul paramètre, zéro duplication.
8. Un test trop large (scope > un flux) est un signal pour passer en e2e Playwright plutôt que d'élargir l'intégration.

## 7. Seeds Anki

```
Qu'est-ce qu'un test d'intégration ?|Un test qui vérifie que 2+ modules s'assemblent correctement avec la logique de domaine réelle et seulement les frontières externes mockées
Quelle est la règle des frontières en test d'intégration ?|Mocker uniquement ce qui franchit une frontière externe (HTTP, DB, email) — jamais la logique métier interne
Quel outil mocke la frontière HTTP côté Node.js pour Vitest ?|MSW avec setupServer importé depuis msw/node — intercepte fetch sans modifier le code de production
Quel lifecycle MSW utiliser avec Vitest ?|beforeAll(server.listen) + afterEach(server.resetHandlers) + afterAll(server.close)
À quoi sert onUnhandledRequest: 'error' dans server.listen ?|Fait échouer le test si un appel réseau non déclaré est émis — empêche les fuites silencieuses vers une vraie API
Comment tester un cas d'erreur HTTP sans impacter les autres tests ?|server.use(...) à l'intérieur du test + afterEach(server.resetHandlers) qui annule le handler après chaque test
Différence entre test d'intégration et e2e ?|Intégration = code applicatif, frontière HTTP mockée, pas de navigateur. E2E = navigateur réel (Playwright), vraies requêtes, parcours utilisateur
Qu'est-ce qu'une factory de fixture ?|Une fonction makeX(overrides?) qui retourne un objet valide avec les overrides fournis — évite la duplication et rend l'intention de chaque test lisible
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-09-tests-integration/`. Tu y écris, en **Vitest réel + MSW**, les tests d'intégration du flux d'invitation TribuZen : validation domaine réelle, handlers MSW aux frontières, factory de fixtures, et cas d'erreurs. Corrigé complet commenté + variante J+30 dans le README du lab.
