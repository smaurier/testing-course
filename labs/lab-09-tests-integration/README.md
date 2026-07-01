# Lab 09 — Tests d'intégration

> **Outcome :** à la fin, tu sais écrire un test d'intégration Vitest + MSW qui vérifie un flux multi-modules (logique domaine + API mockée à la frontière) en laissant tourner le vrai code applicatif.
> **Vrai outil :** Vitest (`describe`, `it`, `expect`, hooks de cycle de vie) + MSW (`setupServer`, `http`, `HttpResponse` depuis `msw/node`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Code de départ (ne le modifie pas — tu écris les tests) :

```ts
// src/invitation/invitation-domain.ts
export function validateEmail(email: string): void {
  if (!email.includes('@')) throw new Error('EMAIL_INVALIDE');
}

export function validateFamilyQuota(memberCount: number, maxMembers = 10): void {
  if (memberCount >= maxMembers) throw new Error('QUOTA_FAMILLE_ATTEINT');
}
```

```ts
// src/invitation/invitation-service.ts
import { validateEmail, validateFamilyQuota } from './invitation-domain';

export interface ApiClient {
  getFamilyMemberCount(familyId: string): Promise<number>;
  postInvitation(familyId: string, email: string): Promise<{ id: string }>;
}

export class InvitationService {
  constructor(private api: ApiClient) {}

  async invite(familyId: string, email: string): Promise<{ id: string }> {
    validateEmail(email);
    const count = await this.api.getFamilyMemberCount(familyId);
    validateFamilyQuota(count);
    return this.api.postInvitation(familyId, email);
  }
}
```

```ts
// src/invitation/api-client.ts — client réel, fait fetch
import type { ApiClient } from './invitation-service';

export const invitationApiClient: ApiClient = {
  getFamilyMemberCount: async (familyId) => {
    const res = await fetch(`/api/families/${familyId}/members/count`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { count: number };
    return data.count;
  },
  postInvitation: async (familyId, email) => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId, email }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<{ id: string }>;
  },
};
```

Ta mission : écrire `test/integration/invitation-flow.test.ts` qui couvre le flux complet **sans jamais mocker `validateEmail` ni `validateFamilyQuota`**.

## Étapes (en friction)

1. **Setup MSW.** Crée un `setupServer(...)` avec deux handlers par défaut : `GET /api/families/:familyId/members/count` (retourne `{ count: 3 }`) et `POST /api/invitations` (retourne `{ id: 'inv-test-1' }` en 201). Branche le lifecycle `beforeAll` / `afterEach` / `afterAll` avec `onUnhandledRequest: 'error'`.
2. **Instancie le service.** Crée `new InvitationService(invitationApiClient)` — le vrai client fetch, pas un mock.
3. **Cas nominal.** Appelle `invite('fam-1', 'bob@tribu.fr')` et assert sur le résultat retourné. Aucun `vi.fn` sur les fonctions de domaine.
4. **Cas email invalide.** Teste que `invite('fam-1', 'pas-un-email')` rejette `EMAIL_INVALIDE`. La validation réelle lève avant tout appel réseau — `onUnhandledRequest:'error'` prouve qu'aucun fetch non déclaré ne passe.
5. **Cas quota atteint.** Surcharge le handler `GET count` avec `{ count: 10 }` via `server.use(...)` **à l'intérieur du test**. Assert que `invite` rejette `QUOTA_FAMILLE_ATTEINT` sans appeler `POST /api/invitations`.
6. **Cas erreur 409.** Surcharge `POST /api/invitations` pour retourner 409. Assert que `invite` rejette `HTTP 409`.
7. **Factory.** Crée `makeInvitePayload(overrides?)` et utilise-la dans au moins trois tests. Zéro literal `{ familyId: 'fam-1', email: 'bob@tribu.fr' }` répété.

Contrainte principale : **aucun `vi.mock` sur `invitation-domain` ou `invitation-service`**. Toute la logique de domaine tourne réellement.

## Corrigé complet commenté

```ts
// test/integration/invitation-flow.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { InvitationService } from '../../src/invitation/invitation-service';
import { invitationApiClient } from '../../src/invitation/api-client';

// ── Factory ──────────────────────────────────────────────────────────────────
// makeInvitePayload retourne des données valides avec possibilité d'override.
// Un seul paramètre change le cas de test, les autres restent cohérents.
const makeInvitePayload = (overrides: { familyId?: string; email?: string } = {}) => ({
  familyId: 'fam-1',
  email: 'bob@tribu.fr',
  ...overrides,
});

// ── Handlers MSW — frontière HTTP ────────────────────────────────────────────
// Ces handlers remplacent le serveur réel.
// validateEmail et validateFamilyQuota s'exécutent RÉELLEMENT — MSW ne les voit pas.
const server = setupServer(
  // Handler GET : quota par défaut = 3 membres (< 10 → quota OK)
  http.get('/api/families/:familyId/members/count', () =>
    HttpResponse.json({ count: 3 }),
  ),
  // Handler POST : happy path → invitation créée
  http.post('/api/invitations', async ({ request }) => {
    const body = await request.json() as { familyId: string; email: string };
    return HttpResponse.json({ id: 'inv-test-1', ...body }, { status: 201 });
  }),
);

// Lifecycle MSW + Vitest — pattern standard à copier-coller dans toute suite d'intégration.
// onUnhandledRequest:'error' : tout appel réseau non déclaré fait échouer le test
//   → filet de sécurité contre les fuites vers une vraie API.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// resetHandlers annule les surcharges server.use ajoutées dans les tests individuels.
// Sans ce reset, le handler surchargé fuite sur les tests suivants.
afterEach(() => server.resetHandlers());

afterAll(() => server.close());

// ── Service sous test ─────────────────────────────────────────────────────────
// On utilise le VRAI ApiClient (fetch). MSW intercepte les appels réseau.
// InvitationService est stateless → pas besoin de le reconstruire en beforeEach.
const service = new InvitationService(invitationApiClient);

// ─────────────────────────────────────────────────────────────────────────────
describe('InvitationService — intégration (domaine réel + frontière MSW)', () => {

  it('crée une invitation valide (cas nominal)', async () => {
    const { familyId, email } = makeInvitePayload();

    const result = await service.invite(familyId, email);

    // validateEmail a tourné pour de vrai (pas mocké) et n'a pas levé.
    // getFamilyMemberCount a été intercepté par MSW → count=3 → quota OK.
    // postInvitation a été intercepté par MSW → id='inv-test-1'.
    expect(result).toEqual({ id: 'inv-test-1', familyId, email });
  });

  it('rejette un email invalide avant tout appel réseau', async () => {
    const { familyId } = makeInvitePayload();

    // validateEmail lève immédiatement (AVANT getFamilyMemberCount et postInvitation).
    // Si fetch était quand même appelé, onUnhandledRequest:'error' le détecterait —
    // mais ici aucun fetch n'est émis car la promesse rejette avant.
    await expect(service.invite(familyId, 'pas-un-email')).rejects.toThrow('EMAIL_INVALIDE');
  });

  it('rejette quand le quota famille est atteint (10 membres)', async () => {
    // Surcharge du handler GET count pour CE test uniquement.
    // resetHandlers() en afterEach rétablit { count: 3 } pour les tests suivants.
    server.use(
      http.get('/api/families/:familyId/members/count', () =>
        HttpResponse.json({ count: 10 }),  // quota plein → validateFamilyQuota lève
      ),
    );
    const { familyId, email } = makeInvitePayload();

    // validateEmail passe (email valide), getFamilyMemberCount retourne 10,
    // validateFamilyQuota lève AVANT que postInvitation soit appelé.
    await expect(service.invite(familyId, email)).rejects.toThrow('QUOTA_FAMILLE_ATTEINT');
  });

  it("propage une erreur 409 retournée par l'API", async () => {
    // Surcharge POST → 409 pour ce test uniquement.
    server.use(
      http.post('/api/invitations', () =>
        HttpResponse.json({ code: 'ALREADY_INVITED' }, { status: 409 }),
      ),
    );
    // email différent du nominal → on voit clairement que c'est un cas distinct
    const { familyId, email } = makeInvitePayload({ email: 'alice@tribu.fr' });

    // La validation passe (email valide, count=3 → quota OK) → POST est appelé.
    // MSW retourne 409 → le client réel lève 'HTTP 409' → invite() propage.
    await expect(service.invite(familyId, email)).rejects.toThrow('HTTP 409');
  });
});
```

Points de validation par le coach :
- (a) Aucun `vi.mock` sur `invitation-domain` ou `invitation-service` — logique de domaine réelle.
- (b) Lifecycle MSW complet : `listen` → `resetHandlers` → `close`.
- (c) `onUnhandledRequest: 'error'` présent comme filet de sécurité.
- (d) `server.use(...)` limité au test concerné, annulé automatiquement par `resetHandlers`.
- (e) Factory utilisée dans tous les tests — zéro literal dupliqué.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 25 min**, avec cette contrainte ajoutée : `InvitationService.invite` vérifie désormais aussi qu'aucune invitation n'est déjà en attente (`isPendingInvitation(familyId, email): Promise<boolean>` — appel `GET /api/invitations/pending?familyId=...&email=...`). Ajoute le handler MSW nominal (retourne `{ pending: false }`) et écris un test supplémentaire qui prouve que le service rejette `INVITATION_EN_ATTENTE` quand le handler retourne `{ pending: true }`, sans appeler `POST /api/invitations`. Discrimine à voix haute : quelles couches s'exécutent réellement, et laquelle est mockée par MSW ?

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `test/integration/invitation-flow.test.ts` à partir du corrigé, en adaptant les types aux interfaces existantes du projet (`Invitation`, `Family`).
2. Réutilise les handlers MSW déjà définis dans `test/msw/handlers/invitations.ts` (mis en place au module 08) plutôt que de les redéfinir dans le fichier de test.
3. Lance la suite : `npx vitest run test/integration/` et vérifie que tous les cas passent.
4. Commit `smaurier/tribuzen` : `test(invitation): intégration Vitest+MSW — domaine réel, frontière HTTP mockée`.
