# Module 14 — Flaky tests et debugging

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 4/5        | 75 min        | [Lab 14](../labs/lab-14-flaky-tests/) | [Quiz 14](../quizzes/quiz-14-flaky.html) |

## Objectifs

- Identifier les causes racines des tests flaky
- Classer les flaky tests par categorie
- Utiliser les outils de debugging (Vitest UI, Playwright trace viewer)
- Appliquer les patterns de correction eprouves
- Mettre en place une prevention systematique
- Diagnostiquer 5 cas reels de tests flaky

---

## Qu'est-ce qu'un test flaky ?

Un test **flaky** (instable) est un test qui produit des resultats differents **sans changement de code** : il passe parfois et echoue parfois.

### Impact sur l'equipe

| Impact | Consequence |
|--------|-------------|
| **Confiance** | L'equipe ignore les echecs CI ("c'est juste un flaky") |
| **Vitesse** | Re-runs inutiles, temps perdu a investiguer |
| **Qualite** | De vrais bugs masques par le bruit des flaky |
| **Moral** | Frustration, perte de confiance dans la suite de tests |

### La regle d'or

> Un test flaky est **pire** qu'un test absent.
> Un test absent donne un faux sentiment de non-couverture.
> Un test flaky donne un faux sentiment de couverture **et** du bruit.

---

## Les 5 categories de tests flaky

### 1. Race conditions (timing)

Le test depend d'un delai ou d'un ordre d'execution non garanti.

```typescript
// FLAKY — race condition
it('should show notification after save', async () => {
  await page.click('#save-button');
  // Le notification met un temps variable a apparaitre
  const notification = page.locator('.notification');
  expect(await notification.textContent()).toBe('Saved!');
  // Echoue si la notification n'est pas encore visible
});
```

```typescript
// CORRIGE — attente explicite
it('should show notification after save', async () => {
  await page.click('#save-button');
  const notification = page.locator('.notification');
  await expect(notification).toHaveText('Saved!', { timeout: 5000 });
});
```

### 2. Dependance au temps (time-dependent)

Le test depend de `Date.now()`, `setTimeout`, ou de l'heure systeme.

```typescript
// FLAKY — depend de l'heure reelle
it('should show greeting based on time of day', () => {
  const greeting = getGreeting(); // "Bonjour" le matin, "Bonsoir" le soir
  expect(greeting).toBe('Bonjour');
  // Echoue apres 18h !
});
```

```typescript
// CORRIGE — fake timers
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getGreeting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Bonjour" in the morning', () => {
    vi.setSystemTime(new Date('2025-06-15T09:00:00'));
    expect(getGreeting()).toBe('Bonjour');
  });

  it('should return "Bonsoir" in the evening', () => {
    vi.setSystemTime(new Date('2025-06-15T20:00:00'));
    expect(getGreeting()).toBe('Bonsoir');
  });
});
```

### 3. Etat partage (shared state)

Les tests dependent d'un etat global qui n'est pas reinitialise entre chaque test.

```typescript
// FLAKY — etat global partage
const cart = new ShoppingCart(); // Partage entre tous les tests !

describe('ShoppingCart', () => {
  it('should add an item', () => {
    cart.addItem({ name: 'A', price: 10 });
    expect(cart.items).toHaveLength(1);
  });

  it('should calculate total', () => {
    // FLAKY : si le test precedent a ajoute un item, items.length = 1
    cart.addItem({ name: 'B', price: 20 });
    expect(cart.getTotal()).toBe(20);
    // Echoue ! Total = 30 car l'item du test precedent est encore la
  });
});
```

```typescript
// CORRIGE — isolation via beforeEach
describe('ShoppingCart', () => {
  let cart: ShoppingCart;

  beforeEach(() => {
    cart = new ShoppingCart(); // Nouvel objet a chaque test
  });

  it('should add an item', () => {
    cart.addItem({ name: 'A', price: 10 });
    expect(cart.items).toHaveLength(1);
  });

  it('should calculate total', () => {
    cart.addItem({ name: 'B', price: 20 });
    expect(cart.getTotal()).toBe(20); // Correct !
  });
});
```

### 4. Dependance reseau (network)

