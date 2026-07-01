---
titre: Playwright avancé
cours: 06-testing
notions: [Page Object Model, storageState et auth persistée, interception réseau et mock de route, fixtures custom, tests visuels screenshot, parallélisme et sharding, retries et gestion de la flakiness, tests d'API avec request]
outcomes: [structurer une suite E2E avec le Page Object Model, réutiliser une session authentifiée via storageState, intercepter le réseau, gérer parallélisme et flakiness]
prerequis: [10-playwright-fondamentaux]
next: 12-couverture-et-mutation-testing
libs: [{ name: "@playwright/test", version: ^1 }]
tribuzen: suite E2E TribuZen structurée (POM des pages famille, auth réutilisée via storageState, mock réseau)
last-reviewed: 2026-07
---

# Playwright avancé

> **Outcomes — tu sauras FAIRE :** structurer une suite E2E avec le Page Object Model, réutiliser une session authentifiée via `storageState`, intercepter le réseau avec `page.route()`, créer des fixtures custom avec `test.extend`, configurer parallélisme et sharding, et gérer la flakiness avec retries.
> **Difficulté :** :star::star::star::star:

## 1. Cas concret d'abord

La suite E2E de TribuZen commence petit : deux tests qui vérifient la page login et la liste des membres de la famille. Au bout de deux semaines, la suite atteint 30 tests. Trois problèmes apparaissent :

```
// Fichier membres.spec.ts
await page.getByRole('button', { name: /inviter/i }).click(); // copié 8 fois

// Fichier famille.spec.ts
await page.getByRole('button', { name: /inviter/i }).click(); // même sélecteur

// Fichier profil.spec.ts — beforeEach qui se répète partout
await page.goto('/login');
await page.getByLabel(/email/i).fill('alice@tribu.fr');
await page.getByLabel(/mot de passe/i).fill('secret42');
await page.getByRole('button', { name: /connexion/i }).click(); // 30 tests × 5 s = 150 s perdues
```

Le sélecteur du bouton change de `/inviter/i` à `/ajouter un membre/i` : 12 fichiers à corriger. L'API `/notifications` est instable en CI : 3 tests flaky par semaine.

Trois problèmes, trois solutions :

| Problème | Solution |
|----------|----------|
| Sélecteurs dupliqués dans N fichiers | **Page Object Model** — 1 classe TypeScript par page |
| Re-login avant chaque test (150 s perdues) | **`storageState`** — 1 login en global setup, session rechargée |
| API externe instable | **`page.route()`** — mock réseau déterministe |

## 2. Théorie complète, concise

### Page Object Model (POM)

Le **Page Object Model** encapsule dans une classe TypeScript tout ce qui touche à une page UI : locators, actions, assertions. Les tests deviennent des séquences d'appels métier (`membresPage.inviterMembre('alice@tribu.fr')`) plutôt que des séquences de `page.getByRole(...)`.

**BasePage — classe abstraite partagée :**

```ts
// e2e/pages/BasePage.ts
import { type Page, type Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  protected get nav(): Locator {
    return this.page.getByRole('navigation', { name: /principale/i });
  }

  async allerVers(chemin: string): Promise<void> {
    await this.page.goto(chemin);
  }
}
```

**PageMembres — Page Object concret :**

```ts
// e2e/pages/PageMembres.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class PageMembres extends BasePage {
  readonly url = '/famille/membres';

  constructor(page: Page) {
    super(page);
  }

  // --- Locators (get = ré-évalués à chaque accès, jamais cachés) ---
  get boutonInviter(): Locator {
    return this.page.getByRole('button', { name: /inviter/i });
  }

  get champEmail(): Locator {
    return this.page.getByLabel(/adresse email/i);
  }

  get listeMembres(): Locator {
    return this.page.getByRole('list', { name: /membres de la famille/i });
  }

  ligneMembre(nom: string): Locator {
    return this.listeMembres.getByRole('listitem').filter({ hasText: nom });
  }

  // --- Actions ---
  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async inviterMembre(email: string): Promise<void> {
    await this.boutonInviter.click();
    await this.champEmail.fill(email);
    await this.page.getByRole('button', { name: /envoyer l'invitation/i }).click();
  }

  // --- Assertions ---
  async verifierMembreVisible(texte: string): Promise<void> {
    await expect(this.ligneMembre(texte)).toBeVisible();
  }

  async verifierNombreMembres(n: number): Promise<void> {
    await expect(this.listeMembres.getByRole('listitem')).toHaveCount(n);
  }
}
```

Règles POM :
- **1 classe par page** (ou composant significatif). Pas de dieu-objet qui couvre tout le site.
- Les **locators** sont des propriétés `get` (ré-évalués à chaque accès — un `Locator` Playwright est un pointeur vivant, pas un nœud DOM figé).
- Les **actions** retournent `Promise<void>` ; les **assertions** contiennent le `expect`.
- Les **tests** restent courts : intention métier, pas détails DOM.

### `storageState` et auth persistée

`storageState` sauvegarde cookies + `localStorage` d'un contexte browser dans un fichier JSON. Ce fichier est rechargé en début de chaque test via `use.storageState` — le test démarre déjà authentifié.

**Sauvegarder l'état (global setup — s'exécute une fois) :**

