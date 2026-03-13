# Module 11 — Playwright avance

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 4/5        | 90 min        | [Lab 11](../labs/lab-11-playwright-avance/) | [Quiz 11](../quizzes/quiz-11-playwright-avance.html) |

## Objectifs

- Implementer le pattern Page Object Model (POM) avec TypeScript
- Creer des fixtures personnalisees (auth, database, API)
- Reutiliser l'etat d'authentification avec `storageState`
- Intercepter le reseau avec `page.route()`
- Mettre en place la regression visuelle avec `toHaveScreenshot()`
- Tester l'accessibilite avec axe-core
- Tester les API REST directement avec la fixture `request`
- Configurer le parallelisme, le sharding et la CI
- Organiser les tests avec des tags et des reporters

---

## Page Object Model (POM)

Le Page Object Model est un pattern de design qui encapsule l'interaction avec une page dans une classe dediee. Chaque page (ou composant significatif) de l'application a sa propre classe.

### Pourquoi le POM ?

| Sans POM | Avec POM |
|----------|----------|
| Selecteurs dupliques dans chaque test | Selecteurs centralises dans un seul fichier |
| Si un selecteur change → modifier N tests | Si un selecteur change → modifier 1 fichier |
| Tests verbeux et difficiles a lire | Tests lisibles, orientes metier |
| Pas de reutilisation | Methodes reutilisables |

### BasePage : classe de base

```typescript
// e2e/pages/BasePage.ts
import { type Page, type Locator, expect } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  // --- Navigation commune ---

  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
  }

  // --- Elements communs (header, footer, etc.) ---

  get header(): Locator {
    return this.page.getByRole('banner');
  }

  get footer(): Locator {
    return this.page.getByRole('contentinfo');
  }

  get mainNavigation(): Locator {
    return this.page.getByRole('navigation', { name: /principale/i });
  }

  get userMenu(): Locator {
    return this.page.getByTestId('user-menu');
  }

  // --- Actions communes ---

  async clickNavLink(name: string | RegExp): Promise<void> {
    await this.mainNavigation.getByRole('link', { name }).click();
  }

  async getPageTitle(): Promise<string> {
    return this.page.title();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  // --- Notifications ---

  get successToast(): Locator {
    return this.page.getByRole('status').filter({ hasText: /succes/i });
  }

  get errorToast(): Locator {
    return this.page.getByRole('alert');
  }

  async expectSuccessMessage(message: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('status')).toContainText(message);
  }

  async expectErrorMessage(message: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('alert')).toContainText(message);
  }
}
```

### LoginPage

```typescript
// e2e/pages/LoginPage.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // URL de la page
  readonly url = '/login';

  constructor(page: Page) {
    super(page);
  }

  // --- Locators ---

  get emailInput(): Locator {
    return this.page.getByLabel('Adresse email');
  }

  get passwordInput(): Locator {
    return this.page.getByLabel('Mot de passe');
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /se connecter/i });
  }

  get forgotPasswordLink(): Locator {
    return this.page.getByRole('link', { name: /mot de passe oublie/i });
  }

  get rememberMeCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /se souvenir de moi/i });
  }

  get errorAlert(): Locator {
    return this.page.getByRole('alert');
  }

  // --- Actions ---

  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginWithRemember(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.rememberMeCheckbox.check();
    await this.submitButton.click();
  }

  // --- Assertions ---

  async expectToBeOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(this.url);
    await expect(this.page.getByRole('heading', { name: /connexion/i })).toBeVisible();
  }

  async expectLoginError(message: string | RegExp): Promise<void> {
    await expect(this.errorAlert).toBeVisible();
    await expect(this.errorAlert).toContainText(message);
  }

  async expectEmailValidationError(): Promise<void> {
    await expect(this.page.getByText(/email.*requis|format.*invalide/i)).toBeVisible();
  }
}
```

### DashboardPage

