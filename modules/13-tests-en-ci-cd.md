# Module 13 — Tests en CI/CD

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 4/5        | 90 min        | [Lab 13](../labs/lab-13-ci-cd/) | [Quiz 13](../quizzes/quiz-13-ci-cd.html) |

## Objectifs

- Comprendre le principe "shift left" et la pyramide de feedback
- Configurer un pipeline GitHub Actions complet avec tests
- Paralleliser les tests (Vitest workers, Playwright sharding)
- Générer et exploiter les rapports (JUnit, Codecov)
- Mettre en place les pre-commit hooks (Husky + lint-staged)
- Gérer les tests flaky en CI
- Optimiser les couts et la vitesse du pipeline

---

## Shift left : tester le plus tot possible

### La pyramide de feedback

```
                    ┌─────────┐
                    │  Prod   │  ← Monitoring, alertes
                   ┌┴─────────┴┐
                   │  Staging  │  ← Tests smoke, e2e
                  ┌┴───────────┴┐
                  │   CI/CD     │  ← Tests auto, coverage, lint
                 ┌┴─────────────┴┐
                 │  Pre-commit   │  ← Hooks, lint, format
                ┌┴───────────────┴┐
                │    IDE / Local  │  ← Types, tests watch, snippets
                └─────────────────┘
  Plus tot = moins cher, plus rapide, plus facile a corriger
```

### Cout de correction selon le moment de detection

| Detecte en... | Cout relatif | Exemple |
|---------------|-------------|---------|
| IDE (live) | 1x | TypeScript error, ESLint |
| Pre-commit | 2x | Lint, format, tests rapides |
| CI (PR) | 5x | Tests complets, couverture |
| Staging | 20x | Bug en review manuelle |
| Production | 100x | Incident client, rollback |

---

## GitHub Actions : pipeline complet