```ts
// e2e/global-setup.ts
import { chromium } from '@playwright/test';

export default async function globalSetup(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5173/login');
  await page.getByLabel(/email/i).fill('alice@tribu.fr');
  await page.getByLabel(/mot de passe/i).fill('secret42');
  await page.getByRole('button', { name: /connexion/i }).click();
  await page.waitForURL('/tableau-de-bord');

  // Persiste cookies + localStorage dans un fichier JSON
  await page.context().storageState({ path: 'e2e/.auth/alice.json' });
  await browser.close();
}
```

**Utiliser l'état sauvegardé dans `playwright.config.ts` :**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    storageState: 'e2e/.auth/alice.json', // tous les tests démarrent connectés
  },
  projects: [
    {
      name: 'public',
      testMatch: '**/public/**',
      use: { storageState: { cookies: [], origins: [] } }, // pages publiques = déconnecté
    },
    {
      name: 'authenticated',
      testMatch: '**/auth/**',
      // hérite du storageState global (alice.json)
    },
  ],
});
```

Ajouter `e2e/.auth/` dans `.gitignore` — ces fichiers contiennent des tokens de session.

Depuis Playwright v1.31+, l'approche recommandée est le **setup project** avec `dependencies: ['setup']` plutôt que `globalSetup` seul, pour bénéficier du cache entre runs CI et d'un meilleur parallélisme.

### `page.route()` — interception réseau et mock de route

`page.route(pattern, handler)` intercepte toutes les requêtes correspondant au pattern avant qu'elles partent réseau. **Doit être déclaré avant `page.goto()`.**

Dans le handler, trois choix :

| Méthode | Effet |
|---------|-------|
| `route.fulfill({ json, status })` | Court-circuite : renvoie une réponse construite |
| `route.continue()` | Laisse passer (pass-through) |
| `route.abort()` | Simule un échec réseau |

```ts
// Mock complet — remplace la réponse réseau
await page.route('**/api/notifications', async (route) => {
  await route.fulfill({
    status: 200,
    json: { notifications: [{ id: '1', message: 'Alice a accepté l'invitation' }] },
  });
});

// Pass-through + mutation — la requête part, on modifie la réponse retour
await page.route('**/api/famille/membres', async (route) => {
  const response = await route.fetch();
  const data = await response.json();
  data.membres.push({ id: 'extra', nom: 'Charlie (injecté)' });
  await route.fulfill({ response, json: data });
});

// Erreur réseau — simule une coupure
await page.route('**/api/invitations', (route) => route.abort('connectionrefused'));
```

Supprimer un handler : `await page.unroute('**/api/notifications')`.

### Fixtures custom — `test.extend`

`test.extend<T>()` crée un nouveau `test` augmenté de fixtures injectées. C'est le mécanisme DI de Playwright : les tests reçoivent des objets préparés sans boilerplate de setup.

```ts
// e2e/fixtures/index.ts
import { test as base, expect } from '@playwright/test';
import { PageMembres } from '../pages/PageMembres';
import { PageLogin } from '../pages/PageLogin';

interface TribuZenFixtures {
  pageMembres: PageMembres;
  pageLogin: PageLogin;
}

export const test = base.extend<TribuZenFixtures>({
  pageMembres: async ({ page }, use) => {
    // setup
    const pm = new PageMembres(page);
    await use(pm);
    // teardown optionnel ici (ex: nettoyer les données créées)
  },

  pageLogin: async ({ page }, use) => {
    await use(new PageLogin(page));
  },
});

export { expect };
```

Usage dans les tests — un seul import suffit :

```ts
import { test, expect } from '../fixtures';

test('invite un membre', async ({ pageMembres }) => {
  await pageMembres.goto();
  await pageMembres.inviterMembre('bob@tribu.fr');
  await pageMembres.verifierMembreVisible('bob@tribu.fr');
});
```

Les fixtures se composent : une fixture peut dépendre d'une autre (ex. `pageMembres` dépend de `page`). Les fixtures de scope `worker` sont partagées entre tous les tests d'un worker — utile pour un contexte DB de test ou une session API.

### Tests visuels — `toHaveScreenshot()`

`toHaveScreenshot(name)` prend un screenshot et le compare au snapshot de référence (créé au premier run avec `--update-snapshots`). Le test échoue si le diff dépasse le seuil configuré.

```ts
test('la page membres correspond au snapshot', async ({ page }) => {
  await page.goto('/famille/membres');
  await page.waitForLoadState('networkidle');

  // Figer les éléments dynamiques avant capture
  await page.locator('.horodatage').evaluateAll((els) => {
    els.forEach((el) => { (el as HTMLElement).textContent = '01/07/2026'; });
  });

  await expect(page).toHaveScreenshot('page-membres.png', {
    fullPage: true,
    mask: [page.locator('.avatar')], // avatars CDN → instables → masqués
    maxDiffPixelRatio: 0.01,
  });
});
```

Configuration dans `playwright.config.ts` :

```ts
expect: {
  toHaveScreenshot: {
    animations: 'disabled',  // stop CSS/JS animations avant capture
    threshold: 0.2,
    maxDiffPixelRatio: 0.01,
  },
},
```

Mettre à jour les snapshots : `npx playwright test --update-snapshots`.

### Parallélisme et sharding

**Workers** : Playwright lance N workers (processus isolés, chacun avec son propre browser context). Par défaut autant que de CPU logiques.

```ts
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 2 : undefined, // undefined = auto (CPUs)
  fullyParallel: true, // chaque test dans un fichier tourne en parallèle
});
```

`test.describe.configure({ mode: 'serial' })` force l'exécution séquentielle d'un bloc (tests à étapes dépendantes, ex. flux checkout step-by-step).

**Sharding** : découper la suite en N tranches pour paralléliser sur N machines CI.

```bash
# Chaque job CI reçoit un shard différent (même suite totale, exécution distribuée)
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

Dans GitHub Actions :

```yaml
strategy:
  matrix:
    shard: [1, 2, 3]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/3
```

### Retries et gestion de la flakiness

Un **test flaky** passe parfois et échoue parfois sans changement de code — souvent dû à un timing UI non attendu ou une dépendance réseau non mockée.

```ts
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0, // 0 en local (fail vite), 2 en CI (filet de sécurité)
});
```

En CI, un test qui échoue au 1ᵉʳ essai est rejoué. S'il passe au 2ᵉ, il est signalé **flaky** dans le rapport HTML (compté comme réussi mais à investiguer). S'il échoue 3 fois, il échoue définitivement.

Stratégies anti-flakiness :
- **Attendre le bon signal** : `waitForURL`, `waitForResponse`, `expect(locator).toBeVisible()` plutôt que `waitForTimeout` (sleep arbitraire).
- **Mocker les APIs externes** : `page.route()` supprime l'instabilité réseau.
- **Désactiver les animations** : `animations: 'disabled'` dans `toHaveScreenshot`, ou `page.emulateMedia({ reducedMotion: 'reduce' })` pour les tests d'interaction.
- **Isoler les données par test** : chaque test crée ses propres données (email unique, ID unique) — pas de dépendance sur l'ordre d'exécution.

Diagnostiquer un test flaky : relancer avec `--repeat-each=20` pour reproduire, puis inspecter la trace Playwright (`test-results/*.zip`) — elle enregistre chaque action avec captures et réseau.

### Tests d'API avec `request`

La fixture `request` (type `APIRequestContext`) envoie des requêtes HTTP directement, sans ouvrir de navigateur. Idéal pour valider un endpoint avant d'écrire le test UI, ou pour préparer/nettoyer les données de test.

```ts
import { test, expect } from '@playwright/test';

test.describe('API TribuZen — invitations', () => {
  test('POST /api/invitations crée une invitation', async ({ request }) => {
    const response = await request.post('/api/invitations', {
      data: { familyId: 'fam-1', email: 'bob@tribu.fr' },
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.email).toBe('bob@tribu.fr');
  });

  test('GET /api/invitations/:id retourne 404 pour un id inconnu', async ({ request }) => {
    const response = await request.get('/api/invitations/nonexistent');
    expect(response.status()).toBe(404);
    expect(response.ok()).toBeFalsy();
  });

  test('DELETE /api/invitations/:id annule une invitation', async ({ request }) => {
    // Préparer la donnée via API (pas besoin d'UI)
    const created = await request.post('/api/invitations', {
      data: { familyId: 'fam-1', email: 'tmp@tribu.fr' },
      headers: { Authorization: 'Bearer test-token' },
    });
    const { id } = await created.json();

    const deleted = await request.delete(`/api/invitations/${id}`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(deleted.status()).toBe(200);
  });
});
```

`request` respecte le `baseURL` configuré dans `playwright.config.ts`. On peut créer un contexte HTTP dédié avec `playwright.request.newContext({ extraHTTPHeaders: {...} })` dans une fixture custom.

## 3. Worked examples

### Exemple A — POM `PageMembres` + fixture custom

Objectif : prouver que l'invitation d'un nouveau membre apparaît dans la liste, sans répéter les sélecteurs dans le test.

```ts
// e2e/fixtures/index.ts — test étendu avec les Page Objects TribuZen
import { test as base, expect } from '@playwright/test';
import { PageMembres } from '../pages/PageMembres';

interface Fixtures {
  pageMembres: PageMembres;
}

export const test = base.extend<Fixtures>({
  pageMembres: async ({ page }, use) => {
    await use(new PageMembres(page));
  },
});

export { expect };
```

```ts
// e2e/tests/auth/membres.spec.ts
import { test, expect } from '../../fixtures';

test.describe('Page Membres TribuZen', () => {
  test.beforeEach(async ({ pageMembres }) => {
    // storageState déjà chargé par la config → pas de login ici
    await pageMembres.goto();
  });

  test('affiche les membres existants de la famille', async ({ pageMembres }) => {
    // Assertion via méthode POM — aucun sélecteur exposé dans le test
    await pageMembres.verifierNombreMembres(3);
    await pageMembres.verifierMembreVisible('Alice Martin');
  });

  test('invite un nouveau membre et le voit apparaître', async ({ pageMembres, page }) => {
    // Mock de l'appel POST invitations : test déterministe même sans backend
    // IMPORTANT : page.route() avant page.goto()
    await page.route('**/api/invitations', async (route) => {
      await route.fulfill({
        status: 201,
        json: { id: 'inv-new', email: 'bob@tribu.fr', statut: 'en_attente' },
      });
    });

    await pageMembres.inviterMembre('bob@tribu.fr');

    // L'UI optimiste ajoute bob à la liste sans recharger la page
    await pageMembres.verifierMembreVisible('bob@tribu.fr');
  });
});
```

Pas-à-pas : (1) `fixtures/index.ts` expose `test` avec `pageMembres` injectée — le test n'instancie jamais `PageMembres` lui-même ; (2) `page.route()` intercepte le POST avant qu'il parte réseau — test stable même sans backend ; (3) les assertions sont des méthodes POM — si le sélecteur de la liste change, on corrige `PageMembres.ts` uniquement.

### Exemple B — `storageState` et auth réutilisée

Objectif : login une seule fois pour 30 tests, économiser 150 s par run.

```ts
// e2e/global-setup.ts — s'exécute UNE FOIS avant toute la suite
import { chromium } from '@playwright/test';

export default async function globalSetup(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5173/login');
  await page.getByLabel(/email/i).fill('alice@tribu.fr');
  await page.getByLabel(/mot de passe/i).fill('secret42');
  await page.getByRole('button', { name: /connexion/i }).click();
  await page.waitForURL('/tableau-de-bord');

  // Sauvegarder l'état complet (cookies + localStorage + tokens JWT)
  await page.context().storageState({ path: 'e2e/.auth/alice.json' });
  await browser.close();
}
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    storageState: 'e2e/.auth/alice.json', // chaque test démarre connecté
  },
});
```

```ts
// e2e/tests/auth/tableau-de-bord.spec.ts
import { test, expect } from '@playwright/test';

// Ce test démarre déjà connecté grâce au storageState — aucun login ici
test('affiche le tableau de bord de la famille', async ({ page }) => {
  await page.goto('/tableau-de-bord');
  await expect(page.getByRole('heading', { name: /tableau de bord/i })).toBeVisible();
  await expect(page.getByText('Alice Martin')).toBeVisible();
});
```

Le gain : 30 tests × 5 s de login = 150 s → 5 s (une fois en global setup). La session est partagée via le fichier JSON — le navigateur de chaque worker la recharge à froid.

## 4. Pièges & misconceptions

- **Locators dupliqués sans POM.** Copier-coller `page.getByRole('button', { name: /inviter/i })` dans 12 tests → quand le label change en "Ajouter un membre", 12 tests cassent. *Correct* : centraliser dans `PageMembres.boutonInviter` ; corriger en 1 endroit.

- **Re-login avant chaque test sans `storageState`.** Chaque `beforeEach` qui navigue vers `/login`, remplit le formulaire et attend la redirection ajoute 3-8 s par test. Sur 30 tests, c'est 90-240 s de connexions répétées. *Correct* : `storageState` + global setup → 1 seul login pour toute la suite.

- **Screenshots non déterministes.** `toHaveScreenshot` sur une page avec dates dynamiques, avatars CDN ou animations → le diff ne sera jamais stable. *Correct* : (a) `mask` pour masquer les zones instables, (b) `evaluateAll` pour figer les timestamps, (c) `animations: 'disabled'` dans la config.

- **`page.route()` déclaré après `page.goto()`.** Le handler ne s'active que pour les requêtes émises après son enregistrement. Si la page est déjà chargée et a déjà fait l'appel API, le mock arrive trop tard. *Correct* : toujours `page.route(...)` puis `page.goto(...)`.

- **`fullyParallel: true` avec tests à données partagées.** Si deux tests en parallèle modifient les mêmes lignes en base (ex. tous les deux créent un membre "Alice"), ils interfèrent. *Correct* : isoler les données par test (préfixer les emails avec un identifiant unique `alice-${Date.now()}@tribu.fr`) ou grouper les tests dépendants avec `test.describe.configure({ mode: 'serial' })`.

- **Confondre `retries` et correction de la flakiness.** Augmenter `retries` masque la cause réelle. Un test qui passe au 3ᵉ essai est un test dont le problème n'est pas résolu. *Correct* : retries = filet de sécurité temporaire en CI ; la cause profonde (timing, mock manquant, état partagé) doit être corrigée.

## 5. Ancrage TribuZen

Couche fil-rouge : **suite E2E TribuZen structurée (POM des pages famille, auth réutilisée via `storageState`, mock réseau)** (`smaurier/tribuzen`).

- `e2e/pages/PageLogin.ts` + `PageMembres.ts` + `PageFamille.ts` = les trois Page Objects des pages principales de TribuZen. Quand la nav change (renommage d'un lien ou refonte du formulaire), on corrige 1 fichier, pas 15 tests.
- `e2e/global-setup.ts` + `e2e/.auth/alice.json` = auth persistée pour toute la suite. En session, on écrit ce setup et on vérifie que `tableau-de-bord.spec.ts` démarre sans aucun appel à `/login`.
- `page.route('**/api/notifications')` = mock du service externe de notifications TribuZen. La suite tourne sans dépendance à l'API tierce — déterminisme garanti en CI.
- `e2e/fixtures/index.ts` avec `test.extend<{ pageMembres: PageMembres }>` = point d'entrée unique pour tous les tests. Un `import { test } from '../fixtures'` suffit — les Page Objects sont injectés, les tests n'ont pas de boilerplate.
- Tests `request` sur `/api/invitations` = contrat API validé avant d'écrire les tests UI correspondants.

## 6. Points clés

1. Le Page Object Model encapsule locators, actions et assertions dans une classe par page — les tests expriment l'intention métier, pas les sélecteurs DOM.
2. Les locators POM sont des `get` ré-évalués à chaque accès : un `Locator` Playwright est un pointeur vivant, pas un nœud DOM figé.
3. `storageState` sauvegarde cookies + `localStorage` ; rechargé via `use.storageState` dans la config, il évite le re-login par test.
4. `page.route(pattern, handler)` doit être déclaré avant `page.goto()` ; le handler choisit entre `fulfill`, `continue` ou `abort`.
5. `test.extend<Fixtures>` crée un `test` augmenté avec des objets injectés — chaque fixture peut dépendre d'autres fixtures en paramètre.
6. `toHaveScreenshot` compare au snapshot de référence ; masquer les zones dynamiques avec `mask` et `evaluateAll`, désactiver les animations.
7. `workers` + `fullyParallel: true` parallélise au niveau du test ; `--shard=N/M` distribue sur M machines CI.
8. `retries: 2` en CI rejoue les tests flaky ; les causes profondes sont les timings non attendus, les états partagés et les APIs externes non mockées.
9. La fixture `request` (type `APIRequestContext`) teste les endpoints HTTP sans ouvrir de navigateur — idéal pour valider le contrat API ou préparer les données de test.

## 7. Seeds Anki

```
Qu'est-ce que le Page Object Model ?|Un pattern qui encapsule locators, actions et assertions d'une page dans une classe TypeScript dédiée — les tests expriment l'intention, pas les sélecteurs DOM
Pourquoi les locators POM sont-ils des getter (get) et non des variables ?|Pour être ré-évalués à chaque accès — un Locator Playwright est un pointeur vivant, pas un nœud DOM figé au moment de l'affectation
À quoi sert storageState dans Playwright ?|Sauvegarder cookies + localStorage d'un contexte browser dans un fichier JSON, rechargeable pour démarrer les tests déjà authentifiés sans re-login
Dans quel ordre appeler page.route() et page.goto() ?|page.route() d'abord, puis page.goto() — le handler doit être enregistré avant que les requêtes partent
Quelle méthode dans page.route() court-circuite la requête avec une réponse construite ?|route.fulfill({ status, json }) — renvoie une réponse sans toucher le réseau réel
Comment créer une fixture custom injectée dans test ?|test.extend<{ maFixture: MonType }>({ maFixture: async ({ page }, use) => { await use(new MonType(page)); } })
Qu'est-ce que le sharding Playwright ?|Découper la suite en N tranches (--shard=K/N) pour distribuer l'exécution sur N machines CI en parallèle
Qu'indique Playwright quand un test passe au 2ᵉ retry après avoir échoué au 1ᵉr ?|Il est marqué "flaky" dans le rapport HTML — compté comme réussi mais signalé pour investigation
À quoi sert la fixture request dans Playwright ?|Envoyer des requêtes HTTP directement sans navigateur (APIRequestContext) — tester des endpoints REST ou préparer et nettoyer les données de test
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-11-playwright-avance/`. Tu y structures la suite E2E TribuZen avec `PageLogin` + `PageMembres` (POM complet), un global setup `storageState`, un mock `page.route()` sur l'API notifications, et une fixture `test.extend`. Corrigé complet commenté + variante J+30 dans le README.