```typescript
// e2e/pages/DashboardPage.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  readonly url = '/dashboard';

  constructor(page: Page) {
    super(page);
  }

  // --- Locators ---

  get welcomeHeading(): Locator {
    return this.page.getByRole('heading', { name: /bienvenue/i });
  }

  get statsCards(): Locator {
    return this.page.locator('[data-testid^="stat-card-"]');
  }

  get recentActivity(): Locator {
    return this.page.getByRole('region', { name: /activite recente/i });
  }

  get quickActions(): Locator {
    return this.page.getByRole('region', { name: /actions rapides/i });
  }

  // --- Stat cards ---

  getStatCard(name: string): Locator {
    return this.page.getByTestId(`stat-card-${name}`);
  }

  async getStatValue(name: string): Promise<string> {
    const card = this.getStatCard(name);
    const value = card.locator('.stat-value');
    return value.textContent() as Promise<string>;
  }

  // --- Actions ---

  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async clickQuickAction(name: string | RegExp): Promise<void> {
    await this.quickActions.getByRole('link', { name }).click();
  }

  // --- Assertions ---

  async expectToBeOnDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(this.url);
    await expect(this.welcomeHeading).toBeVisible();
  }

  async expectStatsLoaded(): Promise<void> {
    await expect(this.statsCards).toHaveCount(4); // 4 cartes de stats
  }
});
```

### ProductListPage — exemple complet avec tableau

```typescript
// e2e/pages/ProductListPage.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductListPage extends BasePage {
  readonly url = '/admin/products';

  constructor(page: Page) {
    super(page);
  }

  // --- Locators ---

  get searchInput(): Locator {
    return this.page.getByRole('searchbox', { name: /rechercher/i });
  }

  get categoryFilter(): Locator {
    return this.page.getByRole('combobox', { name: /categorie/i });
  }

  get createButton(): Locator {
    return this.page.getByRole('link', { name: /nouveau produit/i });
  }

  get productRows(): Locator {
    return this.page.getByRole('row').filter({ has: this.page.getByRole('cell') });
  }

  get emptyState(): Locator {
    return this.page.getByText(/aucun produit/i);
  }

  get deleteDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  // --- Actions ---

  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Attendre le debounce
    await this.page.waitForResponse('**/api/products**');
  }

  async filterByCategory(category: string): Promise<void> {
    await this.categoryFilter.selectOption(category);
    await this.page.waitForResponse('**/api/products**');
  }

  async clickCreateProduct(): Promise<void> {
    await this.createButton.click();
  }

  async editProduct(name: string): Promise<void> {
    await this.getProductRow(name).getByRole('link', { name: /modifier/i }).click();
  }

  async deleteProduct(name: string): Promise<void> {
    await this.getProductRow(name).getByRole('button', { name: /supprimer/i }).click();
  }

  async confirmDelete(): Promise<void> {
    await this.deleteDialog.getByRole('button', { name: /confirmer/i }).click();
  }

  async cancelDelete(): Promise<void> {
    await this.deleteDialog.getByRole('button', { name: /annuler/i }).click();
  }

  // --- Helpers ---

  getProductRow(name: string): Locator {
    return this.page.getByRole('row', { name: new RegExp(name, 'i') });
  }

  async getProductCount(): Promise<number> {
    return this.productRows.count();
  }

  // --- Assertions ---

  async expectProductVisible(name: string): Promise<void> {
    await expect(this.getProductRow(name)).toBeVisible();
  }

  async expectProductNotVisible(name: string): Promise<void> {
    await expect(this.getProductRow(name)).not.toBeVisible();
  }

  async expectProductCount(count: number): Promise<void> {
    await expect(this.productRows).toHaveCount(count);
  }

  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }
}
```

### Utilisation dans les tests

```typescript
// e2e/tests/products/product-management.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { ProductListPage } from '../../pages/ProductListPage';

test.describe('Product management', () => {
  let loginPage: LoginPage;
  let productList: ProductListPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    productList = new ProductListPage(page);

    // Login
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'admin123');

    // Naviguer vers la liste des produits
    await productList.goto();
  });

  test('should search products', async () => {
    await productList.search('clavier');
    await productList.expectProductVisible('Clavier mecanique');
    await productList.expectProductNotVisible('Souris');
  });

  test('should delete a product', async () => {
    const initialCount = await productList.getProductCount();

    await productList.deleteProduct('Webcam HD');
    await productList.confirmDelete();

    await productList.expectProductCount(initialCount - 1);
    await productList.expectProductNotVisible('Webcam HD');
    await productList.expectSuccessMessage(/produit supprime/i);
  });

  test('should cancel delete', async () => {
    const initialCount = await productList.getProductCount();

    await productList.deleteProduct('Clavier mecanique');
    await productList.cancelDelete();

    await productList.expectProductCount(initialCount);
    await productList.expectProductVisible('Clavier mecanique');
  });
});
```

