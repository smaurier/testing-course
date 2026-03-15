# Module 10 — Playwright : fondamentaux

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 3/5        | 90 min        | [Lab 10](../labs/lab-10-playwright-fondamentaux/) | [Quiz 10](../quizzes/quiz-10-playwright.html) |

## Objectifs

- Comprendre les avantages de Playwright (cross-browser, auto-wait, codegen, trace)
- Installer et configurer un projet Playwright
- Écrire des tests E2E avec la syntaxe `test` / `expect`
- Maîtriser la navigation, les selecteurs et les actions
- Utiliser les assertions spécifiques a Playwright
- Comprendre le mécanisme d'auto-wait
- Générer des tests avec Codegen et debugger avec Trace Viewer
- Mettre en place les hooks de test

---

## Pourquoi Playwright ?

### Le paysage des outils E2E

| Fonctionnalite | Playwright | Cypress | Selenium |
|----------------|-----------|---------|----------|
| Multi-navigateur | Chromium, Firefox, WebKit | Chromium (+ Firefox beta) | Tous |
| Auto-wait | Natif | Natif | Manuel |
| Langage | JS/TS, Python, Java, C# | JS/TS uniquement | Multi-langage |
| Iframes | Support natif | Limite | Support natif |
| Multi-onglets | Oui | Non | Oui |
| Parallelisme | Natif (workers) | Via CI splitting | Grid |
| Trace viewer | Integre | Dashboard (payant) | Non |
| Codegen | Oui | Non (Cypress Studio deprecie) | IDE plugins |
| API testing | Natif (request fixture) | Via cy.request() | Non |
| Vitesse | Très rapide | Rapide | Lent |

### Les avantages clés

1. **Cross-browser** : tester sur Chromium, Firefox et WebKit avec la même syntaxe
2. **Auto-wait** : Playwright attend automatiquement que les éléments soient prets
3. **Codegen** : générer du code de test en enregistrant vos actions dans le navigateur
4. **Trace Viewer** : debugger visuellement avec screenshots, DOM, réseau, console
5. **Isolation** : chaque test s'exécuté dans un contexte de navigateur isole
6. **API testing** : tester les API REST directement sans navigateur

---

## Installation

```bash
# Creer un nouveau projet Playwright
npm init playwright@latest

# Ou dans un projet existant
pnpm add -D @playwright/test

# Installer les navigateurs
npx playwright install
```

### Structure du projet

```
project/
  e2e/                        # Dossier des tests E2E
    fixtures/                  # Fixtures personnalisees
    pages/                     # Page Object Models
    tests/
      auth.spec.ts
      products.spec.ts
      checkout.spec.ts
  playwright.config.ts         # Configuration
  playwright-report/           # Rapports generes (gitignore)
  test-results/                # Resultats (gitignore)
```

---

## Configuration : `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Dossier contenant les fichiers de test
  testDir: './e2e/tests',

  // Pattern de fichiers de test
  testMatch: '**/*.spec.ts',

  // Timeout global par test (30 secondes)
  timeout: 30_000,

  // Timeout pour les expect (5 secondes)
  expect: {
    timeout: 5_000,
  },

  // Comportement en cas de test echoue
  retries: process.env.CI ? 2 : 0, // Retry en CI uniquement

  // Nombre de workers (parallelisme)
  workers: process.env.CI ? 1 : undefined, // Sequential en CI, parallel en local

  // Reporter
  reporter: [
    ['html', { open: 'never' }],   // Rapport HTML
    ['list'],                       // Sortie console
  ],

  // Options partagees par tous les projets
  use: {
    // URL de base de l'application
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',

    // Collecter la trace en cas d'echec
    trace: 'on-first-retry',

    // Screenshot en cas d'echec
    screenshot: 'only-on-failure',

    // Video en cas d'echec
    video: 'retain-on-failure',

    // Taille de la fenetre
    viewport: { width: 1280, height: 720 },

    // Locale et timezone
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },

  // Projets : un par navigateur
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Test mobile
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Demarrer le serveur de dev automatiquement
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // 2 minutes pour demarrer
  },
});
```

---

## Écrire un premier test

### Syntaxe de base

```typescript
// e2e/tests/home.spec.ts
import { test, expect } from '@playwright/test';

