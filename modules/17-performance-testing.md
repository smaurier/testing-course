# Module 17 — Performance testing

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 5/5        | 90 min        | [Lab 17](../labs/lab-17-performance/) | [Quiz 17](../quizzes/quiz-17-performance.html) |

## Objectifs

- Distinguer les types de tests de performance (load, stress, spike, soak)
- Maitriser k6 (scripts, VUs, scenarios, thresholds, checks)
- Utiliser vitest bench pour le benchmarking de fonctions
- Mesurer les performances frontend (Lighthouse CI, Web Vitals)
- Detecter les fuites memoire
- Mettre en place une baseline et detecter les regressions

---

## Types de tests de performance

### Vue d'ensemble

```
  Charge (VUs)
  ▲
  │          ┌──────┐
  │    Spike │      │
  │          │      │     Stress
  │    ┌─────┤      ├────────────────┐
  │    │     │      │                │
  │    │     └──────┘     Load       │
  │ ┌──┤                             │
  │ │  │  ────────────────────────── │  Soak
  │ │  │                             │  (longue duree)
  │ │  │                             │
  ──┴──┴─────────────────────────────┴──► Temps
```

| Type | Objectif | Duree | Charge |
|------|----------|-------|--------|
| **Load** | Verifier le comportement sous charge normale | 5-15 min | Attendue (ex: 100 VUs) |
| **Stress** | Trouver les limites du systeme | 10-30 min | Croissante jusqu'a la rupture |
| **Spike** | Tester un pic soudain de trafic | 2-5 min | Pic brutal puis retour |
| **Soak** | Detecter les fuites (memoire, connexions) | 1-4 heures | Constante et moderee |

---

## k6 : tests de charge HTTP

### Installation

```bash
# macOS
brew install k6

# Windows (winget)
winget install k6 --source winget

# Docker
docker run --rm -i grafana/k6 run - < script.js

# npm (pour l'integration CI)
pnpm add -D @grafana/k6
```

### Script de base

```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuration
export const options = {
  // Stages : montee en charge progressive
  stages: [
    { duration: '30s', target: 20 },   // Montee a 20 VUs en 30s
    { duration: '1m', target: 20 },    // Maintenir 20 VUs pendant 1 min
    { duration: '30s', target: 50 },   // Montee a 50 VUs
    { duration: '1m', target: 50 },    // Maintenir 50 VUs
    { duration: '30s', target: 0 },    // Descente a 0
  ],

  // Seuils de reussite
  thresholds: {
    http_req_duration: ['p(95)<500'],       // 95% des requetes < 500ms
    http_req_failed: ['rate<0.01'],         // Moins de 1% d'erreurs
    http_req_duration: ['avg<200', 'max<2000'], // Moyenne < 200ms, max < 2s
  },
};

export default function () {
  // Chaque VU execute cette fonction en boucle
  const response = http.get('http://localhost:3000/api/products');

  // Verifications
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'body contains products': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body) && body.length > 0;
    },
  });

  // Pause entre les requetes (simuler un vrai utilisateur)
  sleep(1);
}
```

### Lancer le test

```bash
# Execution simple
k6 run tests/performance/load-test.js

# Avec sortie JSON pour CI
k6 run --out json=results.json tests/performance/load-test.js

# Avec un nombre de VUs specifique (override)
k6 run --vus 10 --duration 30s tests/performance/load-test.js
```

### Sortie k6

```
          /\      |‾‾| /‾‾/   /‾‾/
     /\  /  \     |  |/  /   /  /
    /  \/    \    |     (   /   ‾‾\
   /          \   |  |\  \ |  (‾)  |
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: load-test.js
     output: -

  scenarios: (100.00%) 1 scenario, 50 max VUs, 3m30s max duration

     ✓ status is 200
     ✓ response time < 500ms
     ✓ body contains products

     checks.........................: 100.00% ✓ 4520  ✗ 0
     data_received..................: 12 MB   56 kB/s
     data_sent......................: 420 kB  2.0 kB/s
     http_req_blocked...............: avg=1.2ms    min=0s      max=45ms
     http_req_duration..............: avg=82.3ms   min=12ms    max=892ms
       { expected_response:true }...: avg=82.3ms   min=12ms    max=892ms
   ✓ http_req_duration..............: avg=82.3ms   p(95)=245ms
   ✓ http_req_failed................: 0.00%   ✓ 0     ✗ 4520
     http_reqs......................: 4520    21.5/s
     iteration_duration.............: avg=1.08s    min=1.01s   max=1.89s
     iterations.....................: 4520    21.5/s
     vus............................: 1       min=1   max=50
     vus_max........................: 50      min=50  max=50
```