---

## Fixtures personnalisees

Les fixtures Playwright permettent d'injecter des dependances dans les tests.

### Fixture d'authentification

```typescript
// e2e/fixtures/auth.ts
import { test as base, type Page } from '@playwright/test';

// Types pour les fixtures
interface AuthFixtures {
  authenticatedPage: Page;
  adminPage: Page;
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Setup : se connecter
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Mot de passe').fill('user123');
    await page.getByRole('button', { name: /connexion/i }).click();
    await page.waitForURL('/dashboard');

    // Fournir la page authentifiee au test
    await use(page);

    // Teardown : se deconnecter
    await page.goto('/logout');
  },

  adminPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Mot de passe').fill('admin123');
    await page.getByRole('button', { name: /connexion/i }).click();
    await page.waitForURL('/dashboard');

    await use(page);

    await page.goto('/logout');
  },
});

export { expect } from '@playwright/test';
```

```typescript
// Usage dans les tests
import { test, expect } from '../fixtures/auth';

test('should access profile page', async ({ authenticatedPage: page }) => {
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: /mon profil/i })).toBeVisible();
});

test('should access admin panel', async ({ adminPage: page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /administration/i })).toBeVisible();
});
```

### Fixture de base de donnees

```typescript
// e2e/fixtures/database.ts
import { test as base } from '@playwright/test';
import { Pool } from 'pg';

interface DatabaseFixtures {
  db: Pool;
  seedUsers: (users: Array<{ name: string; email: string }>) => Promise<void>;
  cleanDatabase: () => Promise<void>;
}

export const test = base.extend<DatabaseFixtures>({
  db: async ({}, use) => {
    const pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://test:test@localhost:5433/testdb',
    });

    await use(pool);

    await pool.end();
  },

  seedUsers: async ({ db }, use) => {
    const seed = async (users: Array<{ name: string; email: string }>): Promise<void> => {
      for (const user of users) {
        await db.query(
          'INSERT INTO users (name, email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.name, user.email],
        );
      }
    };

    await use(seed);
  },

  cleanDatabase: async ({ db }, use) => {
    const clean = async (): Promise<void> => {
      await db.query('TRUNCATE TABLE orders, products, users CASCADE');
    };

    await use(clean);

    // Nettoyer automatiquement apres chaque test
    await db.query('TRUNCATE TABLE orders, products, users CASCADE');
  },
});

export { expect } from '@playwright/test';
```

### Fixture API

```typescript
// e2e/fixtures/api.ts
import { test as base, type APIRequestContext } from '@playwright/test';

interface ApiFixtures {
  apiContext: APIRequestContext;
  createTestProduct: (data: { name: string; price: number }) => Promise<{ id: string }>;
}

export const test = base.extend<ApiFixtures>({
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.API_URL ?? 'http://localhost:3001',
      extraHTTPHeaders: {
        'Authorization': 'Bearer test-admin-token',
        'Content-Type': 'application/json',
      },
    });

    await use(context);
    await context.dispose();
  },

  createTestProduct: async ({ apiContext }, use) => {
    const createdIds: string[] = [];

    const create = async (data: { name: string; price: number }): Promise<{ id: string }> => {
      const response = await apiContext.post('/api/products', { data });
      const product = await response.json();
      createdIds.push(product.id);
      return product;
    };

    await use(create);

    // Cleanup : supprimer les produits crees
    for (const id of createdIds) {
      await apiContext.delete(`/api/products/${id}`);
    }
  },
});

export { expect } from '@playwright/test';
```

### Combiner plusieurs fixtures

```typescript
// e2e/fixtures/index.ts
import { mergeTests } from '@playwright/test';
import { test as authTest } from './auth';
import { test as dbTest } from './database';
import { test as apiTest } from './api';

export const test = mergeTests(authTest, dbTest, apiTest);
export { expect } from '@playwright/test';
```

---

## Storage state : reutiliser l'authentification

Au lieu de se connecter avant chaque test, on peut sauvegarder l'etat de la session et le reutiliser.

### Global setup : creer le storage state