Le test fait de vrais appels HTTP qui peuvent echouer, etre lents, ou retourner des donnees differentes.

```typescript
// FLAKY — vrai appel API
it('should fetch user profile', async () => {
  const response = await fetch('https://api.example.com/users/1');
  const user = await response.json();
  expect(user.name).toBe('Alice');
  // Echoue si : API down, timeout, donnees modifiees, rate limiting
});
```

```typescript
// CORRIGE — MSW (Mock Service Worker)
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('https://api.example.com/users/1', () => {
    return HttpResponse.json({ id: 1, name: 'Alice', email: 'alice@example.com' });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('should fetch user profile', async () => {
  const response = await fetch('https://api.example.com/users/1');
  const user = await response.json();
  expect(user.name).toBe('Alice'); // Toujours deterministe
});
```

### 5. Selecteurs UI fragiles

Le test cible des elements par des attributs instables (classes CSS, structure DOM).

```typescript
// FLAKY — selecteur fragile
it('should click the submit button', async () => {
  // Classe CSS generee, peut changer a chaque build
  await page.click('.btn-primary.mt-4.px-6');
});
```

```typescript
// CORRIGE — selecteur deterministe
it('should click the submit button', async () => {
  await page.click('[data-testid="submit-button"]');
  // OU
  await page.getByRole('button', { name: 'Submit' });
});
```

---

## Detection des tests flaky

### Methode 1 : executions repetees

```bash
# Vitest : lancer N fois
for i in $(seq 1 10); do
  pnpm vitest run --reporter=json --outputFile="results-$i.json" 2>/dev/null
  echo "Run $i: exit code $?"
done
```

```typescript
// Script d'analyse
import { readFileSync, readdirSync } from 'node:fs';

interface VitestResult {
  testResults: Array<{
    assertionResults: Array<{
      fullName: string;
      status: 'passed' | 'failed';
    }>;
  }>;
}

const files = readdirSync('.').filter((f) => f.startsWith('results-'));
const testOutcomes = new Map<string, string[]>();

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf-8')) as VitestResult;
  for (const suite of data.testResults) {
    for (const test of suite.assertionResults) {
      const outcomes = testOutcomes.get(test.fullName) ?? [];
      outcomes.push(test.status);
      testOutcomes.set(test.fullName, outcomes);
    }
  }
}

for (const [name, outcomes] of testOutcomes) {
  const unique = new Set(outcomes);
  if (unique.size > 1) {
    const passRate = outcomes.filter((o) => o === 'passed').length / outcomes.length;
    console.log(`FLAKY (${Math.round(passRate * 100)}% pass): ${name}`);
  }
}
```

### Methode 2 : quarantaine CI

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Marquer les tests en quarantaine
    include: ['src/**/*.test.ts'],
    exclude: process.env.QUARANTINE
      ? [] // En mode quarantaine, tout inclure
      : ['src/**/*.quarantine.test.ts'], // Sinon, exclure
  },
});
```

```json
{
  "scripts": {
    "test": "vitest run",
    "test:quarantine": "QUARANTINE=true vitest run --include 'src/**/*.quarantine.test.ts'"
  }
}
```

### Methode 3 : Playwright retries avec analyse

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html'],
    // Reporter custom pour detecter les flaky
    ['./reporters/flaky-detector.ts'],
  ],
});
```

```typescript
// reporters/flaky-detector.ts
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

class FlakyDetector implements Reporter {
  private flakyTests: string[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    // Un test qui reussit en retry est flaky
    if (result.status === 'passed' && result.retry > 0) {
      this.flakyTests.push(test.title);
    }
  }

  onEnd(): void {
    if (this.flakyTests.length > 0) {
      console.warn('\n=== FLAKY TESTS DETECTED ===');
      this.flakyTests.forEach((t) => console.warn(`  - ${t}`));
      console.warn(`Total: ${this.flakyTests.length} flaky test(s)`);
      console.warn('============================\n');
    }
  }
}

export default FlakyDetector;
```

---

## Outils de debugging

### Vitest UI

```bash
# Lancer Vitest avec l'interface web
pnpm vitest --ui

# Ouvre http://localhost:51204/__vitest__/
```