### Scenarios avances

```javascript
// tests/performance/scenarios.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    // Scenario 1 : navigation (beaucoup de GET)
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '2m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      exec: 'browseProducts',
      tags: { scenario: 'browse' },
    },

    // Scenario 2 : achat (POST critiques)
    purchase: {
      executor: 'constant-arrival-rate',
      rate: 10,             // 10 iterations par seconde
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'purchaseFlow',
      tags: { scenario: 'purchase' },
    },

    // Scenario 3 : pic soudain
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      stages: [
        { duration: '10s', target: 1 },
        { duration: '5s', target: 100 },   // Pic brutal !
        { duration: '30s', target: 100 },
        { duration: '10s', target: 1 },
      ],
      preAllocatedVUs: 100,
      maxVUs: 200,
      exec: 'browseProducts',
      startTime: '3m',     // Commence apres 3 min
      tags: { scenario: 'spike' },
    },
  },

  thresholds: {
    'http_req_duration{scenario:browse}': ['p(95)<300'],
    'http_req_duration{scenario:purchase}': ['p(95)<1000'],
    'http_req_failed{scenario:purchase}': ['rate<0.05'],
  },
};

export function browseProducts() {
  const productsRes = http.get('http://localhost:3000/api/products');
  check(productsRes, { 'products: 200': (r) => r.status === 200 });

  // Simuler la consultation d'un produit aleatoire
  if (productsRes.status === 200) {
    const products = JSON.parse(productsRes.body);
    if (products.length > 0) {
      const randomId = products[Math.floor(Math.random() * products.length)].id;
      const detailRes = http.get(`http://localhost:3000/api/products/${randomId}`);
      check(detailRes, { 'detail: 200': (r) => r.status === 200 });
    }
  }

  sleep(Math.random() * 3 + 1); // 1-4 secondes de pause
}