```typescript
// e2e/global-setup.ts
import { chromium, type FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig): Promise<void> {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();

  // --- Utilisateur standard ---
  const userPage = await browser.newPage();
  await userPage.goto(`${baseURL}/login`);
  await userPage.getByLabel('Email').fill('user@example.com');
  await userPage.getByLabel('Mot de passe').fill('user123');
  await userPage.getByRole('button', { name: /connexion/i }).click();
  await userPage.waitForURL(`${baseURL}/dashboard`);

  // Sauvegarder l'etat (cookies + localStorage)
  await userPage.context().storageState({ path: 'e2e/.auth/user.json' });
  await userPage.close();

  // --- Administrateur ---
  const adminPage = await browser.newPage();
  await adminPage.goto(`${baseURL}/login`);
  await adminPage.getByLabel('Email').fill('admin@example.com');
  await adminPage.getByLabel('Mot de passe').fill('admin123');
  await adminPage.getByRole('button', { name: /connexion/i }).click();
  await adminPage.waitForURL(`${baseURL}/dashboard`);

  await adminPage.context().storageState({ path: 'e2e/.auth/admin.json' });
  await adminPage.close();

  await browser.close();
}

export default globalSetup;
```

### Configuration avec projets dependants

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',

  projects: [
    // Projet de setup (s'execute en premier)
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },

    // Tests sans authentification
    {
      name: 'public',
      testMatch: '**/public/**/*.spec.ts',
      use: { storageState: { cookies: [], origins: [] } },
    },

    // Tests utilisateur standard
    {
      name: 'user',
      testMatch: '**/user/**/*.spec.ts',
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/user.json' },
    },

    // Tests administrateur
    {
      name: 'admin',
      testMatch: '**/admin/**/*.spec.ts',
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/admin.json' },
    },
  ],
});
```

### Ignorer le storage state dans git

```
# .gitignore
e2e/.auth/
```

---

## Interception reseau : `page.route()`

### Intercepter et modifier des reponses

```typescript
test('should display mock data from intercepted API', async ({ page }) => {
  // Intercepter l'appel API et retourner des donnees mockees
  await page.route('**/api/products', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        products: [
          { id: 'mock-1', name: 'Produit Mock', price: 42.00 },
        ],
      }),
    });
  });

  await page.goto('/products');
  await expect(page.getByText('Produit Mock')).toBeVisible();
  await expect(page.getByText('42,00')).toBeVisible();
});
```

### Simuler des erreurs

```typescript
test('should display error page on API failure', async ({ page }) => {
  await page.route('**/api/products', (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });

  await page.goto('/products');
  await expect(page.getByRole('alert')).toContainText(/erreur/i);
});
```

### Modifier une reponse existante

```typescript
test('should handle slow API response', async ({ page }) => {
  await page.route('**/api/products', async (route) => {
    // Laisser la requete passer au serveur reel
    const response = await route.fetch();
    const json = await response.json();

    // Modifier la reponse
    json.products = json.products.map((p: any) => ({
      ...p,
      price: p.price * 1.2, // +20%
    }));

    // Retourner la reponse modifiee avec un delai
    await new Promise((r) => setTimeout(r, 2000));
    await route.fulfill({ response, json });
  });

  await page.goto('/products');
  // Le loading spinner doit apparaitre pendant le delai
  await expect(page.getByRole('progressbar')).toBeVisible();
  // Puis les produits avec les prix modifies
  await expect(page.getByRole('progressbar')).not.toBeVisible();
});
```

### Bloquer des ressources

```typescript
test('should load page without third-party scripts', async ({ page }) => {
  // Bloquer les scripts tiers (analytics, ads, etc.)
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (
      url.includes('google-analytics') ||
      url.includes('facebook') ||
      url.includes('hotjar')
    ) {
      return route.abort();
    }
    return route.continue();
  });

  await page.goto('/');
  // Le test s'execute sans les scripts tiers
});
```

### Attendre une requete specifique

```typescript
test('should save form and wait for API response', async ({ page }) => {
  await page.goto('/products/new');

  await page.getByLabel('Nom').fill('Nouveau produit');
  await page.getByLabel('Prix').fill('99.99');

  // Attendre la reponse API apres le submit
  const [response] = await Promise.all([
    page.waitForResponse('**/api/products'),
    page.getByRole('button', { name: /creer/i }).click(),
  ]);

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.name).toBe('Nouveau produit');
});
```

---

## Regression visuelle : `toHaveScreenshot()`

### Test de base

```typescript
test('product card should match visual snapshot', async ({ page }) => {
  await page.goto('/products');

  // Screenshot de toute la page
  await expect(page).toHaveScreenshot('product-list.png');

  // Screenshot d'un element specifique
  const firstCard = page.locator('.product-card').first();
  await expect(firstCard).toHaveScreenshot('product-card.png');
});
```

### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  expect: {
    toHaveScreenshot: {
      // Tolerance : pourcentage de pixels differents accepte
      maxDiffPixelRatio: 0.01, // 1%

      // Ou en nombre absolu de pixels
      // maxDiffPixels: 100,

      // Seuil de difference par pixel (0-1)
      threshold: 0.2,

      // Animations : desactiver pour stabilite
      animations: 'disabled',
    },
  },

  // Dossier de sauvegarde des snapshots
  snapshotDir: './e2e/snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',
});
```