### Workflow de base

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Annuler les runs precedents sur la meme branche/PR
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ===================================
  # JOB 1 : Lint & Types
  # ===================================
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm eslint . --max-warnings 0

      - name: Type check
        run: pnpm tsc --noEmit

  # ===================================
  # JOB 2 : Tests unitaires
  # ===================================
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests with coverage
        run: pnpm vitest run --coverage --reporter=junit --outputFile=test-results/junit.xml

      - name: Upload coverage to Codecov
        if: always()
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info
          token: ${{ secrets.CODECOV_TOKEN }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: unit-test-results
          path: |
            test-results/
            coverage/
          retention-days: 7

  # ===================================
  # JOB 3 : Tests E2E (Playwright)
  # ===================================
  e2e-tests:
    name: E2E Tests (${{ matrix.shard }}/${{ strategy.job-total }})
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: [lint] # Attendre que le lint passe

    strategy:
      fail-fast: false # Continuer meme si un shard echoue
      matrix:
        shard: [1, 2, 3, 4]

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm playwright install --with-deps chromium

      - name: Build application
        run: pnpm build

      - name: Run E2E tests (shard ${{ matrix.shard }}/4)
        run: |
          pnpm playwright test \
            --shard=${{ matrix.shard }}/4 \
            --reporter=junit \
            --reporter=html
        env:
          CI: true
          BASE_URL: http://localhost:3000

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/
          retention-days: 7

      - name: Upload test traces (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces-${{ matrix.shard }}
          path: test-results/
          retention-days: 3

  # ===================================
  # JOB 4 : Merge des rapports E2E
  # ===================================
  e2e-report:
    name: Merge E2E Reports
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: always()

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Download all shard reports
        uses: actions/download-artifact@v4
        with:
          pattern: playwright-report-*
          path: all-reports/

      - name: Merge reports
        run: pnpm playwright merge-reports --reporter=html all-reports/

      - name: Upload merged report
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-merged
          path: playwright-report/
          retention-days: 14
```

### Matrix strategy : tester sur plusieurs Node/OS

```yaml
  unit-tests:
    name: Unit Tests (Node ${{ matrix.node }}, ${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        node: [18, 20, 22]
        os: [ubuntu-latest, windows-latest]
        exclude:
          - node: 18
            os: windows-latest # Exclure une combinaison

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      # ...
```

---

## Parallelisation des tests

### Vitest : workers et pool

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Pool de workers
    pool: 'forks', // 'threads' | 'forks' | 'vmThreads'

    // Nombre de workers (par defaut : nombre de CPUs)
    poolOptions: {
      forks: {
        maxForks: 4,    // Maximum 4 process
        minForks: 1,    // Minimum 1
      },
    },

    // Isoler chaque fichier dans son worker
    fileParallelism: true,

    // Sequencer (ordre d'execution)
    sequence: {
      // Executer les fichiers les plus lents en premier
      sequencer: class extends BaseSequencer {
        async sort(files: string[]) {
          // Trier par duree (du cache) decroissante
          return files;
        }
      },
    },
  },
});
```

### Playwright : sharding

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Nombre de workers locaux
  workers: process.env.CI ? 2 : '50%',

  // Nombre de tentatives en CI
  retries: process.env.CI ? 2 : 0,

  // Sharding (active via CLI)
  // pnpm playwright test --shard=1/4
});
```

### Repartition intelligente des tests

```yaml
  # Splitter les tests par duree estimee
  e2e-tests:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]

    steps:
      # ...
      - name: Run E2E tests
        run: pnpm playwright test --shard=${{ matrix.shard }}/4
```

Playwright repartit automatiquement les fichiers de test entre les shards de manière equilibree.

---

## Rapports et artefacts

### JUnit XML (standard universel)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
```

```xml
<!-- Exemple de sortie JUnit -->
<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="142" failures="2" errors="0" time="12.345">
  <testsuite name="src/services/pricing.test.ts" tests="8" failures="0" time="0.234">
    <testcase name="calculatePrice > should apply discount for bulk orders"
              classname="src/services/pricing.test.ts"
              time="0.012"/>
    <!-- ... -->
  </testsuite>
</testsuites>
```

### Intégration Codecov

```yaml
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info
          token: ${{ secrets.CODECOV_TOKEN }}
          flags: unit-tests
          fail_ci_if_error: false
```

Configuration Codecov :

```yaml
# codecov.yml (a la racine du repo)
coverage:
  status:
    project:
      default:
        target: 80%
        threshold: 2% # Tolerer 2% de variation
    patch:
      default:
        target: 80% # Couverture des lignes modifiees

comment:
  layout: "reach, diff, flags, files"
  behavior: default
  require_changes: false
```

### GitHub PR Checks et commentaires

```yaml
      - name: Post test results as PR comment
        if: github.event_name == 'pull_request' && always()
        uses: dorny/test-reporter@v1
        with:
          name: Unit Test Results
          path: test-results/junit.xml
          reporter: java-junit
          fail-on-error: false
```

---

## Fail-fast vs Run-all

### Fail-fast (defaut pour matrix)

```yaml
    strategy:
      fail-fast: true # Arrete tous les jobs si un echoue
      matrix:
        node: [18, 20, 22]
```

**Avantage** : feedback rapide, economie de minutes CI.
**Inconvenient** : on ne voit pas toutes les erreurs d'un coup.

### Run-all

```yaml
    strategy:
      fail-fast: false # Tous les jobs tournent meme si un echoue
      matrix:
        shard: [1, 2, 3, 4]
```

**Quand utiliser run-all :**
- E2E tests avec sharding (on veut tous les résultats)
- Matrix OS/Node (on veut savoir quels environnements cassent)
- Tests non-déterministes en investigation

### Stratégie recommandee

```yaml
jobs:
  lint:
    # fail-fast implicite (pas de matrix)

  unit-tests:
    strategy:
      fail-fast: true   # Rapide, un echec = tout le lot echoue
      matrix:
        node: [18, 20]

  e2e-tests:
    needs: [lint]        # Gate : lint doit passer d'abord
    strategy:
      fail-fast: false   # Collecter tous les resultats
      matrix:
        shard: [1, 2, 3, 4]
```

---

## Pre-commit hooks : Husky + lint-staged

### Installation

```bash
pnpm add -D husky lint-staged

# Initialiser Husky
pnpm husky init
```

### Configuration Husky

```bash
# .husky/pre-commit
pnpm lint-staged
```

### Configuration lint-staged

```json
// package.json (ou .lintstagedrc.json)
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings 0",
      "vitest related --run"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}
```

### vitest related : tester uniquement les fichiers impactes

```bash
# Trouver les tests lies aux fichiers modifies
pnpm vitest related src/services/pricing.ts --run
# -> Execute pricing.test.ts et tout test qui importe pricing.ts
```

### Pre-push hook pour les tests plus longs

```bash
# .husky/pre-push
pnpm vitest run --coverage
```

### Contourner temporairement (avec justification)

```bash
# UNIQUEMENT en cas d'urgence, jamais en pratique courante
git commit --no-verify -m "hotfix: emergency patch"
```

---

## Detection et gestion des tests flaky en CI

### Le problème

Un test flaky passe localement mais echoue aleatoirement en CI (où l'inverse). Causes typiques :
- Timing (timeouts trop courts en CI)
- Ressources limitees (CPU/RAM sur runners)
- Acces réseau
- Ordre d'exécution différent

### Detection automatique

```yaml
      - name: Run tests with flaky detection
        run: |
          # Lancer 3 fois pour detecter les flaky
          for i in 1 2 3; do
            pnpm vitest run --reporter=json --outputFile=results-$i.json || true
          done

      - name: Analyze flaky tests
        run: |
          node scripts/detect-flaky.js results-1.json results-2.json results-3.json
```

```typescript
// scripts/detect-flaky.ts
import { readFileSync } from 'node:fs';

interface TestResult {
  testResults: Array<{
    name: string;
    status: 'passed' | 'failed';
  }>;
}

function detectFlaky(files: string[]): void {
  const allResults = files.map((f) =>
    JSON.parse(readFileSync(f, 'utf-8')) as TestResult,
  );

  const testStatuses = new Map<string, Set<string>>();

  for (const result of allResults) {
    for (const test of result.testResults) {
      if (!testStatuses.has(test.name)) {
        testStatuses.set(test.name, new Set());
      }
      testStatuses.get(test.name)!.add(test.status);
    }
  }

  const flakyTests = [...testStatuses.entries()]
    .filter(([, statuses]) => statuses.size > 1)
    .map(([name]) => name);

  if (flakyTests.length > 0) {
    console.error('Flaky tests detected:');
    flakyTests.forEach((t) => console.error(`  - ${t}`));
    process.exit(1);
  }

  console.log('No flaky tests detected.');
}

detectFlaky(process.argv.slice(2));
```

### Quarantaine des tests flaky

```typescript
// vitest.config.ts — marquer les tests flaky
// Utiliser un tag pour les identifier
describe('Payment flow', () => {
  it.skipIf(process.env.QUARANTINE !== 'true')(
    'should process payment via external gateway',
    async () => {
      // Ce test est flaky — en quarantaine
    },
  );
});
```

### Retries en CI (Playwright)

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    // Traces uniquement sur retry (pour diagnostiquer)
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
});
```

---

## Tests dans Docker

### Pourquoi Docker en CI ?

- Environnement **identique** local et CI
- Dependances système controlees (Playwright browsers)
- Isolation complete
- Reproductibilite

### Dockerfile pour les tests

```dockerfile
# Dockerfile.test
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

