---
titre: Tests en CI/CD
cours: 06-testing
notions: [exécuter les tests en CI GitHub Actions, cache des dépendances, tests en parallèle et matrice, artefacts et rapports de test, gate de merge sur les tests, tests flaky en CI, coverage et seuils en CI, Playwright en CI]
outcomes: [écrire un workflow GitHub Actions qui lance Vitest et Playwright, mettre en cache les dépendances, bloquer le merge si les tests échouent, publier rapports et artefacts]
prerequis: [12b-tests-accessibilite]
next: 14-flaky-tests-et-debugging
libs: [{ name: vitest, version: ^4.1.9 }, { name: "@playwright/test", version: ^1 }]
tribuzen: pipeline CI TribuZen (Vitest + Playwright) bloquant le merge si rouge, avec cache et artefacts
last-reviewed: 2026-07
---

# Tests en CI/CD

> **Outcomes — tu sauras FAIRE :** écrire un workflow GitHub Actions complet qui exécute Vitest et Playwright, mettre en cache les dépendances pour accélérer le pipeline, configurer un gate de merge bloquant si les tests échouent, et publier rapports HTML et artefacts.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Lundi matin sur TribuZen. Une PR merge sur `main` un refactor de `FamilyService.removeMember()`. Les tests unitaires passent en local pour l'auteur — mais le job CI n'existe pas encore. Trois jours plus tard, un utilisateur signale que retirer un membre d'une famille désactive son compte au lieu de le déplacer en `INACTIVE`. Le bug existait dans la PR, les reviewers l'ont raté à l'œil.

Coût : une demie-journée de diagnostic + correction + redeploy + email d'excuse aux bêta-testeurs.

Si un pipeline CI avait lancé `vitest run` à chaque PR et bloqué le merge en cas d'échec, le bug aurait été détecté en 90 secondes sur le runner, avant le premier `git merge`.

La question centrale : **comment configurer GitHub Actions pour que les tests Vitest et Playwright s'exécutent automatiquement et bloquent le merge si rouge ?** Ce module répond point par point.

## 2. Théorie complète, concise

### Workflow GitHub Actions — anatomie d'un fichier CI

Un workflow est un fichier YAML dans `.github/workflows/`. Il se déclenche sur des événements (`on`), orchestre des `jobs` (parallèles par défaut), chaque job exécute des `steps` séquentiels.

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

La clé `pull_request` est celle qui compte pour les gates : GitHub crée un *check run* par job, et un check en rouge bloque le merge si la branche est protégée.

`concurrency` annule les runs précédents sur la même branche/PR, évitant de gaspiller des minutes CI sur un code déjà dépassé :

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

### Cache des dépendances — pourquoi et comment

Sans cache, chaque job fait `pnpm install` depuis zéro : 60-90 secondes de téléchargement npm. Avec cache, le store pnpm est restauré depuis le cache Actions si `pnpm-lock.yaml` n'a pas changé : l'install tombe à 5-10 secondes.

`actions/setup-node@v4` gère le cache nativement avec `cache: pnpm` (ou `npm`, `yarn`). Il combine `pnpm/action-setup` + `actions/cache` automatiquement :

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9

- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm          # hash de pnpm-lock.yaml comme clé de cache

- run: pnpm install --frozen-lockfile
```

`--frozen-lockfile` garantit que le lockfile ne dérive pas en CI (fail explicite si le lockfile est désynchronisé).

Pour les navigateurs Playwright, il faut un cache séparé — les binaires ne sont pas dans le node_modules :

```yaml
- name: Cache navigateurs Playwright
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: playwright-${{ runner.os }}-
```

### Jobs parallèles et matrice

Plusieurs jobs dans un même workflow s'exécutent en parallèle par défaut. `needs` crée une dépendance :

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    # ...
  unit:
    needs: lint          # attend que lint soit vert
    runs-on: ubuntu-latest
    # ...
  e2e:
    needs: unit          # attend unit
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
```

