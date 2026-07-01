# Lab 11 — Playwright avancé

> **Outcome :** à la fin, tu sais structurer une suite E2E TribuZen avec le Page Object Model, réutiliser une session authentifiée via `storageState`, mocker le réseau avec `page.route()`, et créer une fixture custom avec `test.extend` — en **Playwright réel**.
> **Vrai outil :** `@playwright/test` (`page.route`, `storageState`, `test.extend`, `toHaveScreenshot`, fixture `request`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

La suite E2E TribuZen grossit. On part d'un code existant **à ne pas modifier** et on ajoute la structure avancée autour.

**Code de départ fourni (existant dans le repo) :**

```ts
// e2e/tests/membres-brut.spec.ts — AVANT refacto (ne pas modifier)
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // login répété avant chaque test
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('alice@tribu.fr');
  await page.getByLabel(/mot de passe/i).fill('secret42');
  await page.getByRole('button', { name: /connexion/i }).click();
  await page.waitForURL('/tableau-de-bord');
  await page.goto('/famille/membres');
});

test('affiche les membres', async ({ page }) => {
  await expect(
    page.getByRole('list', { name: /membres de la famille/i })
      .getByRole('listitem')
  ).toHaveCount(3);
  await expect(page.getByRole('listitem').filter({ hasText: 'Alice Martin' })).toBeVisible();
});

test('invite un membre', async ({ page }) => {
  await page.route('**/api/invitations', async (route) => {
    await route.fulfill({ status: 201, json: { id: 'inv-1', email: 'bob@tribu.fr' } });
  });
  await page.getByRole('button', { name: /inviter/i }).click();
  await page.getByLabel(/adresse email/i).fill('bob@tribu.fr');
  await page.getByRole('button', { name: /envoyer l'invitation/i }).click();
  await expect(
    page.getByRole('list', { name: /membres de la famille/i })
      .getByRole('listitem').filter({ hasText: 'bob@tribu.fr' })
  ).toBeVisible();
});
```

Ta mission : restructurer cette suite avec POM + `storageState` + fixture custom. Le comportement testé reste identique — seule la structure change.

## Étapes (en friction)

1. **Page Object `PageMembres`.** Crée `e2e/pages/BasePage.ts` (classe abstraite avec `goto(chemin)`) et `e2e/pages/PageMembres.ts` qui étend `BasePage`. Expose : `boutonInviter` (getter), `champEmail` (getter), `listeMembres` (getter), `ligneMembre(texte)` (méthode), `goto()`, `inviterMembre(email)`, `verifierMembreVisible(texte)`, `verifierNombreMembres(n)`. Aucun `page.getByRole` ne doit apparaître dans les tests.

2. **Global setup `storageState`.** Crée `e2e/global-setup.ts` qui lance Chromium, navigue vers `/login`, se connecte avec `alice@tribu.fr` / `secret42`, attend `/tableau-de-bord`, puis sauvegarde l'état avec `page.context().storageState({ path: 'e2e/.auth/alice.json' })`. Ajoute `e2e/.auth/` à `.gitignore`.

3. **Config Playwright.** Dans `playwright.config.ts`, ajoute `globalSetup: './e2e/global-setup.ts'` et `use: { storageState: 'e2e/.auth/alice.json' }`. Vérifie que les tests du dossier `auth/` démarrent sans aucun appel à `/login`.

4. **Fixture custom `test.extend`.** Crée `e2e/fixtures/index.ts` qui exporte un `test` étendu avec `pageMembres: PageMembres`. Réécris les deux tests en important `{ test, expect }` depuis `../fixtures` et en utilisant `pageMembres` injecté.

5. **Mock réseau `page.route()`.** Dans le test "invite un membre", vérifie que `page.route('**/api/invitations', ...)` est déclaré **avant** `pageMembres.goto()`. Ajoute un troisième test qui simule une erreur réseau avec `route.abort('connectionrefused')` et vérifie qu'un message d'erreur apparaît sur la page.

6. **Test visuel.** Ajoute un test qui navigue vers `/famille/membres`, fige les `.horodatage` avec `evaluateAll`, masque les `.avatar` avec `mask`, et assert avec `toHaveScreenshot('page-membres.png', { fullPage: true, maxDiffPixelRatio: 0.01 })`. Lance une première fois avec `--update-snapshots` pour créer le snapshot de référence.

Contrainte : **aucun `page.getByRole` ou `page.getByLabel` ne doit apparaître dans les fichiers `*.spec.ts`** — tous les sélecteurs sont dans les Page Objects.

## Corrigé complet commenté

```ts
// e2e/pages/BasePage.ts
import { type Page, type Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  // Méthode utilitaire partagée par tous les Page Objects
  async goto(chemin: string): Promise<void> {
    await this.page.goto(chemin);
  }

  // Locator de navigation commun
  protected get nav(): Locator {
    return this.page.getByRole('navigation', { name: /principale/i });
  }
}
```

```ts
// e2e/pages/PageMembres.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class PageMembres extends BasePage {
  readonly url = '/famille/membres';

  constructor(page: Page) {
    super(page);
  }

  // --- Locators — getters ré-évalués à chaque accès ---

  get boutonInviter(): Locator {
    // Pointeur vivant : ré-évalué à chaque appel, pas un nœud DOM figé
    return this.page.getByRole('button', { name: /inviter/i });
  }

  get champEmail(): Locator {
    return this.page.getByLabel(/adresse email/i);
  }

  get listeMembres(): Locator {
    return this.page.getByRole('list', { name: /membres de la famille/i });
  }

  // Méthode retournant un Locator filtré par texte
  ligneMembre(texte: string): Locator {
    return this.listeMembres.getByRole('listitem').filter({ hasText: texte });
  }

  // --- Actions ---

  async goto(): Promise<void> {
    // Surcharge spécialisée : navigue vers l'URL de cette page
    await this.page.goto(this.url);
  }

  async inviterMembre(email: string): Promise<void> {
    await this.boutonInviter.click();
    await this.champEmail.fill(email);
    await this.page.getByRole('button', { name: /envoyer l'invitation/i }).click();
  }

  // --- Assertions ---

  async verifierMembreVisible(texte: string): Promise<void> {
    // Le expect est dans le Page Object, pas dans le test
    await expect(this.ligneMembre(texte)).toBeVisible();
  }

  async verifierNombreMembres(n: number): Promise<void> {
    await expect(this.listeMembres.getByRole('listitem')).toHaveCount(n);
  }
}
```

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

  // Persiste cookies + localStorage dans un fichier JSON
  // Ce fichier est rechargé par la config pour chaque test
  await page.context().storageState({ path: 'e2e/.auth/alice.json' });
  await browser.close();
  // Gain : 30 tests × 5 s login = 150 s → 5 s (une fois)
}
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    storageState: 'e2e/.auth/alice.json', // tous les tests démarrent connectés
  },
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      threshold: 0.2,
      maxDiffPixelRatio: 0.01,
    },
  },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  fullyParallel: true,
});
```

```ts
// e2e/fixtures/index.ts — test étendu avec les Page Objects TribuZen
import { test as base, expect } from '@playwright/test';
import { PageMembres } from '../pages/PageMembres';