test('should display the home page title', async ({ page }) => {
  // Naviguer vers la page d'accueil
  await page.goto('/');

  // Verifier le titre de la page
  await expect(page).toHaveTitle(/mon application/i);

  // Verifier qu'un element est visible
  await expect(page.getByRole('heading', { name: /bienvenue/i })).toBeVisible();
});
```

### Grouper les tests avec `test.describe`

```typescript
test.describe('Page d\'accueil', () => {
  test('should display navigation links', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: /produits/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /a propos/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /contact/i })).toBeVisible();
  });

  test('should display hero section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/bienvenue/i);
    await expect(page.getByRole('link', { name: /decouvrir/i })).toBeVisible();
  });

  test('should display footer with copyright', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('contentinfo')).toContainText('2025');
  });
});
```

---

## Navigation

### `page.goto()`

```typescript
// Navigation absolue (utilise baseURL de la config)
await page.goto('/');
await page.goto('/products');
await page.goto('/products/123');

// Navigation avec URL complete
await page.goto('https://example.com');

// Options de navigation
await page.goto('/products', {
  waitUntil: 'domcontentloaded', // ou 'load', 'networkidle', 'commit'
  timeout: 10_000,
});
```

### `page.waitForURL()`

```typescript
// Attendre une redirection
await page.getByRole('link', { name: /mon profil/i }).click();
await page.waitForURL('/profile');

// Avec un pattern glob
await page.waitForURL('**/profile/**');

// Avec une regex
await page.waitForURL(/\/products\/\d+/);
```

### Autres méthodes de navigation

```typescript
// Recharger la page
await page.reload();

// Precedent / suivant
await page.goBack();
await page.goForward();

// Attendre un evenement de navigation
await Promise.all([
  page.waitForNavigation(),
  page.getByRole('button', { name: /soumettre/i }).click(),
]);
```

---

## Selecteurs

### Priorite recommandee (identique aux tests de composants)

#### 1. `getByRole` — meilleur choix

```typescript
// Bouton
page.getByRole('button', { name: /ajouter au panier/i });

// Lien
page.getByRole('link', { name: /voir les details/i });

// Champ de saisie
page.getByRole('textbox', { name: /rechercher/i });

// Case a cocher
page.getByRole('checkbox', { name: /se souvenir de moi/i });

// Menu deroulant
page.getByRole('combobox', { name: /trier par/i });

// Heading avec niveau
page.getByRole('heading', { name: /produits populaires/i, level: 2 });

// Navigation
page.getByRole('navigation');

// Cellule de tableau
page.getByRole('cell', { name: /129,99/i });
```

#### 2. `getByLabel` — pour les formulaires

```typescript
// Input avec label explicite
page.getByLabel('Adresse email');
page.getByLabel(/mot de passe/i);
page.getByLabel('Pays');
```

#### 3. `getByText` — contenu textuel

```typescript
// Texte exact ou partiel
page.getByText('Aucun resultat');
page.getByText(/article\(s\) dans votre panier/i);
```

#### 4. `getByPlaceholder`

```typescript
page.getByPlaceholder('Rechercher un produit...');
page.getByPlaceholder(/entrez votre email/i);
```

#### 5. `getByTestId` — dernier recours

```typescript
page.getByTestId('product-card-123');
page.getByTestId('loading-skeleton');
```

#### 6. `locator` — selecteurs CSS ou XPath

```typescript
// CSS selector (quand les methodes semantiques ne suffisent pas)
page.locator('.product-card:first-child');
page.locator('[data-status="active"]');
page.locator('form >> input[type="email"]');

// Combiner locators
page.locator('.product-card').filter({ hasText: 'Clavier' });
page.locator('.product-card').filter({ has: page.getByRole('button', { name: /acheter/i }) });

// nth element
page.locator('.product-card').nth(0);
page.locator('.product-card').first();
page.locator('.product-card').last();
```

---

## Actions

### Clic

```typescript
// Clic simple
await page.getByRole('button', { name: /connexion/i }).click();

// Double-clic
await page.getByText('Mot a selectionner').dblclick();

// Clic droit
await page.getByText('Element').click({ button: 'right' });