Fonctionnalites :
- Arbre des tests interactif
- Re-run d'un test individuel
- Vue du code source avec couverture
- Console output par test
- Filtrage par statut (passed/failed/skipped)

### Vitest : debugging avec console

```typescript
describe('complexCalculation', () => {
  it('should handle edge case', () => {
    const input = { values: [1, -2, 0, 3.14] };

    // Debug temporaire
    console.log('Input:', JSON.stringify(input, null, 2));

    const result = complexCalculation(input);

    console.log('Result:', result);
    console.log('Type:', typeof result);

    expect(result).toBeCloseTo(2.14);
  });
});
```

### Vitest : debugging avec Node inspector

```json
{
  "scripts": {
    "test:debug": "node --inspect-brk node_modules/.bin/vitest run --no-file-parallelism"
  }
}
```

Puis dans VS Code, attacher le debugger avec la configuration :

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Debug Vitest",
      "port": 9229,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Playwright Trace Viewer

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    // Capturer les traces sur premier retry
    trace: 'on-first-retry',

    // OU toujours capturer (pour investigation)
    // trace: 'on',
  },
});
```

```bash
# Ouvrir une trace
pnpm playwright show-trace test-results/my-test/trace.zip
```

Le trace viewer montre :
- Chaque action (click, fill, navigate) avec un screenshot avant/apres
- Les appels reseau (requetes/reponses)
- Les logs console
- La timeline complete
- L'etat du DOM a chaque etape

### Playwright : mode debug interactif

```bash
# Lancer en mode debug (ouvre un vrai navigateur + inspector)
PWDEBUG=1 pnpm playwright test tests/checkout.spec.ts

# OU avec l'option headed
pnpm playwright test --headed --debug tests/checkout.spec.ts
```

### Playwright : screenshots de diagnostic

```typescript
it('should display the dashboard', async ({ page }) => {
  await page.goto('/dashboard');

  // Screenshot de diagnostic (a supprimer apres debug)
  await page.screenshot({ path: 'debug-dashboard.png', fullPage: true });

  await expect(page.locator('h1')).toHaveText('Dashboard');
});
```

---

## Patterns de correction

### Pattern 1 : Fake timers (temps)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('SessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should expire session after 30 minutes', () => {
    const session = new SessionManager();
    session.start();

    expect(session.isValid()).toBe(true);

    // Avancer de 31 minutes
    vi.advanceTimersByTime(31 * 60 * 1000);

    expect(session.isValid()).toBe(false);
  });

  it('should refresh session on activity', () => {
    const session = new SessionManager();
    session.start();

    // 20 minutes passent
    vi.advanceTimersByTime(20 * 60 * 1000);
    session.refresh(); // Remet le compteur a zero

    // 20 minutes de plus (40 total, mais 20 depuis refresh)
    vi.advanceTimersByTime(20 * 60 * 1000);

    expect(session.isValid()).toBe(true); // Encore valide
  });
});
```

### Pattern 2 : Attentes explicites (UI)

```typescript
// MAUVAIS — sleep arbitraire
it('should load data', async ({ page }) => {
  await page.goto('/data');
  await page.waitForTimeout(3000); // NON !
  expect(await page.locator('.data-row').count()).toBeGreaterThan(0);
});

// BON — attente conditionnelle
it('should load data', async ({ page }) => {
  await page.goto('/data');
  // Attendre que le premier element apparaisse
  await page.locator('.data-row').first().waitFor({ state: 'visible' });
  expect(await page.locator('.data-row').count()).toBeGreaterThan(0);
});

// ENCORE MIEUX — auto-retrying assertion
it('should load data', async ({ page }) => {
  await page.goto('/data');
  await expect(page.locator('.data-row')).toHaveCount(10, { timeout: 10000 });
});
```

### Pattern 3 : Isolation d'etat (shared state)