La **matrice** (`strategy.matrix`) multiplie un job : ici 4 jobs `e2e` parallèles, chacun portant `shard: 1`, `shard: 2`, etc. La valeur est accessible via `${{ matrix.shard }}`.

`fail-fast: false` sur la matrice E2E est délibéré : on veut tous les résultats, pas seulement le premier shard qui tombe.

### Artefacts et rapports de test

Les jobs CI sont éphémères — les fichiers générés (rapports HTML, traces, coverage) disparaissent à la fin du run. `actions/upload-artifact@v4` les persiste dans le stockage GitHub Actions (téléchargeables depuis l'UI, conservés N jours) :

```yaml
- uses: actions/upload-artifact@v4
  if: always()           # uploader même si les tests ont échoué
  with:
    name: playwright-report-${{ matrix.shard }}
    path: playwright-report/
    retention-days: 7
```

`if: always()` est essentiel : si les tests ont échoué, le step précédent a renvoyé un exit code non-zéro, et sans `always()` le step upload serait sauté — on n'aurait pas le rapport pour diagnostiquer.

Pour Playwright avec sharding, chaque shard génère son propre rapport. `actions/download-artifact@v4` + `playwright merge-reports` les fusionne en un rapport unifié dans un job dédié.

### Gate de merge — required checks

Un gate de merge se configure dans **Settings > Branches > Branch protection rules** sur GitHub :

1. Cocher *Require status checks to pass before merging*.
2. Ajouter le nom des jobs critiques (ex. `Unit Tests`, `E2E Tests`).
3. Cocher *Require branches to be up to date before merging* (optionnel mais recommandé).

Le nom du check = le champ `name:` du job dans le YAML (ou la valeur par défaut = le job id). Si un job échoue, le check est rouge, et GitHub bloque le bouton Merge.

Résultat concret sur TribuZen : si `FamilyService.removeMember()` casse un test unitaire, le check `Unit Tests` passe en rouge et le merge est impossible — le bug ne peut pas atteindre `main`.

### Tests flaky en CI — retries et détection

Un test flaky = test qui passe ou échoue de manière non-déterministe, souvent à cause de timing, de ressources limitées sur le runner, ou d'un ordre d'exécution différent.

En CI, le timing est différent du local (runners plus lents, réseau, contention CPU). Playwright gère les retries nativement :

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,  // 2 tentatives en CI, 0 en local
  use: {
    trace: 'on-first-retry',         // trace uniquement sur le 1er retry
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
});
```

Un test qui passe à la 2e tentative est flaky — Playwright le marque `flaky` dans le rapport HTML (orange, pas vert). C'est un signal d'alerte, pas un succès.

Pour Vitest, les retries se configurent par test ou globalement :

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    retry: process.env.CI ? 1 : 0,  // 1 retry en CI
  },
});
```

Stratégie pour un test flaky identifié : le **quarantiner** avec `it.skip` ou un tag `@flaky`, ouvrir un ticket, et le corriger avant de le réactiver — ne jamais laisser un test flaky silencieusement ignorer un vrai bug.

### Coverage et seuils en CI

Vitest génère un rapport de couverture avec `@vitest/coverage-v8` (ou `-istanbul`). En CI, on ajoute un **seuil** qui fait échouer le job si la couverture descend en dessous :

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

En CI, la commande est `pnpm vitest run --coverage`. Si la couverture passe sous le seuil, Vitest exit avec un code non-zéro → le job échoue → le check gate est rouge → merge bloqué.

Le rapport `lcov` est utilisé par les services de couverture (Codecov, Coveralls) qui postent un commentaire automatique sur la PR avec l'évolution de la couverture ligne par ligne.

### Playwright en CI avec `--with-deps`

Sur les runners Linux (ubuntu-latest), les navigateurs Playwright ont des dépendances système (libglib, libnss, etc.) absentes par défaut. Sans elles, Playwright plante avec une erreur cryptique à l'ouverture du navigateur.

La commande `playwright install --with-deps chromium` installe le binaire Chromium **et** toutes ses dépendances système via apt :

