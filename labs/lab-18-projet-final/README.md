# Lab 18 — Projet final (capstone)

> **Outcome :** à la fin, tu sais concevoir et écrire la suite de test complète d'une feature TribuZen — unit (Vitest + doubles DI), intégration (Supertest + Prisma), E2E (Playwright Page Object) — et configurer le pipeline CI avec coverage gate qui bloque une PR sous 80 %.
> **Vrai outil :** Vitest (`vi.fn`, `vi.spyOn`), Supertest, Prisma, `@playwright/test`. Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

La feature invitation TribuZen est développée. Code de départ fourni dans `src/invitation/` — **ne le modifie pas, tu écris uniquement les tests**.

```ts
// src/invitation/invitation-service.ts (fourni — ne pas modifier)
export interface InvitationRepo {
  existsPending(familyId: string, email: string): Promise<boolean>;
  save(familyId: string, email: string): Promise<{ id: string; token: string }>;
}
export interface Notifier {
  sendInvitationEmail(email: string, familyId: string): Promise<void>;
}

export class InvitationService {
  constructor(private repo: InvitationRepo, private notifier: Notifier) {}

  async invite(familyId: string, email: string): Promise<{ id: string; token: string }> {
    if (!email.includes('@')) throw new Error('INVALID_EMAIL');
    if (await this.repo.existsPending(familyId, email)) throw new Error('ALREADY_INVITED');
    const invitation = await this.repo.save(familyId, email);
    await this.notifier.sendInvitationEmail(email, familyId);
    return invitation;
  }
}
```

Ta mission : livrer la feature testée de bout en bout.

- **Partie A — Unit** : `invitation-service.test.ts` avec doubles injectés.
- **Partie B — Intégration** : `invitation.routes.integration.test.ts` avec Supertest + Prisma.
- **Partie C — E2E** : `e2e/invitation.spec.ts` avec Playwright Page Object.
- **Partie D — CI** : `vitest.config.ts` avec coverage gate + `.github/workflows/ci.yml`.

## Étapes (en friction)

### Partie A — Unit (InvitationService)

1. Dans `beforeEach`, construis un **stub** `repo` (`existsPending`→`false`, `save`→`{ id: 'inv-1', token: 'tok-abc' }`) et un **mock** `notifier` (`sendInvitationEmail`→`undefined`) avec `vi.fn()`. Injecte-les via le constructeur.
2. **Cas nominal.** Asserter que `invite('fam-1', 'bob@tribu.fr')` retourne `{ id: 'inv-1', token: 'tok-abc' }`, que `repo.save` reçoit les bons arguments, et que `notifier.sendInvitationEmail` est appelé **exactement une fois** avec les bons arguments.
3. **Cas doublon.** Reconfigure `existsPending`→`true`, assert que `invite` rejette `ALREADY_INVITED` et que ni `save` ni `sendInvitationEmail` ne sont appelés (`not.toHaveBeenCalled`).
4. **Panne SMTP.** Fais rejeter `sendInvitationEmail` avec `new Error('SMTP_DOWN')`, assert que `invite` propage l'erreur et que `repo.save` a été appelé une fois (persistance avant la panne).
5. **Email invalide.** Appelle `invite('fam-1', 'pas-un-email')`, assert que `INVALID_EMAIL` est levé **sans** appeler `repo.existsPending`.
6. `afterEach(() => vi.clearAllMocks())` — discipline de reset.

### Partie B — Intégration (route POST /invitations)

7. Dans `beforeAll`, envoie `POST /auth/login` avec Supertest pour obtenir un JWT réel. Stocke-le dans `authToken`.
8. Dans `beforeEach`, efface les invitations : `await prisma.invitation.deleteMany()`.
9. **Création.** `POST /invitations` avec token + `{ email, familyId }` → assert `201`, `res.body.status === 'pending'`, `res.body.id` défini.
10. **Doublon.** Envoie deux fois le même email → assert `409`, `res.body.code === 'ALREADY_INVITED'`.
11. **Sans auth.** Même requête sans `Authorization` → assert `401`.
12. `afterAll(() => prisma.$disconnect())`.

### Partie C — E2E (Playwright)

13. Crée un **Page Object** `InvitationPage` dans `e2e/page-objects/invitation.page.ts` avec les locators du formulaire d'invitation (`openForm()`, `fillEmail(email)`, `submit()`).
14. Dans `test.beforeEach`, connecte Alice via l'UI (ou une fixture d'auth storage-state si déjà configurée dans le cours 12).
15. **Chemin heureux.** Alice ouvre le formulaire, saisit `bob@tribu.fr`, soumet → assert que `[data-testid="invitation-success"]` est visible et que le texte `bob@tribu.fr` apparaît dans la liste.
16. **Erreur client.** Saisit `pas-un-email`, soumet → assert que `[data-testid="email-error"]` est visible (aucune requête réseau émise, erreur de validation côté client).