```typescript
// Pattern factory pour l'isolation
function createTestContext() {
  const db = new InMemoryDatabase();
  const userRepo = new UserRepository(db);
  const orderRepo = new OrderRepository(db);
  const orderService = new OrderService(userRepo, orderRepo);

  return { db, userRepo, orderRepo, orderService };
}

describe('OrderService', () => {
  it('should create order for valid user', () => {
    const { userRepo, orderService } = createTestContext();
    userRepo.add({ id: '1', name: 'Alice', balance: 100 });

    const order = orderService.create('1', [{ product: 'A', price: 50 }]);

    expect(order.status).toBe('confirmed');
  });

  it('should reject order for insufficient balance', () => {
    const { userRepo, orderService } = createTestContext();
    userRepo.add({ id: '1', name: 'Alice', balance: 10 });

    expect(() =>
      orderService.create('1', [{ product: 'A', price: 50 }]),
    ).toThrow('Insufficient balance');
  });
});
```

### Pattern 4 : MSW pour le reseau

```typescript
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

const handlers = [
  http.get('/api/products', async () => {
    // Simuler un delai reseau realiste mais deterministe
    await delay(50);
    return HttpResponse.json([
      { id: 1, name: 'Widget', price: 9.99 },
      { id: 2, name: 'Gadget', price: 24.99 },
    ]);
  }),

  http.post('/api/orders', async ({ request }) => {
    const body = (await request.json()) as { items: unknown[] };
    if (!body.items?.length) {
      return HttpResponse.json(
        { error: 'No items' },
        { status: 400 },
      );
    }
    return HttpResponse.json({ id: 'order-123', status: 'created' }, { status: 201 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Product API client', () => {
  it('should fetch products', async () => {
    const products = await fetchProducts();
    expect(products).toHaveLength(2);
    expect(products[0].name).toBe('Widget');
  });

  it('should handle server error gracefully', async () => {
    // Override pour ce test uniquement
    server.use(
      http.get('/api/products', () => {
        return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
      }),
    );

    await expect(fetchProducts()).rejects.toThrow('Server error');
  });
});
```

### Pattern 5 : Selecteurs deterministes

```typescript
// Hierarchie de selecteurs (du meilleur au pire)

// 1. Role ARIA + texte (le plus resilient)
await page.getByRole('button', { name: 'Add to cart' });
await page.getByRole('heading', { name: 'Products' });
await page.getByRole('link', { name: 'Home' });

// 2. Label (formulaires)
await page.getByLabel('Email address');
await page.getByPlaceholder('Search...');

// 3. Test ID (quand pas de semantique accessible)
await page.getByTestId('product-card-42');
await page.locator('[data-testid="checkout-summary"]');

// 4. Texte visible (acceptable pour le contenu statique)
await page.getByText('Welcome back!');

// 5. CSS selector (dernier recours)
await page.locator('#main-content > .product-list');

// JAMAIS : classes CSS generees
// await page.locator('.css-1a2b3c4'); // NON !
// await page.locator('.MuiButton-containedPrimary'); // NON !
```

---

## 5 diagnostics de tests flaky reels

### Cas 1 : Le test qui echoue a minuit

```typescript
// PROBLEME : ce test echoue entre 23h et 1h du matin
it('should format relative date', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  expect(formatRelativeDate(yesterday)).toBe('yesterday');
  // A 23h30, "yesterday.setDate(today - 1)" peut donner avant-hier
  // si le fuseau horaire du serveur CI est different
});

// DIAGNOSTIC : le probleme est le changement de jour pendant l'execution
// La date "hier" depend du moment exact ou le test tourne

// CORRECTION : figer le temps
it('should format relative date', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-06-15T12:00:00Z')); // Midi UTC

  const yesterday = new Date('2025-06-14T12:00:00Z');
  expect(formatRelativeDate(yesterday)).toBe('yesterday');

  vi.useRealTimers();
});
```

### Cas 2 : Le formulaire qui se soumet trop vite

```typescript
// PROBLEME : le test echoue de maniere aleatoire sur CI lent
it('should submit the form', async ({ page }) => {
  await page.goto('/contact');
  await page.fill('#name', 'Alice');
  await page.fill('#email', 'alice@example.com');
  await page.fill('#message', 'Hello');
  await page.click('#submit');

  // Le message de succes n'est pas encore affiche !
  expect(await page.textContent('.success')).toBe('Message sent!');
});

// DIAGNOSTIC : click() n'attend pas que la soumission se termine
// Sur CI, le reseau et le rendu sont plus lents

// CORRECTION : attente explicite
it('should submit the form', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Name').fill('Alice');
  await page.getByLabel('Email').fill('alice@example.com');
  await page.getByLabel('Message').fill('Hello');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText('Message sent!')).toBeVisible({ timeout: 10000 });
});
```