# Copier uniquement les fichiers de dependances d'abord (cache Docker)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Copier le code source
COPY . .

# Commande par defaut
CMD ["pnpm", "test"]
```

### Docker Compose pour les tests d'intégration

```yaml
# docker-compose.test.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: testdb
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      timeout: 3s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.test
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://test:test@db:5432/testdb
      NODE_ENV: test
    command: pnpm vitest run
```

### Utiliser Docker dans GitHub Actions

```yaml
  integration-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Run integration tests
        run: pnpm vitest run --project integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb
```

---

## Optimisation des couts CI

### Caching agressif

```yaml
      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ~/.pnpm-store
          key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: |
            pnpm-${{ runner.os }}-

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
```

### Exécution conditionnelle

```yaml
  unit-tests:
    # Ne lancer que si des fichiers source ont change
    if: |
      github.event_name == 'push' ||
      contains(github.event.pull_request.labels.*.name, 'run-tests') ||
      !contains(github.event.head_commit.message, '[skip ci]')

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Check for source changes
        id: changes
        run: |
          CHANGED=$(git diff --name-only HEAD~1 | grep -E '^(src|tests)/' | wc -l)
          echo "source_changed=$CHANGED" >> $GITHUB_OUTPUT

      - name: Run tests
        if: steps.changes.outputs.source_changed != '0'
        run: pnpm vitest run