// Clic avec modification (Ctrl+Click pour nouvel onglet)
await page.getByRole('link', { name: /ouvrir/i }).click({ modifiers: ['Control'] });

// Clic a une position precise
await page.locator('canvas').click({ position: { x: 100, y: 200 } });

// Force click (ignorer les overlays)
await page.getByRole('button', { name: /fermer/i }).click({ force: true });
```

### Saisie de texte

```typescript
// fill : vide le champ puis ecrit (recommande pour les formulaires)
await page.getByLabel('Email').fill('alice@example.com');

// type : tape caractere par caractere (simule la frappe reelle)
await page.getByLabel('Rechercher').type('clavier mecanique', { delay: 50 });

// Vider un champ
await page.getByLabel('Email').clear();

// Remplir et valider
await page.getByLabel('Email').fill('alice@example.com');
await page.getByLabel('Email').press('Enter');
```

### Cases a cocher et boutons radio

```typescript
// Cocher
await page.getByRole('checkbox', { name: /conditions generales/i }).check();

// Decocher
await page.getByRole('checkbox', { name: /newsletter/i }).uncheck();

// Bouton radio
await page.getByRole('radio', { name: /livraison express/i }).check();
```

### Select / dropdown

```typescript
// Par la valeur visible
await page.getByLabel('Pays').selectOption('France');

// Par la valeur de l'attribut value
await page.getByLabel('Pays').selectOption({ value: 'fr' });

// Multi-select
await page.getByLabel('Categories').selectOption(['electronics', 'books']);
```

### Clavier

```typescript
// Touche unique
await page.keyboard.press('Escape');
await page.keyboard.press('Tab');
await page.keyboard.press('Enter');

// Combinaison de touches
await page.keyboard.press('Control+a');
await page.keyboard.press('Control+c');
await page.keyboard.press('Control+v');

// Sur un element specifique
await page.getByRole('textbox').press('ArrowDown');
```

### Upload de fichier

```typescript
// Upload simple
await page.getByLabel('Photo de profil').setInputFiles('test-data/avatar.jpg');

// Upload multiple
await page.getByLabel('Documents').setInputFiles([
  'test-data/doc1.pdf',
  'test-data/doc2.pdf',
]);

// Supprimer la selection
await page.getByLabel('Photo de profil').setInputFiles([]);
```

### Drag and drop

```typescript
// Drag and drop
await page.getByText('Element a deplacer').dragTo(page.getByText('Zone de depot'));

// Ou manuellement
const source = page.locator('#draggable');
const target = page.locator('#droppable');
await source.hover();
await page.mouse.down();
await target.hover();
await page.mouse.up();
```

---

## Assertions

### Assertions sur la page

```typescript
// Titre de la page
await expect(page).toHaveTitle('Mon Application — Accueil');
await expect(page).toHaveTitle(/accueil/i);

// URL
await expect(page).toHaveURL('/products');
await expect(page).toHaveURL(/\/products\?page=2/);
```

### Assertions sur les éléments

```typescript
// Visibilite
await expect(page.getByText('Bienvenue')).toBeVisible();
await expect(page.getByText('Element cache')).toBeHidden();
await expect(page.getByText('Element cache')).not.toBeVisible();

// Contenu textuel
await expect(page.getByRole('heading')).toHaveText('Mon titre');
await expect(page.getByRole('heading')).toHaveText(/mon titre/i);
await expect(page.getByRole('alert')).toContainText('erreur');

// Valeur d'un input
await expect(page.getByLabel('Email')).toHaveValue('alice@example.com');
await expect(page.getByLabel('Email')).toHaveValue(/alice/);
await expect(page.getByLabel('Email')).toBeEmpty();

// Attributs
await expect(page.getByRole('link')).toHaveAttribute('href', '/products');
await expect(page.getByRole('img')).toHaveAttribute('alt', /photo de profil/i);

// Classes CSS
await expect(page.locator('.alert')).toHaveClass(/alert--error/);

// Etat
await expect(page.getByRole('button', { name: /envoyer/i })).toBeEnabled();
await expect(page.getByRole('button', { name: /envoyer/i })).toBeDisabled();
await expect(page.getByRole('checkbox')).toBeChecked();
await expect(page.getByRole('textbox')).toBeEditable();

// Nombre d'elements
await expect(page.getByRole('listitem')).toHaveCount(5);