### Cas 3 : L'ordre des resultats non garanti

```typescript
// PROBLEME : le test echoue quand l'API retourne les items dans un ordre different
it('should display user list', async () => {
  const users = await fetchUsers();
  expect(users[0].name).toBe('Alice');
  expect(users[1].name).toBe('Bob');
  // L'API ne garantit pas l'ordre !
});

// DIAGNOSTIC : l'API ou la DB retourne les resultats dans un ordre non-deterministe
// Ca fonctionne la plupart du temps par hasard

// CORRECTION 1 : trier avant d'asserter
it('should display user list', async () => {
  const users = await fetchUsers();
  const names = users.map((u) => u.name).sort();
  expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
});

// CORRECTION 2 : utiliser arrayContaining
it('should display user list', async () => {
  const users = await fetchUsers();
  expect(users).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Alice' }),
      expect.objectContaining({ name: 'Bob' }),
    ]),
  );
});
```

### Cas 4 : Le port deja utilise

```typescript
// PROBLEME : le test echoue sporadiquement avec "EADDRINUSE: port 3000"
beforeAll(async () => {
  server = createServer(app);
  server.listen(3000); // Port fixe !
});

// DIAGNOSTIC : un autre test ou process utilise deja le port 3000
// En parallelisation, plusieurs suites peuvent demarrer simultanement

// CORRECTION : port dynamique
beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => { // Port 0 = port libre choisi par l'OS
      const address = server.address();
      if (address && typeof address !== 'string') {
        baseUrl = `http://localhost:${address.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});
```

### Cas 5 : L'animation CSS qui bloque le click

```typescript
// PROBLEME : le bouton est present dans le DOM mais pas cliquable
it('should open modal', async ({ page }) => {
  await page.goto('/products/1');
  await page.click('[data-testid="buy-button"]');
  // Echoue : "Element is not visible" ou "Element is not stable"
  // Car une animation CSS deplace le bouton
});

// DIAGNOSTIC : le bouton est anime (slide-in, fade-in)
// Playwright attend la visibilite mais pas la fin de l'animation

// CORRECTION 1 : attendre la stabilite
it('should open modal', async ({ page }) => {
  await page.goto('/products/1');
  const button = page.getByTestId('buy-button');

  // Attendre que l'element soit stable (plus en mouvement)
  await button.waitFor({ state: 'visible' });
  // Force le click meme pendant l'animation (dernier recours)
  // await button.click({ force: true });

  // Mieux : attendre que les animations soient terminees
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="buy-button"]');
    if (!el) return false;
    const animations = el.getAnimations();
    return animations.length === 0 || animations.every((a) => a.playState === 'finished');
  });

  await button.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

// CORRECTION 2 : desactiver les animations en test
// playwright.config.ts
export default defineConfig({
  use: {
    // Desactiver les animations CSS
    contextOptions: {
      reducedMotion: 'reduce',
    },
  },
});
```

---

## Docker pour la reproductibilite

### Le probleme "works on my machine"

| Local | CI | Difference |
|-------|----|------------|
| macOS M2 | Ubuntu 22.04 | OS, CPU architecture |
| 32 GB RAM | 7 GB RAM | Ressources |
| Node 20.11 | Node 20.9 | Version mineure |
| Timezone CET | Timezone UTC | Heure |
| SSD rapide | Disque cloud | I/O |

### Solution : conteneur de test

```dockerfile
# Dockerfile.test
FROM node:20-slim

# Variables d'environnement deterministes
ENV TZ=UTC
ENV NODE_ENV=test
ENV CI=true

WORKDIR /app

# Installer pnpm
RUN corepack enable

# Dependances d'abord (cache Docker)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Code source
COPY . .

CMD ["pnpm", "vitest", "run"]
```

```bash
# Lancer les tests dans Docker
docker build -f Dockerfile.test -t my-app-test .
docker run --rm my-app-test