```yaml
- name: Installer Playwright et dépendances système
  run: pnpm playwright install --with-deps chromium
```

On cible `chromium` spécifiquement pour ne pas installer webkit et firefox (gros téléchargements inutiles si la suite ne les utilise pas). Si la suite requiert plusieurs navigateurs, lister `chromium firefox webkit`.

L'image `mcr.microsoft.com/playwright` pré-installe tout (utile pour Docker CI), mais sur les runners GitHub Standards, `--with-deps` est la voie directe.

## 3. Worked examples

### Workflow complet TribuZen — Vitest + Playwright

Voici le YAML de production utilisé sur TribuZen, annoté pas-à-pas.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Annuler le run précédent sur la même branche/PR (économie de minutes CI)
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ── JOB 1 : lint et typecheck ──────────────────────────────────────────────
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
          cache: pnpm          # cache intégré — hash de pnpm-lock.yaml

      - name: Installer les dépendances
        run: pnpm install --frozen-lockfile

      - name: ESLint (zéro warning toléré)
        run: pnpm eslint . --max-warnings 0

      - name: TypeScript check
        run: pnpm tsc --noEmit

  # ── JOB 2 : tests unitaires + coverage ────────────────────────────────────
  unit:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: lint              # gate : lint doit être vert

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

      - name: Vitest — tests + coverage
        run: pnpm vitest run --coverage
        # exit non-zéro si les seuils de coverage ne sont pas atteints

      - name: Upload rapport de couverture
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  # ── JOB 3 : tests E2E Playwright (matrice de shards) ──────────────────────
  e2e:
    name: E2E Tests (shard ${{ matrix.shard }}/4)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: unit              # gate : unit doit être vert

    strategy:
      fail-fast: false       # on collecte tous les résultats, pas juste le 1er échec
      matrix:
        shard: [1, 2, 3, 4]  # 4 jobs parallèles, chacun exécute 1/4 des tests

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

      - name: Cache navigateurs Playwright
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: playwright-${{ runner.os }}-

      - name: Installer Playwright + dépendances système Linux
        run: pnpm playwright install --with-deps chromium

      - name: Build de l'application
        run: pnpm build

      - name: Tests E2E (shard ${{ matrix.shard }}/4)
        run: pnpm playwright test --shard=${{ matrix.shard }}/4
        env:
          CI: true

      - name: Upload rapport HTML Playwright
        if: always()         # uploader même si des tests ont échoué
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/
          retention-days: 7

      - name: Upload traces (seulement en cas d'échec)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces-${{ matrix.shard }}
          path: test-results/
          retention-days: 3

  # ── JOB 4 : fusionner les rapports Playwright ─────────────────────────────
  e2e-report:
    name: Merge Playwright Reports
    runs-on: ubuntu-latest
    needs: e2e
    if: always()             # tourner même si certains shards ont échoué

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

      - name: Télécharger tous les rapports de shards
        uses: actions/download-artifact@v4
        with:
          pattern: playwright-report-*
          path: all-reports/
          merge-multiple: true

      - name: Fusionner en un rapport unifié
        run: pnpm playwright merge-reports --reporter=html all-reports/

      - name: Upload rapport fusionné
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-merged
          path: playwright-report/
          retention-days: 14
```

**Pas-à-pas des décisions clés :**

1. `needs: lint` sur `unit`, `needs: unit` sur `e2e` : cascade séquentielle. Un lint rouge ne lance pas les tests (économie de minutes CI, feedback rapide).
2. `strategy.matrix.shard: [1, 2, 3, 4]` avec `fail-fast: false` : 4 jobs E2E parallèles, chacun reçoit 25 % des tests de Playwright. Le temps total passe de 20 min à ~5 min. `fail-fast: false` permet de voir tous les échecs à la fois.
3. Cache Playwright séparé : les binaires (~200 Mo) ne sont pas dans `node_modules`. Clé = hash du lockfile pour invalider si la version de Playwright change.
4. `if: always()` sur l'upload des rapports : si le step `playwright test` échoue (exit code 1), sans `always()` le step upload est ignoré et on n'a pas le rapport HTML pour diagnostiquer.
5. Le job `e2e-report` fusionne les 4 rapports HTML en un seul téléchargeable depuis l'UI GitHub.

### Gate de merge — configuration GitHub

Dans le dépôt TribuZen, `main` est protégé avec ces règles :

- *Require status checks to pass before merging* : activé.
- Checks requis : `Lint & Type Check`, `Unit Tests`, `E2E Tests (shard 1/4)` … `(shard 4/4)`.
- *Require branches to be up to date* : activé (la PR doit être à jour avec `main` avant de merger).

Avec cette configuration, la PR du refactor `removeMember` aurait été bloquée : le test `FamilyService > removeMember > déplace le membre en INACTIVE` serait passé rouge, le check `Unit Tests` rouge, le merge impossible.

## 4. Pièges & misconceptions

- **Pas de cache = CI chroniquement lente.** Sans cache `pnpm` et Playwright, chaque run télécharge 300-500 Mo de dépendances. Sur un pipeline à 50 PR/jour, c'est des heures de runner gaspillées et des PRs qui attendent 10 min au lieu de 90 secondes. *Correct* : configurer le cache dès le premier workflow, pas en optimisation a posteriori.

- **Flaky ignoré = fausse sécurité.** Un test qui passe à la 2e tentative grâce aux `retries` masque un problème réel. Si on laisse les retries tourner indéfiniment sans quarantiner le test flaky, le pipeline reste « vert » mais ne garantit plus rien. *Correct* : traiter le `flaky` marqué par Playwright comme un bug de test — l'isoler, le diagnostiquer, le corriger. Les retries sont un filet de sécurité pour les faux flaky (contention CI passagère), pas une excuse pour ne pas corriger.

- **Pas de gate de merge = pipeline cosmétique.** Un workflow CI qui tourne mais dont aucun check n'est requis pour le merge ne protège rien — les développeurs peuvent ignorer le rouge et merger quand même. *Correct* : configurer la branch protection rule avec les checks requis dès qu'on crée le premier workflow. Sans règle de protection, le CI est informatif, pas bloquant.

- **`if: always()` manquant sur l'upload des rapports.** Erreur la plus fréquente : quand les tests échouent, le step upload est sauté car le step précédent a renvoyé un exit code non-zéro. On se retrouve à chercher un rapport qui n'existe pas. *Correct* : mettre `if: always()` sur tout `upload-artifact` lié à des rapports de test ou de couverture.

- **Oublier `--with-deps` sur Linux.** Playwright sur `ubuntu-latest` sans `--with-deps` plante à l'ouverture du navigateur avec une erreur sur les librairies système manquantes (`libnss3`, etc.), pas sur le test lui-même. *Correct* : toujours utiliser `pnpm playwright install --with-deps chromium` en CI — la variante sans `--with-deps` est pour le local où les dépendances système sont déjà présentes.

- **Seuils de coverage trop bas ou absents.** Une couverture à 40 % ne gate rien d'utile, et sans seuil la coverage peut s'effondrer silencieusement PR après PR. *Correct* : définir des seuils réalistes (`lines: 80`, `branches: 75`) dans `vitest.config.ts` dès le début, et les faire monter progressivement. Le seuil fait échouer le job → gate rouge → merge bloqué.

## 5. Ancrage TribuZen

Couche fil-rouge : **pipeline CI TribuZen (Vitest + Playwright) bloquant le merge si rouge, avec cache et artefacts** (`smaurier/tribuzen`).

Le workflow du worked example ci-dessus est le fichier `.github/workflows/ci.yml` réel de TribuZen. En session, on le crée pas à pas :

- Job `lint` : protège `main` contre les régressions TypeScript et ESLint (particulièrement utile sur les types Nuxt/Vue auto-générés).
- Job `unit` avec coverage : lance les tests Vitest sur `InvitationService`, `FamilyService`, `RBAC` — la logique domaine du module 04. Le seuil `lines: 80` force à maintenir la couverture des branches métier critiques.
- Job `e2e` en matrice de 4 shards : les tests Playwright du module 11 (navigation famille, flow invitation) s'exécutent en parallèle. `--with-deps chromium` est obligatoire sur `ubuntu-latest`.
- Branch protection sur `main` : les 3 check types (`Lint & Type Check`, `Unit Tests`, `E2E Tests`) sont requis. Le bug `removeMember` de la section 1 aurait été bloqué ici.
- Artefacts : le rapport HTML Playwright fusionné est téléchargeable depuis l'onglet *Actions* de GitHub — pratique pour diagnostiquer un E2E rouge sans devoir reproduire en local.

## 6. Points clés

1. Un workflow GitHub Actions se déclenche sur `push`/`pull_request` ; chaque job génère un *check run* utilisable comme gate de merge.
2. `cache: pnpm` sur `actions/setup-node@v4` réduit l'install de 60-90 s à 5-10 s via le hash de `pnpm-lock.yaml` comme clé de cache.
3. `strategy.matrix` multiplie un job en N instances parallèles ; `fail-fast: false` sur les shards E2E permet de collecter tous les résultats même si un shard échoue.
4. `if: always()` sur `upload-artifact` garantit que les rapports sont uploadés même si les tests ont échoué — sans ça, on n'a pas de rapport à diagnostiquer.
5. Le gate de merge se configure dans *Settings > Branch protection rules* : cocher *Require status checks* avec les noms exacts des jobs critiques.
6. Les retries Playwright (`retries: 2` en CI) sont un filet de sécurité, pas un correctif : un test marqué `flaky` doit être quarantiné et corrigé.
7. Les seuils de coverage dans `vitest.config.ts` (`thresholds.lines: 80`) font échouer le job si la couverture descend — le seuil est un gate autant que les tests eux-mêmes.
8. `pnpm playwright install --with-deps chromium` est obligatoire sur `ubuntu-latest` : sans les dépendances système Linux, Playwright ne peut pas ouvrir le navigateur.

## 7. Seeds Anki

```
Quelle clé YAML rend un job dépendant d'un autre dans GitHub Actions ?|needs: [nom-du-job] — le job attend que ses dépendances soient vertes avant de démarrer
Comment mettre en cache pnpm dans un workflow GitHub Actions ?|actions/setup-node@v4 avec cache: pnpm — utilise automatiquement le hash de pnpm-lock.yaml comme clé
Pourquoi mettre if: always() sur un step upload-artifact de rapport de test ?|Sans always(), si les tests échouent (exit code non-zéro), le step upload est sauté et le rapport est perdu
Comment bloquer le merge d'une PR si les tests CI échouent ?|Branch protection rule > Require status checks to pass before merging — ajouter le nom exact des jobs critiques
À quoi sert strategy.matrix.shard avec Playwright ?|Distribue les tests E2E sur N jobs parallèles (pnpm playwright test --shard=X/N) pour réduire le temps total d'exécution
Que fait pnpm playwright install --with-deps chromium en CI ?|Installe le binaire Chromium ET toutes ses dépendances système Linux (libnss, libglib, etc.) — obligatoire sur ubuntu-latest
Un test Playwright passe à la 2e tentative grâce aux retries. Est-ce un succès ?|Non — Playwright le marque flaky (orange). C'est un signal d'alerte à traiter comme un bug de test, pas un succès
Comment configurer un seuil de coverage qui fait échouer le job CI ?|vitest.config.ts > test.coverage.thresholds > { lines: 80, branches: 75 } — Vitest exit code 1 si en dessous
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-13-ci-cd/`. Tu crées le fichier `.github/workflows/ci.yml` réel de TribuZen de zéro : jobs lint, unit (Vitest + coverage), e2e (Playwright + matrix de 2 shards), cache pnpm et Playwright, artefacts, gate de merge. Corrigé YAML complet commenté + variante J+30 dans le README du lab.
