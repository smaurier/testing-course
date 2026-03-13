# Screencast 13 — Tests en CI/CD

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/13-tests-en-ci-cd.md`
- **Lab associe** : Lab 13
- **Prerequis** : Screencast 12

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Repository GitHub avec GitHub Actions configure
- [ ] Fichier `modules/13-tests-en-ci-cd.md` ouvert

## Script

### [00:00-02:00] Introduction — Shift left et pyramide de feedback

> "Shift left" signifie detecter les problemes le plus tot possible. Chaque couche de feedback est un filet de securite : analyse statique, tests unitaires, tests d'integration, tests E2E, monitoring.

**Action** : Afficher la pyramide de feedback.

```
                    ┌─────────┐
                    │  Prod   │  Monitoring, alertes
                   ┌┴─────────┴┐
                   │  Staging  │  Tests smoke, E2E
                  ┌┴───────────┴┐
                  │   CI/CD     │  Tests auto, coverage, lint
                 ┌┴─────────────┴┐
                 │  Pre-commit   │  Lint, format, type-check
                ┌┴───────────────┴┐
                │   IDE / Editor  │  ESLint, TypeScript, extensions
                └─────────────────┘
                Plus on est en bas, plus c'est rapide et pas cher
```

### [02:00-06:30] Pipeline GitHub Actions complet

**Action** : Creer `.github/workflows/ci.yml`.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4
        with:
          files: coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/
```

> Trois jobs en parallele : lint + typecheck, tests unitaires avec couverture, et tests E2E shardes sur 4 machines. Le sharding divise les tests en 4 groupes executes en parallele.

### [06:30-09:00] Parallelisation — Vitest workers et Playwright sharding

**Action** : Montrer la configuration de parallelisation.

```typescript
// vitest.config.ts — parallelisation Vitest
export default defineConfig({
  test: {
    pool: 'forks',         // ou 'threads'
    poolOptions: {
      forks: {
        maxForks: 4,       // 4 workers en parallele
      },
    },
  },
});
```

```typescript
// playwright.config.ts — parallelisation Playwright
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
});
```

```bash
# Sharding en CI (repartir sur N machines)
npx playwright test --shard=1/4
npx playwright test --shard=2/4
# Les resultats sont fusionnes apres
npx playwright merge-reports ./all-blob-reports
```

### [09:00-12:00] Pre-commit hooks — Husky + lint-staged

> Les pre-commit hooks attrapent les problemes avant meme le push.

**Action** : Configurer Husky + lint-staged.

```bash
pnpm add -D husky lint-staged
npx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "vitest related --run"
    ],
    "*.{json,md}": "prettier --write"
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

> `vitest related --run` est la cle : Vitest ne re-execute que les tests impactes par les fichiers modifies. Un commit qui touche 2 fichiers ne relance que les tests concernes, pas toute la suite.

### [12:00-14:30] Rapports — JUnit, Codecov, Playwright report

**Action** : Configurer les reporters.

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

```yaml
# Dans le workflow CI — publier le rapport Playwright
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 14
```

> Le rapport JUnit est le standard pour les CI. Codecov agrege la couverture entre les PRs. Le rapport Playwright HTML est l'outil de debugging ultime en cas d'echec.

### [14:30-16:30] Optimiser la CI — Cache et vitesse

**Action** : Afficher les strategies d'optimisation.

```
STRATEGIE                    | GAIN DE TEMPS
-----------------------------|----------------------------
Cache pnpm (actions/cache)   | -30% sur install
Cache Playwright browsers    | -1-2 min par run
Jobs en parallele            | lint ‖ unit ‖ e2e
Sharding Playwright          | /4 = -75% sur E2E
vitest related (pre-commit)  | Ne run que les tests impactes
Fail fast                    | Arreter des le premier echec
Skip E2E sur docs-only PR    | paths-filter action
```

```yaml
# Exemple : skip E2E si seuls les docs changent
- uses: dorny/paths-filter@v3
  id: changes
  with:
    filters: |
      src:
        - 'src/**'
        - 'e2e/**'
- if: steps.changes.outputs.src == 'true'
  run: npx playwright test
```

### [16:30-18:30] Gerer les flaky tests en CI

**Action** : Montrer les strategies.

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0, // retry 2 fois en CI
  reporter: [
    ['html'],
    ['github'],      // annotations dans les PR
    ['list'],
  ],
});
```

```yaml
# Quarantine : taguer les tests flaky
- run: npx playwright test --grep-invert @flaky
# Run les flaky separement (non-bloquant)
- run: npx playwright test --grep @flaky || true
```

### [18:30-19:30] Recapitulatif

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Shift left : detecter les problemes le plus tot possible
2. Pipeline : lint → unit tests → integration → E2E
3. Sharding Playwright pour paralleliser les E2E en CI
4. Husky + lint-staged + vitest related pour les pre-commit hooks
5. Cache pnpm et browsers pour accelerer la CI
6. Retries en CI pour les flaky, quarantine pour les cas chroniques

PROCHAINE ETAPE :
→ Screencast 14 : Flaky tests et debugging
```

## Points d'attention pour l'enregistrement
- Le workflow YAML complet est le coeur du screencast — bien le detailler
- Montrer un vrai run GitHub Actions si possible (screenshot ou live)
- Le sharding Playwright est un concept qui surprend souvent — bien expliquer
- vitest related est un gem — le montrer en action avec un pre-commit
