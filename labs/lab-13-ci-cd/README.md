# Lab 13 — Tests en CI/CD

> **Outcome :** à la fin, tu sais écrire un workflow GitHub Actions complet qui exécute Vitest et Playwright, met en cache les dépendances, bloque le merge si les tests échouent, et publie rapports et artefacts — en **GitHub Actions réel** (YAML committé dans le dépôt TribuZen).
> **Vrai outil :** GitHub Actions (`.github/workflows/ci.yml`), Vitest `^4.1.9`, `@playwright/test ^1`. Aucun harnais simulé.
> **Feedback :** le coach valide en session sur l'onglet *Actions* du repo GitHub (les checks doivent être verts et le gate de merge configuré).

## Énoncé

TribuZen n'a pas encore de pipeline CI. Ta mission : créer `.github/workflows/ci.yml` avec 4 jobs séquentiels (`lint → unit → e2e → e2e-report`), configurer le cache pnpm et les navigateurs Playwright, et activer la branch protection sur `main` pour bloquer tout merge si un check est rouge.

Code de départ : le dépôt TribuZen avec `vitest.config.ts` et `playwright.config.ts` déjà présents — tu n'écris que le workflow YAML et la config coverage.

## Étapes (en friction)

1. **Créer le workflow.** Dans `.github/workflows/ci.yml`, déclare le déclencheur `push`/`pull_request` sur `main` et le bloc `concurrency` pour annuler les runs obsolètes. Fais-le sans regarder le corrigé — les clés `on`, `concurrency`, `group`, `cancel-in-progress`.

2. **Job lint.** Écris le job `lint` : checkout, pnpm setup v9, setup-node v20 avec `cache: pnpm`, install `--frozen-lockfile`, puis ESLint `--max-warnings 0` et `tsc --noEmit`. Objectif : comprendre pourquoi `cache: pnpm` suffit sans `actions/cache@v4` séparé.

3. **Job unit avec coverage et artefact.** Ajoute `unit` avec `needs: lint`. La commande est `pnpm vitest run --coverage`. Ajoute un step `upload-artifact` pour `coverage/`. Question : quelle condition faut-il sur ce step pour que le rapport soit uploadé même si les tests échouent ?

4. **Seuil de coverage.** Dans `vitest.config.ts`, ajoute `test.coverage.thresholds` avec `lines: 80` et `branches: 75`. Vérifie que `pnpm vitest run --coverage` échoue si la couverture est insuffisante (teste en baissant momentanément le seuil à 100 % pour provoquer l'échec).

5. **Job e2e en matrice de 2 shards.** Ajoute `e2e` avec `needs: unit`. Configure `strategy.matrix.shard: [1, 2]` et `fail-fast: false`. La commande Playwright est <code v-pre>pnpm playwright test --shard=${{ matrix.shard }}/2</code>. Ajoute le step d'install des navigateurs avec la bonne option pour Linux. Ajoute l'upload du rapport avec la bonne condition.

6. **Cache navigateurs Playwright.** Ajoute le step `actions/cache@v4` pour `~/.cache/ms-playwright` **avant** le step `playwright install`. Clé = <code v-pre>playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}</code>.

7. **Job e2e-report.** Ajoute le job de merge des rapports : `needs: e2e`, `if: always()`, download des artefacts `playwright-report-*`, `pnpm playwright merge-reports --reporter=html all-reports/`, re-upload du rapport fusionné.

8. **Gate de merge.** Sur GitHub, va dans *Settings > Branches > Branch protection rules*, crée une règle sur `main`, active *Require status checks to pass before merging*, et ajoute `Lint & Type Check`, `Unit Tests`, `E2E Tests (shard 1/2)`, `E2E Tests (shard 2/2)`. Pousse une branche de test avec un test cassé et vérifie que le merge est bloqué.

## Corrigé complet commenté