```

### Timeout et budget

```yaml
  e2e-tests:
    timeout-minutes: 30 # Tuer le job apres 30 min

    steps:
      # ...
      - name: Run E2E (with timeout)
        run: timeout 1200 pnpm playwright test # 20 min max
```

### Résumé des stratégies d'optimisation

| Stratégie | Gain estime | Complexite |
|-----------|-------------|------------|
| Cache pnpm/node_modules | 30-60% install time | Faible |
| Cache Playwright browsers | 2-3 min | Faible |
| Exécution conditionnelle | 100% (skip entier) | Moyenne |
| Sharding E2E | 50-75% | Moyenne |
| `fail-fast: true` (unit) | Variable | Faible |
| `concurrency` + cancel | Evite les runs inutiles | Faible |
| Runners self-hosted | Variable | Haute |

---

## Workflow complet : du commit au deploy

```yaml
# .github/workflows/full-pipeline.yml
name: Full Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: pipeline-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  # Gate 1 : Qualite du code
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm eslint . --max-warnings 0
      - run: pnpm tsc --noEmit
      - run: pnpm prettier --check .

  # Gate 2 : Tests unitaires
  unit:
    needs: quality
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run --coverage
      - uses: codecov/codecov-action@v4
        if: always()
        with:
          file: ./coverage/lcov.info
          token: ${{ secrets.CODECOV_TOKEN }}

  # Gate 3 : Build
  build:
    needs: unit
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/

  # Gate 4 : E2E
  e2e:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps chromium
      - uses: actions/download-artifact@v4
        with: { name: build-output, path: dist/ }
      - run: pnpm playwright test --shard=${{ matrix.shard }}/2
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: traces-${{ matrix.shard }}
          path: test-results/

  # Gate 5 : Deploy (main only)
  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [e2e]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with: { name: build-output, path: dist/ }
      - name: Deploy to production
        run: echo "Deploying..."
        # Remplacer par votre commande de deploy reelle
```

---

## Checklist du module

- [ ] Mon pipeline CI a des jobs separes (lint, unit, e2e)
- [ ] Les tests E2E utilisent le sharding pour paralleliser
- [ ] Les rapports de couverture sont envoyes a Codecov
- [ ] Les artefacts (rapports, traces) sont uploades
- [ ] Les pre-commit hooks verifient lint + tests impactes
- [ ] La stratégie fail-fast est configuree selon le type de tests
- [ ] Le caching est en place (pnpm, Playwright browsers)
- [ ] Les tests flaky sont detectes et mis en quarantaine

---

## Exercice pratique

Creez un pipeline GitHub Actions pour votre projet :

1. Job `lint` : ESLint + TypeScript check
2. Job `unit` : Vitest avec couverture + upload Codecov
3. Job `e2e` : Playwright avec 2 shards + upload des traces
4. Configurez Husky + lint-staged en pre-commit
5. Ajoutez le caching pnpm et Playwright
6. Testez en poussant une PR

> Solution dans le [Lab 13](../labs/lab-13-ci-cd/)

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [12 - Couverture et mutation testing](./12-couverture-et-mutation-testing) | [14 - Flaky tests et debugging](./14-flaky-tests-et-debugging) |

---

## Ressources

- [Quiz 13 : Testez vos connaissances](../quizzes/quiz-13-ci-cd.html)
- [Lab 13 : Tests en CI/CD](../labs/lab-13-ci-cd/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright Sharding](https://playwright.dev/docs/test-sharding)
- [Vitest Coverage](https://vitest.dev/guide/coverage)
- [Husky](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/lint-staged/lint-staged)

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 13 ci cd](../screencasts/screencast-13-ci-cd.md)
2. **Lab** : [lab-13-ci-cd](../labs/lab-13-ci-cd/README)
3. **Visualisation** : [Pipeline CI/CD](../visualizations/ci-pipeline.html)
4. **Quiz** : [quiz 13 ci cd](../quizzes/quiz-13-ci-cd.html)
:::