### Mettre a jour les snapshots

```bash
# Mettre a jour tous les snapshots
npx playwright test --update-snapshots

# Mettre a jour un test specifique
npx playwright test product-card.spec.ts --update-snapshots
```

### Bonnes pratiques pour la regression visuelle

```typescript
test('dashboard layout should be stable', async ({ page }) => {
  await page.goto('/dashboard');

  // Attendre que toutes les donnees soient chargees
  await page.waitForLoadState('networkidle');

  // Masquer les elements dynamiques (dates, compteurs temps reel)
  await page.locator('.timestamp').evaluateAll((elements) => {
    elements.forEach((el) => {
      (el as HTMLElement).textContent = '01/01/2025 12:00';
    });
  });

  // Masquer les avatars (charges depuis un CDN, peuvent varier)
  await page.locator('.avatar').evaluateAll((elements) => {
    elements.forEach((el) => {
      (el as HTMLElement).style.visibility = 'hidden';
    });
  });

  await expect(page).toHaveScreenshot('dashboard.png', {
    fullPage: true,
    mask: [page.locator('.ad-banner')], // Masquer les publicites
  });
});
```

---

## Accessibilite avec axe-core

### Installation

```bash
pnpm add -D @axe-core/playwright
```

### Test d'accessibilite de base

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('home page should have no a11y violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test('login form should be accessible', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page })
      .include('form')                    // Scanner uniquement le formulaire
      .withTags(['wcag2a', 'wcag2aa'])   // Standards WCAG 2 AA
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('product page should be accessible', async ({ page }) => {
    await page.goto('/products');

    const results = await new AxeBuilder({ page })
      .exclude('.third-party-widget')    // Exclure les widgets tiers
      .disableRules(['color-contrast'])  // Desactiver une regle specifique
      .analyze();

    // Afficher les violations en detail pour le debug
    if (results.violations.length > 0) {
      console.log('Accessibility violations:');
      results.violations.forEach((v) => {
        console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
        v.nodes.forEach((n) => {
          console.log(`    - ${n.html}`);
          console.log(`      Fix: ${n.failureSummary}`);
        });
      });
    }

    expect(results.violations).toEqual([]);
  });
});
```

### Fixture d'accessibilite reutilisable

```typescript
// e2e/fixtures/a11y.ts
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

interface A11yFixtures {
  checkA11y: (selector?: string) => Promise<void>;
}

export const test = base.extend<A11yFixtures>({
  checkA11y: async ({ page }, use) => {
    const check = async (selector?: string): Promise<void> => {
      let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);

      if (selector) {
        builder = builder.include(selector);
      }

      const results = await builder.analyze();

      // Formater les violations pour un message d'erreur lisible
      const violations = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
      }));

      expect(violations, `Accessibility violations found`).toEqual([]);
    };

    await use(check);
  },
});

export { expect };
```

```typescript
// Usage
import { test, expect } from '../fixtures/a11y';

test('dashboard should be accessible', async ({ page, checkA11y }) => {
  await page.goto('/dashboard');
  await checkA11y();
});

test('product form should be accessible', async ({ page, checkA11y }) => {
  await page.goto('/products/new');
  await checkA11y('form');
});
```

---

## API testing avec la fixture `request`

Playwright permet de tester les API REST directement, sans navigateur.

```typescript
import { test, expect } from '@playwright/test';

