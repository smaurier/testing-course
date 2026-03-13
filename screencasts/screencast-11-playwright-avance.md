# Screencast 11 — Playwright avance

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/11-playwright-avance.md`
- **Lab associe** : Lab 11
- **Prerequis** : Screencast 10

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Playwright installe avec navigateurs
- [ ] Application de demo demarree sur localhost:3000
- [ ] Fichier `modules/11-playwright-avance.md` ouvert

## Script

### [00:00-02:30] Introduction — Page Object Model (POM)

> Quand la suite de tests grandit, les selecteurs se repetent partout. Le Page Object Model encapsule l'interaction avec une page dans une classe dediee.

**Action** : Creer un Page Object.

```typescript
// e2e/pages/login.page.ts
import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Mot de passe');
    this.submitButton = page.getByRole('button', { name: 'Se connecter' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

**Action** : Utiliser le POM dans un test.

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';

test('should login with valid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('alice@test.com', 'password');
  await expect(page).toHaveURL('/tasks');
});

test('should show error with invalid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('alice@test.com', 'wrong');
  await expect(loginPage.errorMessage).toHaveText('Identifiants invalides');
});
```

### [02:30-06:00] Fixtures personnalisees

> Les fixtures de Playwright permettent d'injecter des dependances dans les tests, comme une authentification reutilisable.

**Action** : Creer une fixture d'authentification.

```typescript
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { TasksPage } from './pages/tasks.page';

type MyFixtures = {
  loginPage: LoginPage;
  tasksPage: TasksPage;
  authenticatedPage: void;
};

export const test = base.extend<MyFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  tasksPage: async ({ page }, use) => {
    await use(new TasksPage(page));
  },

  authenticatedPage: [async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('alice@test.com');
    await page.getByLabel('Mot de passe').fill('password');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/tasks');
    await use();
  }, { auto: false }],
});

export { expect };
```

### [06:00-09:00] storageState — Reutiliser l'authentification

> Se connecter dans `beforeEach` est lent. `storageState` sauvegarde les cookies et le localStorage pour les reutiliser.

**Action** : Configurer le global setup.

```typescript
// e2e/global-setup.ts
import { chromium } from '@playwright/test';

export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email').fill('alice@test.com');
  await page.getByLabel('Mot de passe').fill('password');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await page.context().storageState({ path: 'e2e/.auth/user.json' });
  await browser.close();
}
```

**Action** : Configurer le projet avec storageState.

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /global-setup\.ts/ },
    {
      name: 'chromium',
      use: {
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

### [09:00-12:00] Interception reseau — page.route()

> `page.route()` permet d'intercepter les requetes HTTP dans un test E2E — utile pour simuler des erreurs ou des donnees specifiques.

**Action** : Demontrer l'interception.

```typescript
test('should show error state when API fails', async ({ page }) => {
  await page.route('/api/tasks', route =>
    route.fulfill({ status: 500, body: 'Internal Server Error' })
  );

  await page.goto('/tasks');
  await expect(page.getByText('Erreur de chargement')).toBeVisible();
});

test('should show specific data', async ({ page }) => {
  await page.route('/api/tasks', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { id: '1', title: 'Tache importante', priority: 'high' },
      ]),
    })
  );

  await page.goto('/tasks');
  await expect(page.getByText('Tache importante')).toBeVisible();
});
```

### [12:00-14:30] Regression visuelle — toHaveScreenshot()

> Les screenshots permettent de detecter des regressions CSS involontaires.

**Action** : Creer un test visuel.

```typescript
test('should match homepage screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixelRatio: 0.01, // tolerer 1% de difference
  });
});

test('should match task card screenshot', async ({ page }) => {
  await page.goto('/tasks');
  const card = page.getByRole('listitem').first();
  await expect(card).toHaveScreenshot('task-card.png');
});
```

```bash
# Premiere execution : cree les screenshots de reference
npx playwright test --update-snapshots

# Executions suivantes : compare aux references
npx playwright test
```

### [14:30-16:30] Accessibilite — axe-core integration

**Action** : Tester l'accessibilite avec axe.

```typescript
import AxeBuilder from '@axe-core/playwright';

test('should have no accessibility violations', async ({ page }) => {
  await page.goto('/tasks');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### [16:30-18:00] Parallelisme et sharding

**Action** : Montrer la configuration CI.

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 2 : 0,
});
```

```bash
# Sharding pour la CI (repartir sur plusieurs machines)
npx playwright test --shard=1/4
npx playwright test --shard=2/4
npx playwright test --shard=3/4
npx playwright test --shard=4/4
```

### [18:00-19:30] Recapitulatif

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Page Object Model pour centraliser les selecteurs
2. Fixtures pour injecter des dependances reutilisables
3. storageState pour eviter de se reconnecter a chaque test
4. page.route() pour intercepter le reseau en E2E
5. toHaveScreenshot() pour la regression visuelle
6. Sharding pour paralleliser en CI

PROCHAINE ETAPE :
→ Screencast 12 : Couverture et mutation testing
```

## Points d'attention pour l'enregistrement
- Le POM avant/apres montre clairement la valeur — insister sur la maintenance
- La demo storageState doit montrer le gain de vitesse
- Les screenshots de regression visuelle sont tres visuels — montrer la diff
- Le test d'accessibilite avec axe est un quick win — le presenter comme tel