// Focus
await expect(page.getByLabel('Email')).toBeFocused();
```

### Assertions negatives

```typescript
// Verifier qu'un element n'est PAS visible
await expect(page.getByText('Message d\'erreur')).not.toBeVisible();

// Verifier qu'un element n'existe pas (count = 0)
await expect(page.getByRole('alert')).toHaveCount(0);

// Verifier que le bouton n'est pas desactive
await expect(page.getByRole('button', { name: /envoyer/i })).not.toBeDisabled();
```

---

## Auto-wait : le mécanisme clé

Playwright attend automatiquement que les éléments soient prets avant d'interagir avec eux. C'est un avantage majeur par rapport a Selenium.

### Ce que Playwright attend avant un clic

```
1. L'element est attache au DOM            ✓ (attached)
2. L'element est visible                   ✓ (visible)
3. L'element est stable (pas d'animation)  ✓ (stable)
4. L'element recoit les events             ✓ (receives events)
5. L'element est active (enabled)          ✓ (enabled)
```

### Illustration

```typescript
// PAS BESOIN de sleep ou waitFor avant un clic !
// Playwright attend automatiquement

// MAUVAIS (style Selenium)
await page.goto('/products');
await page.waitForSelector('.product-list'); // Inutile !
await page.waitForTimeout(1000);             // Encore pire !
await page.click('.product-card');

// BON (style Playwright)
await page.goto('/products');
await page.getByRole('link', { name: /premier produit/i }).click();
// Playwright attend que le lien soit visible et cliquable
```

### Quand l'auto-wait ne suffit pas

```typescript
// Attendre un element specifique (par exemple apres un chargement AJAX)
await page.getByRole('heading', { name: /resultats/i }).waitFor();

// Attendre qu'un element disparaisse
await page.getByRole('progressbar').waitFor({ state: 'hidden' });

// Attendre une reponse reseau
await page.waitForResponse('**/api/products');

// Attendre que la page soit completement chargee
await page.waitForLoadState('networkidle');

// Attendre une condition personnalisee
await page.waitForFunction(() => {
  return document.querySelectorAll('.product-card').length > 0;
});
```

---

## Screenshots et videos

### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    // Screenshots
    screenshot: 'only-on-failure', // 'on', 'off', 'only-on-failure'

    // Videos
    video: 'retain-on-failure', // 'on', 'off', 'on-first-retry', 'retain-on-failure'
  },
});
```

### Screenshots manuels dans les tests

```typescript
test('visual check of product page', async ({ page }) => {
  await page.goto('/products/1');

  // Screenshot de la page entiere
  await page.screenshot({ path: 'screenshots/product-page.png' });

  // Screenshot d'un element specifique
  await page.getByTestId('product-gallery').screenshot({
    path: 'screenshots/product-gallery.png',
  });

  // Screenshot pleine page (avec scroll)
  await page.screenshot({
    path: 'screenshots/full-page.png',
    fullPage: true,
  });
});
```

---

## Codegen : générer du code de test

Playwright Codegen enregistre vos actions dans le navigateur et généré le code correspondant.

```bash
# Lancer Codegen
npx playwright codegen http://localhost:3000

# Avec un viewport specifique
npx playwright codegen --viewport-size=1280,720 http://localhost:3000

# Avec un device simule
npx playwright codegen --device="iPhone 13" http://localhost:3000

# Sauvegarder dans un fichier
npx playwright codegen --output=e2e/tests/generated.spec.ts http://localhost:3000
```

### Workflow recommande

1. Lancer Codegen pour enregistrer le scenario de base
2. Copier le code généré dans votre fichier de test
3. **Ameliorer les selecteurs** : remplacer les selecteurs CSS par `getByRole`, `getByLabel`, etc.
4. **Ajouter les assertions** : Codegen généré les actions mais pas toujours les verifications
5. **Refactorer** : extraire les helpers, créer des Page Objects

### Exemple : code généré vs code ameliore