# Lancer un test specifique
docker run --rm my-app-test pnpm vitest run src/services/pricing.test.ts
```

---

## Prevention checklist

### Avant d'ecrire un test

- [ ] Le test est-il **deterministe** ? (meme input -> meme output, toujours)
- [ ] Le test est-il **isole** ? (pas de dependance a un autre test)
- [ ] Les dependances externes sont-elles **mockees** ? (API, DB, filesystem)
- [ ] Les dates/heures sont-elles **figees** ? (fake timers)
- [ ] Les selecteurs UI sont-ils **stables** ? (data-testid, roles ARIA)

### Structure du test

- [ ] `beforeEach` reinitialise tout l'etat
- [ ] Pas de variable globale partagee entre tests
- [ ] Pas de `sleep()` ou `waitForTimeout()` avec duree fixe
- [ ] Les assertions utilisent des attentes explicites (auto-retrying)
- [ ] Le test nettoie ses effets de bord dans `afterEach`

### En CI

- [ ] Les tests passent avec `--no-file-parallelism` (elimine les problemes d'ordre)
- [ ] Les tests passent 10 fois de suite sans echec
- [ ] Les timeouts sont raisonnables (ni trop courts, ni trop longs)
- [ ] Les retries sont actives **uniquement** pour detecter les flaky, pas pour les masquer
- [ ] Un test qui retry avec succes est signale comme flaky (pas silencieusement OK)

### Hygiene de la suite de tests

```typescript
// Script de validation anti-flaky
// Ajouter dans package.json
{
  "scripts": {
    "test:stability": "for i in $(seq 1 10); do pnpm vitest run || exit 1; done",
    "test:stability:e2e": "for i in $(seq 1 5); do pnpm playwright test || exit 1; done"
  }
}
```

---

## Recapitulatif : patterns par categorie

| Categorie | Symptome | Pattern de correction |
|-----------|----------|----------------------|
| **Timing** | "Element not visible", timeout | Attentes explicites, auto-retrying assertions |
| **Temps** | Echoue a certaines heures | `vi.useFakeTimers()`, `vi.setSystemTime()` |
| **Etat partage** | Echoue selon l'ordre d'execution | `beforeEach` reset, factory pattern |
| **Reseau** | Timeout, donnees differentes | MSW, `server.use()` par test |
| **UI** | "Element not stable", mauvais element | `data-testid`, roles ARIA, `reducedMotion` |
| **Ordre** | Assertions d'index echouent | `.sort()`, `arrayContaining`, `toContainEqual` |
| **Port** | EADDRINUSE | Port 0, allocation dynamique |
| **Env** | "Works on my machine" | Docker, TZ=UTC, fake timers |

---

## Checklist du module

- [ ] Je sais categoriser un test flaky (timing, temps, etat, reseau, UI)
- [ ] J'utilise les fake timers pour les tests dependants du temps
- [ ] J'isole l'etat avec beforeEach et des factory functions
- [ ] J'utilise MSW pour mocker les appels reseau
- [ ] Je connais le Playwright Trace Viewer
- [ ] Je sais debugger avec Vitest UI et Node inspector
- [ ] J'ai une checklist de prevention des flaky tests
- [ ] Je sais diagnostiquer les 5 cas reels presentes

---

## Exercice pratique

Vous avez acces a un projet avec 5 tests flaky. Pour chacun :

1. Identifiez la categorie du flaky
2. Reproduisez l'echec (indices dans les commentaires)
3. Appliquez le pattern de correction adapte
4. Verifiez avec 10 executions consecutives

> Solution dans le [Lab 14](../labs/lab-14-flaky-tests/)

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| [13 - Tests en CI/CD](./13-tests-en-ci-cd) | [15 - TDD et BDD](./15-tdd-et-bdd) |

---

## Ressources

- [Quiz 14 : Testez vos connaissances](../quizzes/quiz-14-flaky.html)
- [Lab 14 : Flaky tests et debugging](../labs/lab-14-flaky-tests/)
- [Google Testing Blog — Flaky Tests](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Vitest Debugging](https://vitest.dev/guide/debugging)
- [MSW — Mock Service Worker](https://mswjs.io/)
