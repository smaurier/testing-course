---
titre: Projet final
cours: 06-testing
notions: [stratégie de test d'une feature complète, pyramide appliquée, choisir le bon niveau de test, suite maintenable, coverage et gates, CI complète, synthèse du cours]
outcomes: [concevoir la stratégie de test d'une feature complète, écrire une suite équilibrée unit intégration e2e, mettre en place les gates CI, livrer une feature testée de bout en bout]
prerequis: [17-performance-testing]
next: fin-parcours-06-testing
libs: [{ name: vitest, version: ^4.1.9 }, { name: "@playwright/test", version: ^1 }]
tribuzen: tester intégralement la feature invitation TribuZen — unit + intégration + e2e + CI
last-reviewed: 2026-07
---

# Projet final

> **Outcomes — tu sauras FAIRE :** définir une stratégie de test avant de coder, écrire une suite unit + intégration + E2E équilibrée sur une feature réelle, configurer les coverage gates CI qui bloquent une PR non couverte, livrer la feature invitation TribuZen testée de bout en bout.
> **Difficulté :** :star::star::star::star::star:

## 1. Cas concret d'abord

La feature invitation TribuZen vient d'être développée : `InvitationService.invite()`, la route `POST /invitations`, et le formulaire frontend. Tu dois la livrer — c'est-à-dire merger une PR où une CI passe, coverage gate inclus. Trois questions concrètes se posent avant d'écrire un seul test :

1. Combien de tests à quel niveau — unit, intégration, E2E ?
2. Comment structurer la suite pour qu'elle soit encore maintenable dans 6 mois ?
3. Quel gate CI bloque la PR si le coverage tombe sous le seuil ?

Ce module répond aux trois, avec des exemples sur la feature invitation, et synthétise les 18 modules du cours.

## 2. Théorie complète, concise

### Stratégie de test d'une feature

Quatre questions à répondre **avant** le premier test :

1. **Quelles parties sont critiques ?** Logique domaine (`InvitationService`), contrat d'API (`POST /invitations`), UX (formulaire + confirmation).
2. **Quel niveau couvre le mieux chaque partie ?** Logique → unit, contrat API + SQL → intégration, parcours utilisateur → E2E.
3. **Quel coverage vise-t-on ?** Statements 80 %, branches 75 % minimum sur la feature.
4. **Quel gate bloque la livraison ?** Un `vitest run --coverage` qui sort avec code 1 si un seuil est franchi.

### Pyramide appliquée

La pyramide de tests (Kent Beck) est une heuristique, pas un dogme : plus un test est haut dans la pyramide, plus il est lent, fragile et cher à maintenir.

| Niveau | Part | Outil | Ce qu'on vérifie |
|--------|------|-------|-----------------|
| Unit | 60 % | Vitest | logique domaine, validation, cas limites, branches |
| Intégration | 25 % | Vitest + Supertest + Prisma | contrat HTTP, SQL, middleware auth |
| E2E | 15 % | Playwright | parcours utilisateur critiques, UX observable |

L'antipattern **pyramide inversée** : couvrir les branches de `InvitationService` avec 30 specs Playwright. La CI dure 30 min, un bug dans le service prend 10 étapes de debug, le feedback est inutilisable.

### Choisir le bon niveau par cas

| Situation | Niveau recommandé | Pourquoi |
|-----------|------------------|----------|
| Règle métier (`ALREADY_INVITED`) | Unit | logique pure, rapide, branches isolées |
| Route API + validation Zod + JWT | Intégration | teste la couche HTTP avec son contexte réel |
| Formulaire → confirmation dans le browser | E2E | UX observable uniquement avec un vrai navigateur |
| Email envoyé par le notifier | Unit (mock) | I/O externe → stub/spy, pas E2E |

**Ne pas couvrir la même logique à 3 niveaux.** Si `InvitationService` est couvert en unit, le test d'intégration n'a pas besoin de retester toutes les branches — il vérifie que la couche HTTP + DB fonctionne ensemble.

### Suite maintenable

Quatre règles non négociables :

1. **Isolation totale.** Chaque test peut s'exécuter seul dans n'importe quel ordre. `beforeEach` reconstruit les doubles Vitest ou rollback la DB Prisma. Aucun état partagé entre tests.
2. **Nommage comportemental.** `it("rejette un email déjà invité sans persister ni notifier")` > `it("test cas doublon")`. Le nom est la documentation du comportement attendu.
3. **Structure en 3 couches.** `describe('<Feature>')` → `describe('<méthode/route>')` → `it('<comportement observable>')`.
4. **Reset systématique.** `afterEach(() => vi.clearAllMocks())` (Vitest) ou `await prisma.invitation.deleteMany()` (intégration). Sans reset, les doubles fuient et les tests passent/échouent selon l'ordre.

### Coverage et gates

Coverage = mesure du code exécuté par les tests. Les métriques utiles :

- **Statements** (80 % cible globale) : lignes exécutées.
- **Branches** (75 % minimum) : `if/else`, ternaires — c'est là que les bugs se cachent.
- **Functions** (80 %) : toutes les fonctions atteintes.

Configurer le gate dans Vitest :

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

Si un seuil est franchi, Vitest sort avec **exit code 1** → la CI step échoue → la PR ne peut pas merger. Ne jamais augmenter un seuil sans justification : c'est un contrat d'équipe.

### CI complète

Un pipeline minimal en 4 jobs :

```yaml
# .github/workflows/ci.yml (structure)
#
# push / PR
#   ├── lint + typecheck          (2 min, bloquant)
#   ├── unit + intégration        (5 min, bloquant, coverage gate)
#   └── e2e (shard 1/2, 2/2)     (15 min, bloquant)
#          └── upload artifacts
```

Règles de composition :

- **lint/typecheck** bloque tout : inutile de lancer les tests si le code ne compile pas.
- **unit + intégration** en un seul job Vitest : ils partagent la même config et le coverage se calcule sur les deux.
- **E2E** après les tests rapides (fail-fast) et en parallèle via sharding (`--shard=1/2`).
- **Artifacts** : `playwright-report/`, `coverage/lcov.info` uploadés même en cas d'échec (`if: always()`).

### Synthèse des 18 modules

| # | Notion | Outil clé |
|---|--------|-----------|
| 01 | Anatomie d'un test, TDD | Vitest |
| 02 | Vitest fondamentaux | Vitest |
| 03 | Assertions avancées | Vitest |
| 04 | Mocking et test doubles | vi.fn / vi.spyOn / vi.mock |
| 05 | Tests asynchrones | async/await, fake timers |
| 06 | Fixtures et factories | beforeEach, test.extend |
| 07 | Tests d'intégration | Supertest |
| 08 | MSW | msw |
| 09 | Tests Prisma | Prisma + DB test |
| 10 | Tests de composants | Testing Library |
| 11 | E2E Playwright bases | Playwright |
| 12 | Page Objects et fixtures | Playwright POM |
| 13 | Visual regression | Playwright screenshots |
| 14 | Accessibilité | axe-core + Playwright |
| 15 | Contract tests | Zod |
| 16 | CI GitHub Actions | GitHub Actions |
| 17 | Performance testing | k6 |
| 18 | Projet final (ce module) | tout |

## 3. Worked examples

### Plan de test complet — feature invitation TribuZen

La feature à couvrir : un membre d'une famille TribuZen envoie une invitation par email.

#### Couche unit — InvitationService (4 tests)

```ts
// src/invitation/invitation-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationService } from './invitation-service';
import type { InvitationRepo, Notifier } from './invitation-service';

describe('InvitationService', () => {
  let repo: InvitationRepo;
  let notifier: Notifier;
  let svc: InvitationService;

  beforeEach(() => {
    // STUB repo : réponses figées, contrôle les entrées
    repo = {
      existsPending: vi.fn().mockResolvedValue(false),
      save: vi.fn().mockResolvedValue({ id: 'inv-1', token: 'tok-abc' }),
    };
    // MOCK notifier : on assertera sur les appels (behavior verification)
    notifier = { sendInvitationEmail: vi.fn().mockResolvedValue(undefined) };
    svc = new InvitationService(repo, notifier);
  });

  afterEach(() => {
    vi.clearAllMocks(); // efface l'historique, garde les implémentations
  });

  it('persiste et notifie exactement une fois (cas nominal)', async () => {
    const result = await svc.invite('fam-1', 'bob@tribu.fr');

    // state verification sur le résultat (stub)
    expect(result).toEqual({ id: 'inv-1', token: 'tok-abc' });
    expect(repo.save).toHaveBeenCalledWith('fam-1', 'bob@tribu.fr');
    // behavior verification : protocole notif
    expect(notifier.sendInvitationEmail).toHaveBeenCalledOnce();
    expect(notifier.sendInvitationEmail).toHaveBeenCalledWith('bob@tribu.fr', 'fam-1');
  });

  it('rejette un doublon sans persister ni notifier', async () => {
    vi.mocked(repo.existsPending).mockResolvedValue(true);

    await expect(svc.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('ALREADY_INVITED');

    // preuve d'absence d'effet de bord
    expect(repo.save).not.toHaveBeenCalled();
    expect(notifier.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("propage une panne SMTP sans masquer l'erreur", async () => {
    vi.mocked(notifier.sendInvitationEmail).mockRejectedValue(new Error('SMTP_DOWN'));

    await expect(svc.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('SMTP_DOWN');
    // l'invitation a été persistée AVANT la panne
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('rejette un email invalide avant toute I/O', async () => {
    await expect(svc.invite('fam-1', 'not-an-email')).rejects.toThrow('INVALID_EMAIL');

    // aucune I/O déclenchée : validation en amont
    expect(repo.existsPending).not.toHaveBeenCalled();
  });
});
```

Pas-à-pas : (1) `beforeEach` reconstruit des doubles frais → isolation garantie ; (2) `clearAllMocks` en `afterEach` efface l'historique sans casser les implémentations ; (3) les 4 tests couvrent nominal, doublon, panne infra, et validation d'entrée — 4 branches, pas 4 fois la même chose.

#### Couche intégration — route POST /invitations

```ts
// src/invitation/invitation.routes.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../db';

describe('POST /invitations', () => {
  let authToken: string;

  beforeAll(async () => {
    // Crée un utilisateur test et récupère un JWT réel
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@tribu.fr', password: 'Test1234!' });
    authToken = res.body.token;
  });

  beforeEach(async () => {
    // Reset entre chaque test : efface les invitations créées
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
    expect(res.body).toMatchObject({ email: 'bob@tribu.fr', status: 'pending' });
    expect(res.body.id).toBeDefined();
  });

  it("retourne 409 si l'email est déjà invité", async () => {
    // Premier envoi
    await request(app)
      .post('/invitations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'bob@tribu.fr', familyId: 'fam-1' });

    // Doublon
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

    expect(res.status).toBe(401);
  });
});
```

Ce que ce niveau vérifie en plus de l'unit : le middleware JWT parse le token, Zod valide le body, Prisma persiste correctement, la route retourne le bon status HTTP. La logique `ALREADY_INVITED` n'est pas retestée branche par branche — le test unit couvre ça.

#### Couche E2E — parcours invitation Playwright

```ts
// e2e/invitation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Feature invitation', () => {
  test.beforeEach(async ({ page }) => {
    // Fixture auth : connecter Alice avant chaque test
    await page.goto('/login');
    await page.getByLabel('Email').fill('alice@tribu.fr');
    await page.getByLabel('Mot de passe').fill('Test1234!');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL('/famille');
  });

  test('Alice invite Bob et voit la confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Inviter un membre' }).click();
    await page.getByLabel('Email').fill('bob@tribu.fr');
    await page.getByRole('button', { name: "Envoyer l'invitation" }).click();

    await expect(page.getByTestId('invitation-success')).toBeVisible();
    await expect(page.getByText('bob@tribu.fr')).toBeVisible();
  });

  test("formulaire valide l'email avant envoi", async ({ page }) => {
    await page.getByRole('button', { name: 'Inviter un membre' }).click();
    await page.getByLabel('Email').fill('pas-un-email');
    await page.getByRole('button', { name: "Envoyer l'invitation" }).click();

    // Erreur client — aucune requête réseau émise
    await expect(page.getByTestId('email-error')).toBeVisible();
  });
});
```

Deux specs E2E seulement : le chemin heureux (UX observable end-to-end) et un cas d'erreur côté client. La validation d'email côté serveur est couverte en unit + intégration — pas besoin de la rejouer en E2E.

#### Pipeline CI complet

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
      # exit 1 si thresholds non atteints → bloque la PR
      - run: pnpm vitest run --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/lcov.info

  e2e:
    name: E2E Playwright
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

## 4. Pièges & misconceptions

- **Tout en E2E (pyramide inversée).** Couvrir les 10 branches de `InvitationService` avec des specs Playwright : chaque spec prend 8 s, la CI dure 30 min, un bug dans le service prend 12 étapes de debug pour être localisé. *Correct* : la logique métier en unit (ms), le contrat API en intégration (s), l'UX critique en E2E (s à min). La vitesse de feedback est un critère de design.
- **Pas de stratégie.** Tests écrits au fur et à mesure, sans plan → redondances entre niveaux, cas limites oubliés, coverage artificiel sur le code "facile" (getters, constructeurs), et trous sur les branches critiques (cas d'erreur). *Correct* : 10 minutes de plan (tableau feature × niveau × cas) avant le premier test. Même un post-it suffit.
- **Suite non maintenable.** Tests qui partagent un état global (module-level `let task = null`), nommage générique (`it('should work')`), doubles non réinitialisés en `afterEach` → tests qui passent ou échouent selon l'ordre d'exécution, et personne ne sait pourquoi. *Correct* : `beforeEach` reconstruit l'état from scratch, chaque test décrit le comportement attendu en une phrase, `afterEach` nettoie les effets de bord. La suite doit être lisible par quelqu'un qui n'a pas écrit le code.

## 5. Ancrage TribuZen

Couche fil-rouge : **tester intégralement la feature invitation TribuZen — unit + intégration + e2e + CI** (`smaurier/tribuzen`).

En session, on part de `InvitationService` déjà testé en unit (module 04), on ajoute :

1. Les tests d'intégration de `POST /invitations` avec Prisma et une DB test isolée (module 09).
2. Le spec Playwright du parcours invitation — Alice ouvre le formulaire, saisit l'email de Bob, voit la confirmation (module 12).
3. La config `vitest.config.ts` avec `thresholds` à 80/75 et le workflow CI en 3 jobs.

C'est exactement ce que fait un dev senior qui livre une feature : pyramide + gate + CI = **feature done**. La PR ne merge pas si la CI est rouge.

## 6. Points clés

1. Définir la stratégie avant les tests : quelle partie de la feature, quel niveau, pourquoi — même un tableau de 10 lignes.
2. Pyramide pratique : 60 % unit, 25 % intégration, 15 % E2E — heuristique de feedback et maintenabilité, pas un dogme.
3. Choisir le niveau par ce qu'on teste : logique domaine → unit, contrat HTTP/SQL → intégration, UX critique → E2E.
4. Suite maintenable = isolation totale + nommage comportemental + reset systématique en `afterEach`.
5. Coverage gates : `thresholds` dans `vitest.config.ts` (statements 80 %, branches 75 %) — exit 1 si non atteint, CI bloque la PR.
6. Pipeline CI : lint → unit+intégration (gate coverage) → E2E (sharding) → artifacts.
7. Ne jamais couvrir la même logique à 3 niveaux : chaque test a une raison d'exister à son niveau.
8. Ce cours a couvert 18 modules : anatomie, Vitest, mocks, async, fixtures, intégration, MSW, Prisma, composants, Playwright, visual, a11y, contract, CI, performance — tout s'assemble ici.

## 7. Seeds Anki

```
Quelle est la distribution pratique de la pyramide de tests ?|60 % unit, 25 % intégration, 15 % E2E
Comment configurer un coverage gate dans Vitest qui bloque la CI ?|thresholds dans vitest.config.ts (statements/branches/functions/lines) — Vitest sort avec exit code 1 si un seuil est franchi
Quand choisir un test d'intégration plutôt qu'un test unitaire ?|Quand on veut vérifier le contrat HTTP, la persistance SQL ou le middleware auth avec leur vraie couche
Qu'est-ce qu'une suite maintenable ?|Tests isolés (beforeEach reconstruit l'état), nommage comportemental, reset afterEach, aucune dépendance entre tests
Antipattern "pyramide inversée" — quel est le problème concret ?|CI lente (30+ min), feedback lent, bugs difficiles à localiser dans un scénario de 12 étapes
À quel niveau tester la règle ALREADY_INVITED de InvitationService ?|En unit — logique domaine pure, isolation totale, toutes les branches couvertes en quelques ms
Pourquoi rédiger une stratégie de test avant de coder ?|Pour éviter redondances entre niveaux, trous sur les cas limites, et coverage artificiel sur le code facile
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-18-projet-final/`. Capstone : tu écris la suite complète de la feature invitation TribuZen — unit (Vitest, doubles DI), intégration (Supertest + Prisma), E2E (Playwright Page Object) — et tu configures le pipeline CI avec coverage gate.

---

## Navigation

| Précédent | Note |
|-----------|------|
| [17 — Performance testing](17-performance-testing.md) | Dernier module du parcours 06-testing |
