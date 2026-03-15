# Screencast 10 — Playwright fondamentaux

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/10-playwright-fondamentaux.md`
- **Lab associe** : Lab 10
- **Prérequis** : Screencast 09

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal intégré ouvert
- [ ] Playwright installe avec navigateurs
- [ ] Application de demo demarree sur localhost:3000
- [ ] Fichier `modules/10-playwright-fondamentaux.md` ouvert

## Script

### [00:00-02:30] Introduction — Pourquoi Playwright ?

> Playwright est l'outil E2E le plus complet aujourd'hui. Cross-browser, auto-wait natif, codegen, trace viewer, support multi-onglets et iframes. Il couvre des cas que Cypress ne peut pas gérer.

**Action** : Afficher la comparaison.

```
FONCTIONNALITE      | PLAYWRIGHT        | CYPRESS          | SELENIUM
--------------------|-------------------|------------------|----------
Multi-navigateur    | Chromium, FF, WK  | Chromium (+FF)   | Tous
Auto-wait           | Natif             | Natif            | Manuel
Multi-onglets       | Oui               | Non              | Oui
Iframes             | Support natif     | Limite           | Support natif
Codegen             | Oui               | Non              | Non
Trace viewer        | Oui               | Timeline          | Non
Parallelisme        | Workers natifs    | Via CI splitting  | Grid
```

### [02:30-05:00] Installation et configuration

**Action** : Initialiser Playwright.

```bash
pnpm create playwright
```

**Action** : Expliquer `playwright.config.ts`.

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

> `webServer` demarre automatiquement l'application avant les tests. En CI, un nouveau serveur est lance. En local, on reutilise celui déjà demarre.

### [05:00-09:00] Premier test E2E — Navigation et assertions

**Action** : Créer `e2e/home.spec.ts`.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('should display the main heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Task Manager');
  });

  test('should navigate to tasks page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Mes taches' }).click();
    await expect(page).toHaveURL('/tasks');
    await expect(page.getByRole('heading')).toHaveText('Mes taches');
  });

  test('should show empty state for new user', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page.getByText('Aucune tache')).toBeVisible();
  });
});
```

**Action** : Exécuter les tests.

```bash
npx playwright test
npx playwright test --headed  # voir le navigateur
```

### [09:00-12:00] Auto-wait — Plus de flaky tests

> L'auto-wait est la fonctionnalite qui distingue Playwright. Chaque action attend automatiquement que l'élément soit pret.

**Action** : Expliquer le mécanisme.

```typescript
// Playwright attend automatiquement que le bouton soit :
// 1. Attache au DOM
// 2. Visible
// 3. Stable (pas d'animation)
// 4. Activé (pas disabled)
// 5. Pas masque par un autre element
await page.getByRole('button', { name: 'Sauvegarder' }).click();

// Les assertions attendent aussi (avec retry automatique)
await expect(page.getByText('Tache creee')).toBeVisible();
// ↑ Retry pendant 5 secondes par defaut
```

> Avec Selenium, il faut écrire des `waitForElement`, `sleep`, `waitForClickable`. Avec Playwright, c'est automatique. C'est la raison principale de la reduction des flaky tests.

### [12:00-14:30] Selecteurs Playwright — Locators

**Action** : Montrer les différents locators.

```typescript
// Par role (recommande)
page.getByRole('button', { name: 'Submit' });
page.getByRole('textbox', { name: 'Email' });
page.getByRole('heading', { level: 2 });

// Par label
page.getByLabel('Mot de passe');

// Par placeholder
page.getByPlaceholder('Rechercher...');

// Par texte
page.getByText('Bienvenue');
page.getByText(/bienvenue/i); // regex

// Par test id (dernier recours)
page.getByTestId('submit-button');

// Chainer les locators (filtrage)
page.getByRole('listitem').filter({ hasText: 'Task 1' });
page.getByRole('listitem').nth(0);
```

### [14:30-16:30] Codegen et Trace Viewer — Outils de productivite

**Action** : Lancer le codegen.

```bash
npx playwright codegen http://localhost:3000
```

> Codegen ouvre un navigateur et enregistre vos actions en code Playwright. C'est ideal pour démarrer un test : vous naviguez, cliquez, remplissez des formulaires, et le code est généré automatiquement.

**Action** : Montrer le trace viewer.

```bash
npx playwright test --trace on
npx playwright show-trace test-results/trace.zip
```

> Le trace viewer montre chaque action avec un screenshot avant/après, le réseau, la console, et le DOM. C'est l'outil de debugging ultime pour les tests E2E.

### [16:30-18:30] Hooks — beforeEach, afterEach

**Action** : Montrer les hooks.

```typescript
test.describe('Tasks CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Naviguer et s'authentifier avant chaque test
    await page.goto('/login');
    await page.getByLabel('Email').fill('alice@test.com');
    await page.getByLabel('Mot de passe').fill('password');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/tasks');
  });

  test('should create a new task', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvelle tache' }).click();
    await page.getByLabel('Titre').fill('Ecrire des tests');
    await page.getByRole('button', { name: 'Sauvegarder' }).click();
    await expect(page.getByText('Ecrire des tests')).toBeVisible();
  });
});
```

### [18:30-19:30] Récapitulatif

**Action** : Afficher le récapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Playwright = cross-browser + auto-wait + codegen + trace
2. webServer dans la config demarre l'app automatiquement
3. Auto-wait elimine les waits manuels et les sleep
4. Locators : getByRole > getByLabel > getByText > getByTestId
5. Codegen pour generer du code, trace viewer pour debugger

PROCHAINE ETAPE :
→ Screencast 11 : Playwright avance
```

## Points d'attention pour l'enregistrement
- La demo codegen est visuellement impressionnante — lui donner du temps
- Montrer le trace viewer avec un test qui echoue pour voir la valeur
- L'auto-wait est le point de vente principal — montrer qu'il n'y a pas de sleep
- Exécuter en mode --headed pour que le spectateur voie le navigateur