test.describe('API — Products', () => {
  test('GET /api/products should return product list', async ({ request }) => {
    const response = await request.get('/api/products');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.products).toBeInstanceOf(Array);
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.products[0]).toHaveProperty('id');
    expect(body.products[0]).toHaveProperty('name');
    expect(body.products[0]).toHaveProperty('price');
  });

  test('POST /api/products should create a product', async ({ request }) => {
    const response = await request.post('/api/products', {
      data: {
        name: 'Test Product',
        price: 49.99,
        category: 'electronics',
      },
      headers: {
        'Authorization': 'Bearer admin-token',
      },
    });

    expect(response.status()).toBe(201);

    const product = await response.json();
    expect(product.name).toBe('Test Product');
    expect(product.price).toBe(49.99);
    expect(product.id).toBeDefined();

    // Cleanup
    await request.delete(`/api/products/${product.id}`, {
      headers: { 'Authorization': 'Bearer admin-token' },
    });
  });

  test('GET /api/products/:id should return 404 for unknown product', async ({ request }) => {
    const response = await request.get('/api/products/nonexistent-id');

    expect(response.status()).toBe(404);
    expect(response.ok()).toBeFalsy();
  });

  test('POST /api/products should validate required fields', async ({ request }) => {
    const response = await request.post('/api/products', {
      data: { price: 10 }, // Missing name
      headers: { 'Authorization': 'Bearer admin-token' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('name');
  });
});
```

---

## Parallelisme et sharding

### Configuration des workers

```typescript
// playwright.config.ts
export default defineConfig({
  // Nombre de workers paralleles
  workers: process.env.CI ? 2 : 4, // Moins de workers en CI

  // Mode "fully parallel" : chaque test dans un fichier peut s'executer en parallele
  fullyParallel: true,

  // Ou par fichier de test
});
```

### Controler le parallelisme par fichier

```typescript
// Ce fichier s'execute en serie (tests dependants)
test.describe.configure({ mode: 'serial' });

test.describe('Checkout flow', () => {
  test('step 1: add to cart', async ({ page }) => { /* ... */ });
  test('step 2: fill address', async ({ page }) => { /* ... */ });
  test('step 3: payment', async ({ page }) => { /* ... */ });
  test('step 4: confirmation', async ({ page }) => { /* ... */ });
});
```

### Sharding pour la CI

```bash
# Diviser les tests en 4 shards
npx playwright test --shard=1/4  # Machine/job 1
npx playwright test --shard=2/4  # Machine/job 2
npx playwright test --shard=3/4  # Machine/job 3
npx playwright test --shard=4/4  # Machine/job 4
```

---

## CI : GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Start application
        run: npm run dev &
        env:
          NODE_ENV: test

      - name: Wait for app to be ready
        run: npx wait-on http://localhost:3000 --timeout 60000

      - name: Run E2E tests
        run: npx playwright test --shard=${{ matrix.shard }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ strategy.job-index }}
          path: playwright-report/
          retention-days: 7

      - name: Upload traces
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-traces-${{ strategy.job-index }}
          path: test-results/
          retention-days: 7
```

### Docker pour la CI

```dockerfile
# Dockerfile.e2e
FROM mcr.microsoft.com/playwright:v1.48.0-noble

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

CMD ["npx", "playwright", "test"]
```

---

## Reporters

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    // Console : liste des tests
    ['list'],

    // HTML : rapport interactif avec traces
    ['html', { open: 'never', outputFolder: 'playwright-report' }],

    // JSON : pour l'integration CI
    ['json', { outputFile: 'test-results/results.json' }],

    // JUnit : pour les systemes CI classiques (Jenkins, etc.)
    ['junit', { outputFile: 'test-results/junit.xml' }],

    // GitHub Actions : annotations dans les PR
    ...(process.env.CI ? [['github'] as const] : []),
  ],
});
```

---

## Test tagging

### Utiliser des tags pour organiser les tests

```typescript
// Tag avec @
test('should login @smoke @auth', async ({ page }) => {
  // Ce test fait partie des suites "smoke" et "auth"
});

test('should process checkout @regression @payment', async ({ page }) => {
  // Ce test fait partie des suites "regression" et "payment"
});

test('should handle edge case @slow', async ({ page }) => {
  // Test lent, a executer moins souvent
});
```

### Executer par tag

```bash
# Uniquement les tests @smoke
npx playwright test --grep @smoke

# Exclure les tests @slow
npx playwright test --grep-invert @slow