```yaml
# .github/workflows/ci.yml
name: CI

# Déclencheurs : toute PR vers main et tout push sur main.
# C'est ce qui crée les check runs visibles dans la PR GitHub.
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Annule les runs précédents sur la même branche/PR.
# Évite de consumer des minutes CI sur du code déjà dépassé par un nouveau push.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ── LINT ────────────────────────────────────────────────────────────────────
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 10        # tuer le job après 10 min, évite les runs zombies

    steps:
      - uses: actions/checkout@v4

      # pnpm doit être configuré AVANT setup-node pour que le cache fonctionne.
      - uses: pnpm/action-setup@v4
        with:
          version: 9

      # cache: pnpm active le cache intégré — clé = hash de pnpm-lock.yaml.
      # Réduit l'install de ~90 s à ~5 s sur un cache chaud.
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      # --frozen-lockfile : fail explicite si pnpm-lock.yaml est désynchronisé
      # (protection contre les dépendances fantômes ajoutées localement).
      - name: Installer les dépendances
        run: pnpm install --frozen-lockfile

      - name: ESLint (zéro warning toléré)
        run: pnpm eslint . --max-warnings 0

      - name: TypeScript — vérification de types
        run: pnpm tsc --noEmit

  # ── UNIT TESTS + COVERAGE ───────────────────────────────────────────────────
  unit:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: lint                # gate : si lint est rouge, unit ne démarre pas

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Installer les dépendances
        run: pnpm install --frozen-lockfile

      # pnpm vitest run --coverage :
      #   - lance tous les tests une fois (pas en mode watch)
      #   - génère coverage/ (lcov, html, text) via @vitest/coverage-v8
      #   - exit code 1 si les seuils définis dans vitest.config.ts ne sont pas atteints
      - name: Vitest — tests unitaires + coverage
        run: pnpm vitest run --coverage

      # if: always() = uploader même si le step précédent a échoué.
      # Sans ça, un échec de tests supprime le rapport qu'on voudrait consulter.
      - name: Upload rapport de couverture
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  # ── E2E PLAYWRIGHT (matrice de 2 shards) ────────────────────────────────────
  e2e:
    name: E2E Tests (shard ${{ matrix.shard }}/2)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: unit                # gate : unit doit être vert

    strategy:
      fail-fast: false         # si le shard 1 échoue, le shard 2 tourne quand même
      matrix:
        shard: [1, 2]          # 2 jobs parallèles, chacun reçoit 50 % des tests

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Installer les dépendances
        run: pnpm install --frozen-lockfile

      # Cache séparé pour les binaires Playwright (≠ node_modules).
      # Clé = hash de pnpm-lock.yaml : invalider si la version de Playwright change.
      - name: Cache navigateurs Playwright
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: playwright-${{ runner.os }}-

      # --with-deps : installe aussi les dépendances système Linux (libnss, libglib, etc.)
      # Sans ça, Playwright plante sur ubuntu-latest avec une erreur cryptique.
      # On cible chromium uniquement pour ne pas télécharger webkit/firefox.
      - name: Installer Playwright + dépendances système
        run: pnpm playwright install --with-deps chromium

      - name: Build de l'application
        run: pnpm build

      # --shard=${{ matrix.shard }}/2 : Playwright distribue les fichiers de test
      # équitablement entre les shards. Chaque shard génère son propre playwright-report/.
      - name: Tests E2E (shard ${{ matrix.shard }}/2)
        run: pnpm playwright test --shard=${{ matrix.shard }}/2
        env:
          CI: true

      # Rapport HTML de CE shard (sera fusionné dans le job e2e-report).
      # if: always() pour avoir le rapport y compris quand les tests sont rouges.
      - name: Upload rapport Playwright (shard ${{ matrix.shard }})
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/
          retention-days: 7

      # Traces uniquement en cas d'échec (les traces sont lourdes — 10-50 Mo/test).
      - name: Upload traces (échec uniquement)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces-${{ matrix.shard }}
          path: test-results/
          retention-days: 3

  # ── MERGE DES RAPPORTS PLAYWRIGHT ───────────────────────────────────────────
  e2e-report:
    name: Merge Playwright Reports
    runs-on: ubuntu-latest
    needs: e2e
    if: always()               # tourner même si certains shards ont échoué

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Télécharge les rapports de tous les shards dans all-reports/.
      - name: Télécharger tous les rapports de shards
        uses: actions/download-artifact@v4
        with:
          pattern: playwright-report-*
          path: all-reports/
          merge-multiple: true

      # merge-reports fusionne les blob reports en un rapport HTML unique navigable.
      - name: Fusionner les rapports en un HTML unifié
        run: pnpm playwright merge-reports --reporter=html all-reports/

      # Rapport final téléchargeable depuis l'onglet Actions de GitHub.
      - name: Upload rapport fusionné (14 jours)
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-merged
          path: playwright-report/
          retention-days: 14
```

Configuration coverage dans `vitest.config.ts` :

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],  // lcov pour les services de coverage
      // Seuils : Vitest exit code 1 si en dessous → job CI rouge → merge bloqué
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    // Retries en CI uniquement (Vitest)
    retry: process.env.CI ? 1 : 0,
  },
});
```

Configuration retries dans `playwright.config.ts` :

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  retries: process.env.CI ? 2 : 0,    // 2 tentatives en CI, 0 en local
  workers: process.env.CI ? 2 : '50%',
  use: {
    trace: 'on-first-retry',           // trace seulement sur 1er retry (pas sur chaque test)
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  reporter: [
    ['html'],                           // rapport HTML interactif
    ['blob'],                           // format binaire pour merge-reports
  ],
});
```

Points de validation coach : (a) `cache: pnpm` présent sur tous les jobs — pas de `actions/cache@v4` manquant ; (b) `if: always()` sur tous les upload d'artefacts de rapports ; (c) `--with-deps chromium` sur le step playwright install ; (d) `fail-fast: false` sur la matrice E2E ; (e) branch protection active avec les 4 checks requis ; (f) une PR avec un test cassé est bien bloquée (vérifier dans l'UI GitHub).

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 30 min**, et ajoute deux contraintes :

1. La matrice E2E passe de 2 à 3 shards. Mettre à jour le YAML et la commande `--shard=X/3`.
2. Ajouter un job `integration` entre `unit` et `e2e` qui lance `pnpm vitest run --project integration` avec un service `postgres:17-alpine` en `services:` GitHub Actions. Le job doit injecter `DATABASE_URL` en env var. (Référence : module 09 — tests d'intégration.)

Discrimine à voix haute : pourquoi le cache Playwright utilise `hashFiles('pnpm-lock.yaml')` et non un hash fixe ? Que se passe-t-il si on passe `merge-multiple: false` dans `download-artifact` ?

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `.github/workflows/ci.yml` à partir du corrigé ci-dessus. Adapte les commandes aux scripts `package.json` du repo (`pnpm test`, `pnpm build`, etc.).
2. Ajoute les seuils de coverage dans `vitest.config.ts`. Vérifie que `pnpm vitest run --coverage` passe en local avant de pousser.
3. Pousse la branche `ci/pipeline` et ouvre une PR vers `main`. Vérifie dans l'onglet *Checks* que les 4 jobs sont verts.
4. Active la branch protection sur `main` avec les 4 checks requis.
5. Crée une branche `test/ci-gate` avec un test intentionnellement cassé (`expect(true).toBe(false)`), pousse, ouvre une PR et vérifie que le merge est impossible (bouton grisé + message *Some checks were not successful*).
6. Commit final : `ci: pipeline GitHub Actions (lint + unit + e2e shards + gate merge)`.