```typescript
// Code genere par Codegen (brut)
test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.locator('input[name="email"]').click();
  await page.locator('input[name="email"]').fill('alice@example.com');
  await page.locator('input[name="password"]').click();
  await page.locator('input[name="password"]').fill('secret123');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('http://localhost:3000/dashboard');
});

// Code ameliore manuellement
test('should login with valid credentials', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Adresse email').fill('alice@example.com');
  await page.getByLabel('Mot de passe').fill('secret123');
  await page.getByRole('button', { name: /se connecter/i }).click();

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: /bienvenue alice/i })).toBeVisible();
});
```

---

## Trace Viewer

Le Trace Viewer est un outil de debugging visuel qui montre chaque action, screenshot, log réseau et erreur console.

### Activer la trace

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry', // Recommande : trace seulement en cas d'echec
    // trace: 'on',          // Toujours (plus lent)
    // trace: 'off',         // Jamais
  },
});
```

### Visualiser une trace

```bash
# Ouvrir le rapport HTML (contient les traces)
npx playwright show-report

# Ouvrir une trace specifique
npx playwright show-trace test-results/tests-login-chromium/trace.zip
```

### Ce que le Trace Viewer montre

- Timeline de chaque action (goto, click, fill, etc.)
- Screenshot avant et après chaque action
- Snapshot du DOM à chaque étape
- Requetes réseau (URL, status, duree)
- Logs console (errors, warnings)
- Source du test avec la ligne en cours

---

## Test hooks

### `test.beforeAll` / `test.afterAll`

Executes une fois par worker, avant/après tous les tests du fichier.

```typescript
import { test, expect } from '@playwright/test';

test.beforeAll(async () => {
  // Setup global : seeder la base de donnees, etc.
  console.log('Setup avant tous les tests');
});