# Combinaison
npx playwright test --grep "@smoke|@critical"
```

### Tags avec `test.describe`

```typescript
test.describe('Smoke tests @smoke', () => {
  test('home page loads', async ({ page }) => { /* ... */ });
  test('login works', async ({ page }) => { /* ... */ });
  test('navigation works', async ({ page }) => { /* ... */ });
});

test.describe('Regression tests @regression', () => {
  test('complex form validation', async ({ page }) => { /* ... */ });
  test('concurrent editing', async ({ page }) => { /* ... */ });
});
```

---

## Global setup et teardown

```typescript
// e2e/global-setup.ts
import { type FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('Global setup: starting...');

  // 1. Seeder la base de donnees de test
  const { execSync } = await import('child_process');
  execSync('npm run db:seed:test', { stdio: 'inherit' });

  // 2. Creer les storage states d'authentification
  // (voir section Storage State ci-dessus)

  // 3. Verifier que l'application est disponible
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) break;
    } catch {
      if (i === maxRetries - 1) throw new Error('App not available');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log('Global setup: done');
}

export default globalSetup;
```

```typescript
// e2e/global-teardown.ts
import { type FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig): Promise<void> {
  console.log('Global teardown: cleaning up...');

  // Nettoyer la base de donnees de test
  const { execSync } = await import('child_process');
  execSync('npm run db:clean:test', { stdio: 'inherit' });

  console.log('Global teardown: done');
}

export default globalTeardown;
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // ...
});
```

---

## Architecture complete : e-commerce POM

```
e2e/
  .auth/                         # Storage states (gitignore)
    user.json
    admin.json
  fixtures/
    auth.ts                      # Fixture d'authentification
    database.ts                  # Fixture de base de donnees
    api.ts                       # Fixture API
    index.ts                     # Export combine
  pages/
    BasePage.ts                  # Classe de base
    LoginPage.ts                 # Page de connexion
    DashboardPage.ts             # Tableau de bord
    ProductListPage.ts           # Liste des produits
    ProductDetailPage.ts         # Detail d'un produit
    CartPage.ts                  # Panier
    CheckoutPage.ts              # Commande
    AdminProductsPage.ts         # Administration produits
  tests/
    public/                      # Tests sans auth
      home.spec.ts
      search.spec.ts
    user/                        # Tests utilisateur
      profile.spec.ts
      orders.spec.ts
      cart.spec.ts
      checkout.spec.ts
    admin/                       # Tests admin
      products.spec.ts
      orders.spec.ts
      users.spec.ts
    a11y/                        # Tests d'accessibilite
      pages.spec.ts
    visual/                      # Regression visuelle
      screenshots.spec.ts
    api/                         # Tests API
      products-api.spec.ts
      orders-api.spec.ts
  snapshots/                     # Snapshots visuels
  global-setup.ts
  global-teardown.ts
playwright.config.ts
```

---

## Exercice pratique

Implementez une suite de tests Playwright avancee pour un e-commerce :

1. **Page Objects** : LoginPage, ProductListPage, CartPage, CheckoutPage
2. **Fixtures** : authentification (user + admin), creation de produit via API
3. **Storage state** : login une seule fois, reutiliser la session
4. **Interception reseau** : simuler une erreur de paiement
5. **Regression visuelle** : page produit, panier vide, page de confirmation
6. **Accessibilite** : scanner toutes les pages principales
7. **Tags** : @smoke pour les tests critiques, @regression pour le reste
8. **CI** : GitHub Actions avec sharding sur 3 runners

> Solution dans le [Lab 11](../labs/lab-11-playwright-avance/)

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| [10 - Playwright fondamentaux](./10-playwright-fondamentaux) | [12 - Couverture et mutation testing](./12-couverture-et-mutation-testing) |

---

## Ressources

- [Quiz 11 : Testez vos connaissances](../quizzes/quiz-11-playwright-avance.html)
- [Lab 11 : Playwright avance](../labs/lab-11-playwright-avance/)
- Playwright — [Page Object Model](https://playwright.dev/docs/pom)
- Playwright — [Fixtures](https://playwright.dev/docs/test-fixtures)
- Playwright — [Authentication](https://playwright.dev/docs/auth)
- Playwright — [Visual comparisons](https://playwright.dev/docs/test-snapshots)
- Playwright — [API testing](https://playwright.dev/docs/api-testing)
- axe-core — [Playwright integration](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
- Playwright — [CI GitHub Actions](https://playwright.dev/docs/ci-intro)