### Partie D — CI

17. Dans `vitest.config.ts`, configure `coverage.thresholds` : `statements: 80, branches: 75, functions: 80, lines: 80`. Lance `pnpm vitest run --coverage` localement et vérifie que les gates passent.
18. Rédige `.github/workflows/ci.yml` avec 3 jobs : `lint` (typecheck + eslint), `tests` (Vitest avec coverage gate, `needs: lint`), `e2e` (Playwright sharding 2 workers, `needs: lint`).

## Corrigé complet commenté

### Partie A — invitation-service.test.ts

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationService } from './invitation-service';
import type { InvitationRepo, Notifier } from './invitation-service';

describe('InvitationService', () => {
  let repo: InvitationRepo;
  let notifier: Notifier;
  let svc: InvitationService;

  beforeEach(() => {
    // STUB : réponses figées, pilote les entrées du service.
    // Chemin nominal par défaut — on reconfigure par test si besoin.
    repo = {
      existsPending: vi.fn().mockResolvedValue(false),
      save: vi.fn().mockResolvedValue({ id: 'inv-1', token: 'tok-abc' }),
    };
    // MOCK : on assertera sur les appels (behavior verification).
    notifier = { sendInvitationEmail: vi.fn().mockResolvedValue(undefined) };
    // DI : aucun vi.mock nécessaire — le constructeur suffit.
    svc = new InvitationService(repo, notifier);
  });

  afterEach(() => {
    // clearAllMocks : efface l'historique d'appels, GARDE les implémentations.
    // Ne pas utiliser resetAllMocks ici : on veut garder les retours configurés.
    vi.clearAllMocks();
  });

  it('persiste et notifie exactement une fois (cas nominal)', async () => {
    const result = await svc.invite('fam-1', 'bob@tribu.fr');

    // state verification : résultat remonte du stub
    expect(result).toEqual({ id: 'inv-1', token: 'tok-abc' });
    // les bons arguments ont été passés au repo
    expect(repo.save).toHaveBeenCalledWith('fam-1', 'bob@tribu.fr');
    // behavior verification : UNE seule notif, bons arguments
    expect(notifier.sendInvitationEmail).toHaveBeenCalledOnce();
    expect(notifier.sendInvitationEmail).toHaveBeenCalledWith('bob@tribu.fr', 'fam-1');
  });

  it('rejette un doublon sans persister ni notifier', async () => {
    // on reconfigure le STUB pour CE test uniquement
    vi.mocked(repo.existsPending).mockResolvedValue(true);

    await expect(svc.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('ALREADY_INVITED');

    // preuve d'absence d'effet de bord : aucune I/O déclenchée
    expect(repo.save).not.toHaveBeenCalled();
    expect(notifier.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("propage une panne SMTP sans masquer l'erreur", async () => {
    vi.mocked(notifier.sendInvitationEmail).mockRejectedValue(new Error('SMTP_DOWN'));

    // l'erreur SMTP remonte sans être avalée par le service
    await expect(svc.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('SMTP_DOWN');
    // MAIS repo.save a été appelé (persistance AVANT la panne)
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('rejette un email invalide avant toute I/O', async () => {
    await expect(svc.invite('fam-1', 'pas-un-email')).rejects.toThrow('INVALID_EMAIL');

    // validation en amont : aucune I/O déclenchée
    expect(repo.existsPending).not.toHaveBeenCalled();
  });
});
```

### Partie B — invitation.routes.integration.test.ts

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../db';

describe('POST /invitations', () => {
  let authToken: string;

  beforeAll(async () => {
    // JWT réel : on passe par la vraie route /auth/login (test le middleware aussi)
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@tribu.fr', password: 'Test1234!' });
    authToken = res.body.token;
  });

  beforeEach(async () => {
    // Isolation : efface les invitations entre chaque test
    await prisma.invitation.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('crée une invitation et retourne 201', async () => {
    const res = await request(app)
      .post('/invitations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'bob@tribu.fr', familyId: 'fam-1' });

    expect(res.status).toBe(201);
    // toMatchObject : on ne fixe que les champs qui nous intéressent
    expect(res.body).toMatchObject({ email: 'bob@tribu.fr', status: 'pending' });
    expect(res.body.id).toBeDefined();
  });

  it("retourne 409 si l'email est déjà invité", async () => {
    // Premier envoi : crée l'invitation
    await request(app)
      .post('/invitations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'bob@tribu.fr', familyId: 'fam-1' });

    // Doublon : doit être rejeté
    const res = await request(app)
      .post('/invitations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'bob@tribu.fr', familyId: 'fam-1' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_INVITED');
  });

  it('retourne 401 sans token auth', async () => {
    const res = await request(app)
      .post('/invitations')
      .send({ email: 'eve@tribu.fr', familyId: 'fam-1' });

    // le middleware JWT doit bloquer avant même le service
    expect(res.status).toBe(401);
  });
});
```

### Partie C — e2e/page-objects/invitation.page.ts + spec

```ts
// e2e/page-objects/invitation.page.ts
import type { Page, Locator } from '@playwright/test';

export class InvitationPage {
  readonly openButton: Locator;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly successBanner: Locator;
  readonly emailError: Locator;

  constructor(private page: Page) {
    this.openButton = page.getByRole('button', { name: 'Inviter un membre' });
    this.emailInput = page.getByLabel('Email');
    this.submitButton = page.getByRole('button', { name: "Envoyer l'invitation" });
    this.successBanner = page.getByTestId('invitation-success');
    this.emailError = page.getByTestId('email-error');
  }

  async openForm(): Promise<void> {
    await this.openButton.click();
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
```

```ts
// e2e/invitation.spec.ts
import { test, expect } from '@playwright/test';
import { InvitationPage } from './page-objects/invitation.page';

test.describe('Feature invitation', () => {
  // Fixture auth : Alice est connectée avant chaque test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('alice@tribu.fr');
    await page.getByLabel('Mot de passe').fill('Test1234!');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL('/famille');
  });

  test('Alice invite Bob et voit la confirmation', async ({ page }) => {
    const invitation = new InvitationPage(page);

    await invitation.openForm();
    await invitation.fillEmail('bob@tribu.fr');
    await invitation.submit();

    // UX observable : le banner de succès est visible
    await expect(invitation.successBanner).toBeVisible();
    // Bob apparaît dans la liste des invitations en attente
    await expect(page.getByText('bob@tribu.fr')).toBeVisible();
  });

  test("formulaire valide l'email avant envoi", async ({ page }) => {
    const invitation = new InvitationPage(page);

    await invitation.openForm();
    await invitation.fillEmail('pas-un-email');
    await invitation.submit();

    // Erreur côté client : aucune requête réseau émise
    await expect(invitation.emailError).toBeVisible();
    // le banner de succès ne s'affiche pas
    await expect(invitation.successBanner).not.toBeVisible();
  });
});
```

### Partie D — vitest.config.ts (extrait coverage gate)

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
      thresholds: {
        // exit 1 si un seuil est franchi → CI bloque la PR
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint:
    name: Lint + Typecheck
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm eslint . --max-warnings 0
      - run: pnpm tsc --noEmit

  tests:
    name: Unit + Integration (coverage gate)
    needs: lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  e2e:
    name: E2E Playwright (shard)
    needs: lint
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps chromium
      - run: pnpm build
      - run: pnpm playwright test --shard=${{ matrix.shard }}/2
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces-${{ matrix.shard }}
          path: playwright-report/
```

Points de validation par le coach : (a) aucun `vi.mock` sur `InvitationService` — la DI suffit ; (b) les 4 cas unit couvrent nominal, doublon, panne, et validation d'entrée ; (c) l'intégration teste le middleware JWT (401) et la persistance réelle Prisma ; (d) le Page Object encapsule tous les locators ; (e) le coverage gate sort avec exit 1 si les seuils ne sont pas atteints ; (f) le pipeline CI file lint → tests → e2e dans le bon ordre.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 30 min**, et ajoute une contrainte : la feature invitation inclut désormais un délai d'expiration (l'invitation expire après 48 h). Étend la suite :

1. **Unit** : un test avec `vi.useFakeTimers()` + `vi.setSystemTime()` qui prouve que `invite()` passe l'expiration correctement au `repo.save`.
2. **Intégration** : un test qui crée une invitation avec une date d'expiration passée et vérifie que `POST /invitations` avec le même email retourne `201` (l'ancienne invitation est expirée, pas un doublon actif).
3. **E2E** : à toi de décider si ce cas mérite un spec Playwright ou si l'intégration suffit. Justifie à voix haute.

Bonus : remplace le stub `repo` par un **fake** (Map en mémoire implémentant `InvitationRepo`) et vérifie que les mêmes tests passent. Discrimine : où est le stub, le spy, le fake ?

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Si `src/invitation/invitation-service.ts` n'existe pas encore, crée-le avec les interfaces `InvitationRepo`/`Notifier` à partir des types existants dans `types/index.ts`.
2. Écris `invitation-service.test.ts` (Partie A) et lance `pnpm vitest run` — tous verts.
3. Ajoute `invitation.routes.integration.test.ts` (Partie B) et configure une DB Prisma de test (variable `DATABASE_URL_TEST`).
4. Écris le spec Playwright `e2e/invitation.spec.ts` (Partie C) et lance `pnpm playwright test` en headed pour voir le parcours.
5. Commit `smaurier/tribuzen` : `test(invitation): suite complète unit + intégration + e2e + CI gate`.