test.afterAll(async () => {
  // Cleanup global
  console.log('Cleanup apres tous les tests');
});
```

### `test.beforeEach` / `test.afterEach`

Executes avant/après chaque test.

```typescript
test.beforeEach(async ({ page }) => {
  // Naviguer vers la page avant chaque test
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  // Verifier qu'il n'y a pas d'erreur console
  const logs = await page.evaluate(() => {
    // Recuperer les erreurs console stockees
    return (window as any).__consoleErrors ?? [];
  });
  expect(logs).toHaveLength(0);
});
```

### Hooks dans un `describe`

```typescript
test.describe('Tableau de bord', () => {
  test.beforeEach(async ({ page }) => {
    // Se connecter avant chaque test de cette section
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Mot de passe').fill('admin123');
    await page.getByRole('button', { name: /connexion/i }).click();
    await page.waitForURL('/dashboard');
  });

  test('should display recent activity', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /activite recente/i })).toBeVisible();
  });

  test('should display statistics cards', async ({ page }) => {
    await expect(page.getByTestId('stats-users')).toBeVisible();
    await expect(page.getByTestId('stats-revenue')).toBeVisible();
  });
});
```

---

## Exemples complets

### Exemple 1 : flux de login

```typescript
// e2e/tests/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.getByLabel('Adresse email').fill('alice@example.com');
    await page.getByLabel('Mot de passe').fill('SecurePass123!');
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Verification : redirection vers le dashboard
    await expect(page).toHaveURL('/dashboard');

    // Verification : le nom de l'utilisateur est affiche
    await expect(page.getByRole('button', { name: /alice/i })).toBeVisible();

    // Verification : le lien "Se connecter" a disparu
    await expect(page.getByRole('link', { name: /se connecter/i })).not.toBeVisible();
  });

  test('should display error for invalid credentials', async ({ page }) => {
    await page.getByLabel('Adresse email').fill('alice@example.com');
    await page.getByLabel('Mot de passe').fill('wrong-password');
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Verification : message d'erreur
    await expect(page.getByRole('alert')).toHaveText(/identifiants invalides/i);

    // Verification : on reste sur la page de login
    await expect(page).toHaveURL('/login');

    // Verification : le champ mot de passe est vide
    await expect(page.getByLabel('Mot de passe')).toBeEmpty();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: /se connecter/i }).click();

    await expect(page.getByText(/l'email est requis/i)).toBeVisible();
    await expect(page.getByText(/le mot de passe est requis/i)).toBeVisible();
  });

  test('should redirect to requested page after login', async ({ page }) => {
    // Tenter d'acceder a une page protegee
    await page.goto('/settings');

    // Redirige vers login
    await expect(page).toHaveURL(/\/login\?redirect=/);

    // Se connecter
    await page.getByLabel('Adresse email').fill('alice@example.com');
    await page.getByLabel('Mot de passe').fill('SecurePass123!');
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Redirige vers la page demandee initialement
    await expect(page).toHaveURL('/settings');
  });
});
```

### Exemple 2 : CRUD de produits

```typescript
// e2e/tests/products/product-crud.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Product CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Login en tant qu'admin
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Mot de passe').fill('admin123');
    await page.getByRole('button', { name: /connexion/i }).click();
    await page.waitForURL('/dashboard');
  });

  test('should display product list', async ({ page }) => {
    await page.goto('/admin/products');

    // Verifier le titre
    await expect(page.getByRole('heading', { name: /gestion des produits/i })).toBeVisible();

    // Verifier que des produits sont affiches
    const rows = page.getByRole('row');
    await expect(rows).toHaveCount(6); // 5 produits + header row
  });

  test('should create a new product', async ({ page }) => {
    await page.goto('/admin/products');

    // Cliquer sur "Nouveau produit"
    await page.getByRole('link', { name: /nouveau produit/i }).click();
    await expect(page).toHaveURL('/admin/products/new');

    // Remplir le formulaire
    await page.getByLabel('Nom du produit').fill('Casque Audio Premium');
    await page.getByLabel('Prix').fill('199.99');
    await page.getByLabel('Description').fill('Casque audio sans fil avec reduction de bruit active.');
    await page.getByLabel('Categorie').selectOption('audio');
    await page.getByLabel('Stock').fill('50');
    await page.getByLabel('Publie').check();

    // Soumettre
    await page.getByRole('button', { name: /creer le produit/i }).click();

    // Verification : redirection vers la liste avec notification
    await expect(page).toHaveURL('/admin/products');
    await expect(page.getByText(/produit cree avec succes/i)).toBeVisible();

    // Verification : le nouveau produit est dans la liste
    await expect(page.getByRole('cell', { name: 'Casque Audio Premium' })).toBeVisible();
  });

  test('should edit an existing product', async ({ page }) => {
    await page.goto('/admin/products');

    // Cliquer sur "Modifier" pour le premier produit
    await page.getByRole('row', { name: /clavier mecanique/i })
      .getByRole('link', { name: /modifier/i })
      .click();

    // Modifier le prix
    await page.getByLabel('Prix').clear();
    await page.getByLabel('Prix').fill('149.99');

    // Sauvegarder
    await page.getByRole('button', { name: /sauvegarder/i }).click();

    // Verification
    await expect(page).toHaveURL('/admin/products');
    await expect(page.getByText(/modifications enregistrees/i)).toBeVisible();
  });

  test('should delete a product with confirmation', async ({ page }) => {
    await page.goto('/admin/products');

    // Compter les produits avant suppression
    const rowsBefore = await page.getByRole('row').count();

    // Cliquer sur "Supprimer"
    await page.getByRole('row', { name: /webcam hd/i })
      .getByRole('button', { name: /supprimer/i })
      .click();

    // Dialogue de confirmation
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText(/etes-vous sur/i);

    // Confirmer
    await page.getByRole('button', { name: /confirmer la suppression/i }).click();

    // Verification : le produit a disparu
    await expect(page.getByRole('row', { name: /webcam hd/i })).not.toBeVisible();

    // Un produit de moins
    const rowsAfter = await page.getByRole('row').count();
    expect(rowsAfter).toBe(rowsBefore - 1);
  });
});
```

### Exemple 3 : formulaire complexe

```typescript
// e2e/tests/checkout/checkout-form.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout form', () => {
  test.beforeEach(async ({ page }) => {
    // Ajouter un produit au panier avant d'acceder au checkout
    await page.goto('/products');
    await page.getByRole('button', { name: /ajouter au panier/i }).first().click();
    await page.goto('/checkout');
  });

  test('should complete checkout with all required fields', async ({ page }) => {
    // Etape 1 : Informations personnelles
    await page.getByLabel('Prenom').fill('Alice');
    await page.getByLabel('Nom').fill('Martin');
    await page.getByLabel('Email').fill('alice@example.com');
    await page.getByLabel('Telephone').fill('+33 6 12 34 56 78');
    await page.getByRole('button', { name: /continuer/i }).click();

    // Etape 2 : Adresse de livraison
    await expect(page.getByRole('heading', { name: /adresse de livraison/i })).toBeVisible();
    await page.getByLabel('Adresse').fill('123 Rue de Paris');
    await page.getByLabel('Code postal').fill('75001');
    await page.getByLabel('Ville').fill('Paris');
    await page.getByLabel('Pays').selectOption('France');
    await page.getByRole('button', { name: /continuer/i }).click();

    // Etape 3 : Mode de livraison
    await expect(page.getByRole('heading', { name: /livraison/i })).toBeVisible();
    await page.getByRole('radio', { name: /express/i }).check();
    await page.getByRole('button', { name: /continuer/i }).click();

    // Etape 4 : Recapitulatif
    await expect(page.getByRole('heading', { name: /recapitulatif/i })).toBeVisible();
    await expect(page.getByText('Alice Martin')).toBeVisible();
    await expect(page.getByText('123 Rue de Paris')).toBeVisible();
    await expect(page.getByText(/express/i)).toBeVisible();

    // Confirmer la commande
    await page.getByRole('button', { name: /confirmer la commande/i }).click();

    // Page de confirmation
    await expect(page).toHaveURL(/\/order-confirmation/);
    await expect(page.getByRole('heading', { name: /merci/i })).toBeVisible();
    await expect(page.getByText(/numero de commande/i)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Cliquer sur "Continuer" sans remplir les champs
    await page.getByRole('button', { name: /continuer/i }).click();

    // Verifier les erreurs de validation
    await expect(page.getByText(/le prenom est requis/i)).toBeVisible();
    await expect(page.getByText(/le nom est requis/i)).toBeVisible();
    await expect(page.getByText(/l'email est requis/i)).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.getByLabel('Prenom').fill('Alice');
    await page.getByLabel('Nom').fill('Martin');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: /continuer/i }).click();

    await expect(page.getByText(/format d'email invalide/i)).toBeVisible();
  });
});
```

---

## Commandes CLI utiles

```bash
# Executer tous les tests
npx playwright test

# Executer un fichier specifique
npx playwright test e2e/tests/auth/login.spec.ts

# Executer un test par nom
npx playwright test -g "should login successfully"

# Executer sur un navigateur specifique
npx playwright test --project=chromium

# Mode debug (pas a pas)
npx playwright test --debug

# Mode UI (interface graphique)
npx playwright test --ui

# Afficher le rapport
npx playwright show-report

# Lancer Codegen
npx playwright codegen http://localhost:3000

# Mettre a jour les navigateurs
npx playwright install
```

---

## Exercice pratique

Ecrivez les tests E2E Playwright pour une application de gestion de contacts :
1. Login avec identifiants valides / invalides
2. Lister les contacts avec recherche et filtres
3. Créer un nouveau contact (formulaire multi-étapes)
4. Modifier un contact existant
5. Supprimer un contact avec confirmation
6. Tester la navigation au clavier (accessibilité)

> Solution dans le [Lab 10](../labs/lab-10-playwright-fondamentaux/)

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [09 - Tests d'intégration](./09-tests-integration) | [11 - Playwright avance](./11-playwright-avance) |

---

## Ressources

- [Quiz 10 : Testez vos connaissances](../quizzes/quiz-10-playwright.html)
- [Lab 10 : Playwright fondamentaux](../labs/lab-10-playwright-fondamentaux/)
- Playwright — [Documentation officielle](https://playwright.dev/docs/intro)
- Playwright — [Best Practices](https://playwright.dev/docs/best-practices)
- Playwright — [Locators](https://playwright.dev/docs/locators)
- Playwright — [Auto-waiting](https://playwright.dev/docs/actionability)
- Playwright — [Trace Viewer](https://playwright.dev/docs/trace-viewer)

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 10 playwright](../screencasts/screencast-10-playwright.md)
2. **Lab** : [lab-10-playwright-fondamentaux](../labs/lab-10-playwright-fondamentaux/README)
3. **Visualisation** : [Page Object Pattern](../visualizations/page-object.html)
4. **Quiz** : [quiz 10 playwright](../quizzes/quiz-10-playwright.html)
:::