interface TribuZenFixtures {
  pageMembres: PageMembres;
}

export const test = base.extend<TribuZenFixtures>({
  pageMembres: async ({ page }, use) => {
    // setup : instancie le Page Object avec la page fournie par Playwright
    const pm = new PageMembres(page);
    await use(pm);
    // teardown : ici on pourrait nettoyer les données créées par le test
  },
});

// Ré-exporter expect pour que les fichiers de test n'aient qu'un import
export { expect };
```

```ts
// e2e/tests/auth/membres.spec.ts — version refactorisée
import { test, expect } from '../../fixtures';

test.describe('Page Membres TribuZen', () => {
  test.beforeEach(async ({ pageMembres }) => {
    // storageState déjà chargé par la config — pas de login ici
    await pageMembres.goto();
  });

  test('affiche les membres existants de la famille', async ({ pageMembres }) => {
    // Aucun sélecteur dans le test — uniquement des appels de méthodes métier
    await pageMembres.verifierNombreMembres(3);
    await pageMembres.verifierMembreVisible('Alice Martin');
  });

  test('invite un nouveau membre et le voit apparaître', async ({ pageMembres, page }) => {
    // IMPORTANT : page.route() AVANT goto() — le handler doit être prêt avant les requêtes
    await page.route('**/api/invitations', async (route) => {
      // route.fulfill court-circuite le réseau — réponse construite immédiatement
      await route.fulfill({
        status: 201,
        json: { id: 'inv-new', email: 'bob@tribu.fr', statut: 'en_attente' },
      });
    });

    await pageMembres.inviterMembre('bob@tribu.fr');
    // L'UI optimiste ajoute bob à la liste sans recharger la page
    await pageMembres.verifierMembreVisible('bob@tribu.fr');
  });

  test('affiche un message d\'erreur si l\'API est inaccessible', async ({ pageMembres, page }) => {
    // route.abort simule une coupure réseau
    await page.route('**/api/invitations', (route) => route.abort('connectionrefused'));

    await pageMembres.inviterMembre('charlie@tribu.fr');

    // L'UI doit afficher un message d'erreur — assertion directe sur la page
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/erreur|indisponible/i);
  });

  test('la page membres correspond au snapshot visuel', async ({ page }) => {
    await page.goto('/famille/membres');
    await page.waitForLoadState('networkidle');

    // Figer les éléments dynamiques avant la capture
    await page.locator('.horodatage').evaluateAll((els) => {
      els.forEach((el) => { (el as HTMLElement).textContent = '01/07/2026'; });
    });

    await expect(page).toHaveScreenshot('page-membres.png', {
      fullPage: true,
      // mask : zones instables exclues du diff (avatars chargés depuis CDN)
      mask: [page.locator('.avatar')],
    });
    // Premier run : npx playwright test --update-snapshots pour créer le snapshot
  });
});
```

Points de validation par le coach : (a) aucun `page.getByRole`/`page.getByLabel` dans les fichiers `*.spec.ts` — tout est dans les Page Objects ; (b) `global-setup.ts` génère `e2e/.auth/alice.json` en UNE exécution ; (c) `page.route()` est déclaré avant `pageMembres.goto()` dans les tests qui mockent le réseau ; (d) `route.abort` simule une coupure réseau réelle ; (e) `mask` exclut les zones instables du diff visuel.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 25 min**, avec ces contraintes supplémentaires :

1. Ajoute un **Page Object `PageFamille`** (URL `/famille`, un seul getter `lienMembres` qui retourne le lien de nav vers la page membres, et une méthode `allerVersMembres()` qui clique dessus).
2. Écris un test qui part de `PageFamille`, navigue vers `PageMembres` **via le lien de navigation** (pas via `goto`), et vérifie que la liste des membres est visible.
3. Ajoute à la fixture `index.ts` une fixture `pageFamille: PageFamille` et injecte-la dans le test.
4. Sans regarder la config, explique à voix haute la différence entre `fullyParallel: true` et `test.describe.configure({ mode: 'serial' })` — quand utiliser l'un, quand utiliser l'autre.
5. Bonus : crée un test d'API avec la fixture `request` qui vérifie que `GET /api/famille/membres` retourne un tableau avec au moins un membre ayant les propriétés `id`, `nom` et `email`.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `e2e/pages/PageLogin.ts`, `e2e/pages/PageMembres.ts`, `e2e/pages/BasePage.ts` à partir de la vraie structure des pages TribuZen (`/login`, `/famille/membres`).
2. Écris `e2e/global-setup.ts` avec les vraies credentials de test (variables d'env `TEST_EMAIL`, `TEST_PASSWORD`), génère `e2e/.auth/alice.json`.
3. Crée `e2e/fixtures/index.ts` avec `pageMembres` injecté.
4. Ajoute `e2e/.auth/` dans `.gitignore` du repo TribuZen.
5. Commit `smaurier/tribuzen` : `test(e2e): POM PageMembres + storageState + mock page.route sur /api/notifications`.