export function purchaseFlow() {
  // 1. Ajouter au panier
  const addRes = http.post(
    'http://localhost:3000/api/cart/items',
    JSON.stringify({ productId: 1, quantity: 1 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(addRes, { 'add to cart: 201': (r) => r.status === 201 });

  sleep(0.5);

  // 2. Checkout
  const checkoutRes = http.post(
    'http://localhost:3000/api/orders',
    JSON.stringify({ paymentMethod: 'card' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(checkoutRes, {
    'checkout: 201': (r) => r.status === 201,
    'checkout < 1s': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
```

### Tags et groupes

```javascript
import http from 'k6/http';
import { group, check } from 'k6';

export default function () {
  group('Homepage', () => {
    const res = http.get('http://localhost:3000/', {
      tags: { page: 'home' },
    });
    check(res, { 'home: 200': (r) => r.status === 200 });
  });

  group('Product Listing', () => {
    const res = http.get('http://localhost:3000/api/products', {
      tags: { page: 'products', type: 'api' },
    });
    check(res, { 'products: 200': (r) => r.status === 200 });
  });
}
```

### Rapports et export

```bash
# Export CSV
k6 run --out csv=results.csv tests/performance/load-test.js

# Export JSON
k6 run --out json=results.json tests/performance/load-test.js

# Export vers InfluxDB (pour dashboards Grafana)
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/load-test.js

# Export vers Grafana Cloud k6
K6_CLOUD_TOKEN=xxx k6 run --out cloud tests/performance/load-test.js
```

---

## vitest bench : benchmarking de fonctions

### Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    benchmark: {
      include: ['**/*.bench.ts'],
      reporters: ['default'],
    },
  },
});
```

### Benchmark de base

```typescript
// src/utils/sort.bench.ts
import { bench, describe } from 'vitest';

function bubbleSort(arr: number[]): number[] {
  const result = [...arr];
  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < result.length - i - 1; j++) {
      if (result[j] > result[j + 1]) {
        [result[j], result[j + 1]] = [result[j + 1], result[j]];
      }
    }
  }
  return result;
}

function quickSort(arr: number[]): number[] {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter((x) => x < pivot);
  const middle = arr.filter((x) => x === pivot);
  const right = arr.filter((x) => x > pivot);
  return [...quickSort(left), ...middle, ...quickSort(right)];
}

// Donnees de test
const smallArray = Array.from({ length: 100 }, () => Math.random() * 1000);
const largeArray = Array.from({ length: 10000 }, () => Math.random() * 1000);

describe('Sorting algorithms — small array (100 items)', () => {
  bench('Array.sort (native)', () => {
    [...smallArray].sort((a, b) => a - b);
  });

  bench('bubbleSort', () => {
    bubbleSort(smallArray);
  });

  bench('quickSort', () => {
    quickSort(smallArray);
  });
});

describe('Sorting algorithms — large array (10000 items)', () => {
  bench('Array.sort (native)', () => {
    [...largeArray].sort((a, b) => a - b);
  });

  bench('bubbleSort', () => {
    bubbleSort(largeArray);
  });

  bench('quickSort', () => {
    quickSort(largeArray);
  });
});
```

### Lancer les benchmarks

```bash
pnpm vitest bench

# Sortie :
# ✓ src/utils/sort.bench.ts
#   Sorting algorithms — small array (100 items)
#     name                hz        min        max       mean       p75       p99
#     Array.sort      152,340    0.0054     0.0215    0.0066    0.0068    0.0142
#     bubbleSort       12,450    0.0672     0.2340    0.0803    0.0810    0.1950
#     quickSort        98,230    0.0087     0.0456    0.0102    0.0105    0.0312
#
#   Sorting algorithms — large array (10000 items)
#     name                hz        min        max       mean       p75       p99
#     Array.sort        1,245    0.7210     1.4560    0.8032    0.8450    1.2100
#     bubbleSort            2  412.0000   523.0000  467.5000  489.0000  520.0000
#     quickSort           890    0.9800     2.1200    1.1236    1.1500    1.8900
```

### Benchmark de fonctions reelles

```typescript
// src/services/search.bench.ts
import { bench, describe } from 'vitest';

// Deux implementations a comparer
function linearSearch(items: string[], query: string): string[] {
  return items.filter((item) =>
    item.toLowerCase().includes(query.toLowerCase()),
  );
}

function indexedSearch(index: Map<string, string[]>, query: string): string[] {
  const normalizedQuery = query.toLowerCase();
  const results: string[] = [];
  for (const [key, values] of index) {
    if (key.includes(normalizedQuery)) {
      results.push(...values);
    }
  }
  return results;
}

// Preparer les donnees
const items = Array.from({ length: 50000 }, (_, i) => `Product ${i} - ${randomWords()}`);
const index = buildSearchIndex(items);

function randomWords(): string {
  const words = ['laptop', 'phone', 'tablet', 'camera', 'headphones', 'speaker', 'monitor'];
  return words[Math.floor(Math.random() * words.length)];
}

function buildSearchIndex(items: string[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const item of items) {
    const words = item.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (!index.has(word)) index.set(word, []);
      index.get(word)!.push(item);
    }
  }
  return index;
}

describe('Search performance (50k items)', () => {
  bench('linearSearch', () => {
    linearSearch(items, 'laptop');
  });

  bench('indexedSearch', () => {
    indexedSearch(index, 'laptop');
  });
});
```

---

## Frontend performance

### Lighthouse CI

```bash
# Installation
pnpm add -D @lhci/cli
```

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/products'],
      numberOfRuns: 3, // 3 runs par URL pour la fiabilite
      startServerCommand: 'pnpm preview',
      startServerReadyPattern: 'Local',
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-results',
    },
  },
};
```

```bash
# Lancer Lighthouse CI
pnpm lhci autorun
```

### Web Vitals avec Playwright

```typescript
// tests/performance/web-vitals.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Web Vitals', () => {
  test('homepage should meet performance thresholds', async ({ page }) => {
    // Injecter le script web-vitals
    await page.addInitScript(() => {
      (window as any).__webVitals = {};

      // Observer LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        (window as any).__webVitals.lcp = entries[entries.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // Observer CLS
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        (window as any).__webVitals.cls = clsValue;
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Attendre que les metriques soient collectees
    await page.waitForTimeout(3000);

    const vitals = await page.evaluate(() => (window as any).__webVitals);

    console.log('Web Vitals:', vitals);

    // Assertions
    expect(vitals.lcp).toBeLessThan(2500); // LCP < 2.5s
    expect(vitals.cls).toBeLessThan(0.1);  // CLS < 0.1
  });

  test('should have fast Time to First Byte', async ({ page }) => {
    const startTime = Date.now();
    const response = await page.goto('http://localhost:3000/');
    const ttfb = Date.now() - startTime;

    expect(response?.status()).toBe(200);
    expect(ttfb).toBeLessThan(600); // TTFB < 600ms
  });
});
```

### Performance API dans Playwright

```typescript
// tests/performance/navigation.spec.ts
import { test, expect } from '@playwright/test';

test('should load products page within performance budget', async ({ page }) => {
  await page.goto('http://localhost:3000/products');
  await page.waitForLoadState('networkidle');

  // Recuperer les metriques Navigation Timing
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      // Temps de connexion
      dns: nav.domainLookupEnd - nav.domainLookupStart,
      tcp: nav.connectEnd - nav.connectStart,
      ttfb: nav.responseStart - nav.requestStart,

      // Temps de chargement
      download: nav.responseEnd - nav.responseStart,
      domParse: nav.domInteractive - nav.responseEnd,
      domContentLoaded: nav.domContentLoadedEventEnd - nav.navigationStart,
      load: nav.loadEventEnd - nav.navigationStart,

      // Taille
      transferSize: nav.transferSize,
      decodedBodySize: nav.decodedBodySize,
    };
  });

  console.table(metrics);

  // Budget de performance
  expect(metrics.ttfb).toBeLessThan(500);
  expect(metrics.domContentLoaded).toBeLessThan(2000);
  expect(metrics.load).toBeLessThan(3000);
  expect(metrics.transferSize).toBeLessThan(500 * 1024); // < 500 KB
});

test('should not have too many network requests', async ({ page }) => {
  const requests: string[] = [];

  page.on('request', (req) => {
    requests.push(req.url());
  });

  await page.goto('http://localhost:3000/products');
  await page.waitForLoadState('networkidle');

  console.log(`Total requests: ${requests.length}`);

  // Budget : maximum 30 requetes pour charger la page
  expect(requests.length).toBeLessThan(30);

  // Pas de requetes vers des CDN tiers non prevus
  const thirdParty = requests.filter(
    (url) => !url.includes('localhost:3000'),
  );
  expect(thirdParty.length).toBeLessThan(5);
});
```

---

## Detection des fuites memoire

### Avec Node.js (backend)

```typescript
// tests/performance/memory-leak.test.ts
import { describe, it, expect } from 'vitest';

describe('Memory leak detection', () => {
  it('should not leak memory on repeated operations', () => {
    const iterations = 10000;

    // Forcer le garbage collection avant de mesurer
    if (global.gc) global.gc();
    const baselineMemory = process.memoryUsage().heapUsed;

    // Executer l'operation de nombreuses fois
    for (let i = 0; i < iterations; i++) {
      const cache = new Map<string, string>();
      for (let j = 0; j < 100; j++) {
        cache.set(`key-${j}`, `value-${j}`);
      }
      // Le cache devrait etre GC'd a chaque iteration
    }

    if (global.gc) global.gc();
    const finalMemory = process.memoryUsage().heapUsed;

    const memoryGrowth = finalMemory - baselineMemory;
    const growthMB = memoryGrowth / 1024 / 1024;

    console.log(`Memory growth: ${growthMB.toFixed(2)} MB`);

    // La memoire ne devrait pas grandir de plus de 10 MB
    expect(growthMB).toBeLessThan(10);
  });
});
```

```json
{
  "scripts": {
    "test:memory": "node --expose-gc node_modules/.bin/vitest run tests/performance/memory-leak.test.ts"
  }
}
```

### Avec k6 (charge soutenue)

```javascript
// tests/performance/soak-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  // Soak test : charge constante pendant longtemps
  stages: [
    { duration: '2m', target: 20 },    // Montee
    { duration: '30m', target: 20 },   // Maintien (30 minutes)
    { duration: '2m', target: 0 },     // Descente
  ],

  thresholds: {
    // Le temps de reponse ne doit pas se degrader
    http_req_duration: ['p(95)<500'],
    // Les erreurs ne doivent pas augmenter
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/products');
  check(res, {
    'status 200': (r) => r.status === 200,
    'response < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}

// Si le temps de reponse augmente progressivement
// pendant le soak test → probable fuite memoire ou connexions
```

### Avec Playwright (frontend)

```typescript
// tests/performance/memory-frontend.spec.ts
import { test, expect } from '@playwright/test';

test('should not leak memory during repeated navigation', async ({ page }) => {
  // Mesure initiale
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');

  const initialMetrics = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize ?? 0;
  });

  // Naviguer 20 fois entre les pages
  for (let i = 0; i < 20; i++) {
    await page.goto('http://localhost:3000/products');
    await page.waitForLoadState('networkidle');
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
  }

  const finalMetrics = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize ?? 0;
  });

  const growthMB = (finalMetrics - initialMetrics) / 1024 / 1024;
  console.log(`JS Heap growth: ${growthMB.toFixed(2)} MB`);

  // La memoire ne devrait pas croitre de plus de 20 MB
  expect(growthMB).toBeLessThan(20);
});
```

---

## Database query performance

```typescript
// tests/performance/db-queries.bench.ts
import { bench, describe, beforeAll, afterAll } from 'vitest';
import { createPool, type Pool } from 'mysql2/promise';

let pool: Pool;

beforeAll(async () => {
  pool = createPool({
    host: 'localhost',
    user: 'test',
    password: 'test',
    database: 'testdb',
    connectionLimit: 10,
  });

  // Seeder des donnees de test
  await seedTestData(pool, 100000); // 100k lignes
});

afterAll(async () => {
  await pool.end();
});

async function seedTestData(pool: Pool, count: number): Promise<void> {
  // ... seeder les donnees
}

describe('Database query performance', () => {
  bench('SELECT by primary key (indexed)', async () => {
    await pool.query('SELECT * FROM users WHERE id = ?', [
      Math.floor(Math.random() * 100000) + 1,
    ]);
  });

  bench('SELECT by email (indexed)', async () => {
    await pool.query('SELECT * FROM users WHERE email = ?', [
      `user${Math.floor(Math.random() * 100000)}@example.com`,
    ]);
  });

  bench('SELECT by name (non-indexed)', async () => {
    await pool.query('SELECT * FROM users WHERE name LIKE ?', [
      `User ${Math.floor(Math.random() * 100000)}%`,
    ]);
  });

  bench('SELECT with JOIN (orders)', async () => {
    await pool.query(
      `SELECT u.name, COUNT(o.id) as order_count
       FROM users u
       LEFT JOIN orders o ON u.id = o.user_id
       WHERE u.id = ?
       GROUP BY u.id`,
      [Math.floor(Math.random() * 100000) + 1],
    );
  });

  bench('INSERT single row', async () => {
    await pool.query(
      'INSERT INTO logs (user_id, action, created_at) VALUES (?, ?, NOW())',
      [Math.floor(Math.random() * 100000) + 1, 'benchmark-test'],
    );
  });
});
```

---

## Regression detection : baseline et comparaison

### Sauvegarder une baseline

```javascript
// tests/performance/baseline.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/products');
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}

export function handleSummary(data) {
  return {
    'baseline.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

### Comparer avec la baseline

```typescript
// scripts/compare-perf.ts
import { readFileSync } from 'node:fs';

interface K6Summary {
  metrics: {
    http_req_duration: {
      values: {
        avg: number;
        'p(95)': number;
        'p(99)': number;
        max: number;
      };
    };
    http_req_failed: {
      values: {
        rate: number;
      };
    };
  };
}

function compareSummaries(baselinePath: string, currentPath: string): void {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8')) as K6Summary;
  const current = JSON.parse(readFileSync(currentPath, 'utf-8')) as K6Summary;

  const metrics = [
    {
      name: 'Avg response time',
      baseline: baseline.metrics.http_req_duration.values.avg,
      current: current.metrics.http_req_duration.values.avg,
      unit: 'ms',
      threshold: 0.2, // 20% de degradation max
    },
    {
      name: 'p95 response time',
      baseline: baseline.metrics.http_req_duration.values['p(95)'],
      current: current.metrics.http_req_duration.values['p(95)'],
      unit: 'ms',
      threshold: 0.2,
    },
    {
      name: 'Error rate',
      baseline: baseline.metrics.http_req_failed.values.rate,
      current: current.metrics.http_req_failed.values.rate,
      unit: '%',
      threshold: 0.5,
    },
  ];

  let hasRegression = false;

  console.log('\nPerformance Comparison:');
  console.log('─'.repeat(70));

  for (const m of metrics) {
    const change = m.baseline > 0
      ? ((m.current - m.baseline) / m.baseline) * 100
      : 0;
    const status = change > m.threshold * 100 ? 'REGRESSION' : 'OK';
    const icon = status === 'OK' ? 'PASS' : 'FAIL';

    console.log(
      `[${icon}] ${m.name}: ${m.baseline.toFixed(2)}${m.unit} -> ${m.current.toFixed(2)}${m.unit} (${change > 0 ? '+' : ''}${change.toFixed(1)}%)`,
    );

    if (status === 'REGRESSION') hasRegression = true;
  }

  console.log('─'.repeat(70));

  if (hasRegression) {
    console.error('\nPerformance regression detected!');
    process.exit(1);
  }

  console.log('\nNo regression detected.');
}

compareSummaries('baseline.json', 'current.json');
```

### Integration CI

```yaml
# .github/workflows/perf.yml
name: Performance Tests

on:
  pull_request:

jobs:
  performance:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - run: pnpm install --frozen-lockfile

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install k6

      - name: Build and start server
        run: |
          pnpm build
          pnpm preview &
          sleep 5

      - name: Run performance tests
        run: k6 run --out json=current.json tests/performance/load-test.js

      - name: Compare with baseline
        run: pnpm tsx scripts/compare-perf.ts

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: perf-results
          path: "*.json"
```

---

## Checklist du module

- [ ] Je distingue les 4 types de tests de performance
- [ ] Je sais ecrire un script k6 avec stages, thresholds et checks
- [ ] J'utilise vitest bench pour comparer des implementations
- [ ] Je mesure les Web Vitals avec Playwright
- [ ] Je sais configurer Lighthouse CI
- [ ] Je detecte les fuites memoire (Node, frontend)
- [ ] J'ai une baseline de performance et un script de comparaison
- [ ] Mon pipeline CI inclut des tests de performance

---

## Exercice pratique

1. Ecrivez un script k6 avec 3 scenarios (browse, purchase, spike)
2. Definissez des thresholds realistes
3. Creez un benchmark vitest bench comparant deux fonctions de tri
4. Mesurez les Web Vitals de votre page d'accueil avec Playwright
5. Sauvegardez une baseline et verifiez l'absence de regression

> Solution dans le [Lab 17](../labs/lab-17-performance/)

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| [16 - Contract testing](./16-contract-testing) | [18 - Projet final](./18-projet-final) |

---

## Ressources

- [Quiz 17 : Testez vos connaissances](../quizzes/quiz-17-performance.html)
- [Lab 17 : Performance testing](../labs/lab-17-performance/)
- [k6 Documentation](https://k6.io/docs/)
- [Vitest Benchmarking](https://vitest.dev/guide/features.html#benchmarking)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Web Vitals](https://web.dev/vitals/)
