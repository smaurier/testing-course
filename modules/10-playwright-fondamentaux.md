---
titre: Playwright fondamentaux
cours: 06-testing
notions: [configuration Playwright, locators et rôles accessibles getByRole getByLabel, actions click fill press, assertions web-first, auto-waiting vs sleep, isolation et fixtures page context, trace viewer et debug, intégration CI]
outcomes: [écrire un test E2E pilotant un vrai navigateur, cibler par rôle accessible, utiliser les assertions web-first et l'auto-waiting, déboguer avec la trace]
prerequis: [09-tests-integration]
next: 11-playwright-avance
libs: [{ name: "@playwright/test", version: ^1 }]
tribuzen: test E2E du parcours d'invitation TribuZen (ouvrir le formulaire, saisir un email, valider, voir le membre apparaître)
last-reviewed: 2026-07
---

# Playwright fondamentaux

> **Outcomes — tu sauras FAIRE :** écrire un test E2E qui pilote un vrai navigateur, cibler les éléments par rôle accessible (`getByRole`, `getByLabel`), utiliser les assertions web-first et l'auto-waiting de Playwright, et déboguer un test en échec avec le Trace Viewer.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, le parcours d'invitation est critique : un membre saisit l'email d'un proche, valide le formulaire, et voit le nouveau membre apparaître dans sa liste de famille. Tu dois pouvoir détecter une régression sur ce flux **avant la mise en production** — pas en testant la logique isolée (module 04 a couvert ça avec Vitest), mais en pilotant un **vrai navigateur** sur l'application réelle.

Voici le test qu'on veut écrire avant de lire la théorie :

```ts
import { test, expect } from '@playwright/test';

test('parcours invitation — le membre apparaît dans la liste', async ({ page }) => {
  await page.goto('/invitations/new');

  await page.getByLabel('Adresse email').fill('sophie@tribu.fr');
  await page.getByRole('button', { name: /inviter/i }).click();

  await expect(page.getByRole('listitem', { name: /sophie@tribu\.fr/i })).toBeVisible();
});
```

Questions que ce test soulève : comment Playwright sait-il qu'attendre avant de chercher le `listitem` ? Que signifie `getByRole` et `getByLabel` ? Comment le projet est-il configuré pour démarrer l'app ? La théorie répond à tout ça.

## 2. Théorie complète, concise

### Configuration — `playwright.config.ts`

`defineConfig` est le point d'entrée. Les clés essentielles :

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',   // trace en cas d'échec — voir §Trace Viewer
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],

  // Démarre l'app avant les tests, la réutilise en local
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Points clés : `baseURL` permet d'écrire `page.goto('/invitations/new')` partout ; `webServer` démarre l'app automatiquement ; `retries: 2` en CI absorbe les flakiness réseaux.

### Locators — cibler par rôle accessible (`getByRole`, `getByLabel`)

Un locator est une **recette de sélection** différée : il ne cherche pas l'élément tout de suite, seulement au moment de l'action ou de l'assertion. Playwright recommande de cibler par sémantique ARIA plutôt que par CSS — les mêmes critères que les lecteurs d'écran.

**`getByRole(role, { name })`** — le locator prioritaire :

```ts
// Bouton identifié par son texte accessible
page.getByRole('button', { name: /inviter/i })

// Lien
page.getByRole('link', { name: /mes invitations/i })

// Champ texte (role=textbox)
page.getByRole('textbox', { name: /email/i })

// Heading de niveau 1
page.getByRole('heading', { level: 1 })

// Item de liste avec nom accessible
page.getByRole('listitem', { name: /sophie@tribu\.fr/i })

// Case à cocher
page.getByRole('checkbox', { name: /confirmer/i })
```

**`getByLabel(text)`** — pour les champs de formulaire avec `<label>` associé :

```ts
// Cible l'<input> associé au <label>Adresse email</label>
page.getByLabel('Adresse email')
page.getByLabel(/mot de passe/i)
```

**Atout RGAA :** cibler par `getByRole` et `getByLabel` force l'app à avoir une sémantique HTML correcte (`role`, `aria-label`, associations `for`/`id`). Un test qui passe via `getByRole` est une preuve d'accessibilité partielle — directement utile pour la certification RGAA 4.1.

Autres locators, par ordre de priorité décroissante :

| Locator | Usage |
|---------|-------|
| `getByRole` | premier choix — rôle ARIA + nom accessible |
| `getByLabel` | champs formulaire |
| `getByPlaceholder` | champs sans label visible |
| `getByText` | contenu textuel visible |
| `getByTestId` | dernier recours — `data-testid` |
| `locator('.css')` | éviter sauf pour filtres `filter({ has })` |

**Filtres et chaînage :**

```ts
// Filtrer une liste
page.getByRole('listitem').filter({ hasText: 'sophie@tribu.fr' })

// Scope : chercher dans un composant parent
page.getByRole('region', { name: /famille/i })
    .getByRole('button', { name: /supprimer/i })
```

### Actions — `click`, `fill`, `press`

Toutes les actions attendent automatiquement que l'élément soit **attaché, visible, stable, activé et réceptif aux événements** avant d'agir (voir §Auto-waiting).

```ts
// Clic simple
await page.getByRole('button', { name: /inviter/i }).click()

// fill : vide le champ puis écrit (recommandé pour les formulaires)
await page.getByLabel('Adresse email').fill('sophie@tribu.fr')

// press : touche clavier sur un élément
await page.getByLabel('Adresse email').press('Enter')

// Navigation
await page.goto('/invitations/new')

// Attendre une URL après action
await page.waitForURL('/invitations')
```

### Assertions web-first — `expect(locator).toBeVisible()`

Les assertions Playwright sont **web-first** : `expect(locator).toBeVisible()` attend activement (jusqu'à `expect.timeout`, défaut 5 s) que la condition soit vraie. Ce n'est pas un snapshot immédiat.

```ts
// Visibilité
await expect(page.getByRole('heading', { name: /invitations/i })).toBeVisible()
await expect(page.getByText('Erreur réseau')).toBeHidden()

// Texte et contenu
await expect(page.getByRole('heading')).toHaveText('Nouvelle invitation')
await expect(page.getByRole('alert')).toContainText(/email invalide/i)

// URL et titre
await expect(page).toHaveURL('/invitations')
await expect(page).toHaveTitle(/TribuZen/i)

// Valeur d'input
await expect(page.getByLabel('Adresse email')).toHaveValue('sophie@tribu.fr')
await expect(page.getByLabel('Adresse email')).toBeEmpty()

// État
await expect(page.getByRole('button', { name: /inviter/i })).toBeEnabled()
await expect(page.getByRole('button', { name: /inviter/i })).toBeDisabled()
await expect(page.getByRole('checkbox')).toBeChecked()

// Nombre d'éléments
await expect(page.getByRole('listitem')).toHaveCount(3)

// Assertion négative
await expect(page.getByRole('alert')).not.toBeVisible()
```

**Différence fondamentale avec Vitest :** en Vitest, `expect(val).toBe(x)` est synchrone et immédiat. En Playwright, `await expect(locator).toBeVisible()` est asynchrone et réessaie jusqu'au timeout — c'est le mécanisme d'auto-waiting des assertions.

### Auto-waiting vs `waitForTimeout`

Playwright attend **automatiquement** l'actionabilité avant chaque action (`click`, `fill`, etc.) et avant chaque assertion web-first. Il n'est presque jamais nécessaire d'attendre manuellement.

```ts
// MAUVAIS — style Selenium : sleeps manuels
await page.goto('/invitations')
await page.waitForTimeout(2000)          // ne jamais faire ça
await page.waitForSelector('.invitation-list') // inutile ici
await page.click('.invite-btn')

// BON — style Playwright : auto-waiting intégré
await page.goto('/invitations/new')
await page.getByRole('button', { name: /inviter/i }).click()
// Playwright attend que le bouton soit visible + activé avant de cliquer
```

Quand l'auto-wait ne suffit pas — cas légitimes :

```ts
// Attendre explicitement un état réseau (ex : AJAX qui charge la liste)
await page.waitForResponse('**/api/invitations')

// Attendre qu'un loader disparaisse avant de continuer
await page.getByRole('progressbar').waitFor({ state: 'hidden' })

// Attendre une URL de redirection après soumission
await page.waitForURL('/invitations')
```

Règle : si tu écris `waitForTimeout`, c'est un signal que quelque chose cloche — cherche l'assertion web-first ou le `waitFor` sémantique qui correspond.

### Isolation et fixtures — `page`, `context`

Chaque test reçoit une **fixture `page`** appartenant à un `BrowserContext` isolé, créé spécifiquement pour ce test. Les cookies, localStorage, sessions ne fuient pas d'un test à l'autre.

```ts
import { test } from '@playwright/test';

test('test A', async ({ page }) => {
  // "page" est dans un BrowserContext isolé
  // Session, cookies, storage = vierges
});

test('test B', async ({ page }) => {
  // BrowserContext complètement séparé de test A
  // Même si test A a créé une session, ici elle n'existe pas
});
```

**Context fixture** — pour des opérations de bas niveau (`route`, interception réseau) :

```ts
test('avec interception réseau', async ({ page, context }) => {
  // Bloquer toutes les images
  await context.route('**/*.{jpg,png,webp}', route => route.abort())
  await page.goto('/invitations')
})
```

**Fixture personnalisée** (patterns avancés) — extend pour pré-authentifier :

```ts
import { test as base } from '@playwright/test'

export const test = base.extend({
  page: async ({ baseURL, page }, use) => {
    // Navigation automatique avant chaque test
    await page.goto(baseURL ?? '/')
    await use(page)
  },
})
```

### Trace Viewer et debug

Le Trace Viewer est un outil de débogage visuel : timeline des actions, screenshots avant/après chaque étape, snapshot DOM, logs réseau, erreurs console.

**Activer :**

```ts
// playwright.config.ts
use: {
  trace: 'on-first-retry',  // recommandé CI : trace seulement sur l'échec
  // trace: 'on',           // toujours (ralentit)
}
```

**Visualiser :**

```bash
# Ouvrir le rapport HTML (contient les traces des tests en échec)
npx playwright show-report

# Ouvrir une trace spécifique
npx playwright show-trace test-results/e2e-invitation-chromium/trace.zip
```

**Mode debug interactif :**

```bash
# Pas à pas dans le terminal + Playwright Inspector
npx playwright test --debug

# Interface UI complète (watch + traces en direct)
npx playwright test --ui
```

### Intégration CI

```yaml
# .github/workflows/e2e.yml
- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npx playwright test
  env:
    CI: true
    BASE_URL: http://localhost:3000

- name: Upload Playwright report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

Avec `CI=true`, la config active `retries: 2` et `workers: 1` (séquentiel). L'artifact `playwright-report` contient les traces des tests en échec — téléchargeable depuis l'interface GitHub Actions.

## 3. Worked examples

### Exemple A — parcours invitation complet

Objectif : vérifier que le flux nominale d'invitation fonctionne de bout en bout. On ouvre le formulaire, on saisit un email, on soumet, et on vérifie que le nouveau membre apparaît dans la liste.

```ts
// e2e/invitation.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Parcours invitation TribuZen', () => {

  test('invite un membre — il apparaît dans la liste', async ({ page }) => {
    // 1. Naviguer vers le formulaire d'invitation
    await page.goto('/invitations/new')

    // 2. Vérifier que le formulaire est affiché (assertion web-first)
    await expect(page.getByRole('heading', { name: /inviter un membre/i })).toBeVisible()

    // 3. Remplir l'email via getByLabel (force l'accessibilité du label)
    await page.getByLabel('Adresse email').fill('sophie@tribu.fr')

    // 4. Soumettre via getByRole (force un bouton sémantique)
    await page.getByRole('button', { name: /inviter/i }).click()

    // 5. Playwright attend automatiquement la mise à jour de la liste
    //    toBeVisible() réessaie jusqu'à 5 s — aucun sleep nécessaire
    await expect(
      page.getByRole('listitem', { name: /sophie@tribu\.fr/i })
    ).toBeVisible()
  })

  test('rejette un email invalide — affiche une erreur', async ({ page }) => {
    await page.goto('/invitations/new')

    // Saisir un email malformé
    await page.getByLabel('Adresse email').fill('pas-un-email')
    await page.getByRole('button', { name: /inviter/i }).click()

    // L'erreur s'affiche — l'utilisateur reste sur le formulaire
    await expect(page.getByRole('alert')).toContainText(/email invalide/i)
    await expect(page).toHaveURL('/invitations/new')

    // Le champ conserve la valeur saisie (UX)
    await expect(page.getByLabel('Adresse email')).toHaveValue('pas-un-email')
  })

  test('rejette un doublon — affiche un message spécifique', async ({ page }) => {
    await page.goto('/invitations/new')

    // Premier envoi (nominal)
    await page.getByLabel('Adresse email').fill('alice@tribu.fr')
    await page.getByRole('button', { name: /inviter/i }).click()
    await expect(page.getByRole('listitem', { name: /alice@tribu\.fr/i })).toBeVisible()

    // Deuxième envoi (doublon)
    await page.getByRole('link', { name: /inviter un autre/i }).click()
    await page.getByLabel('Adresse email').fill('alice@tribu.fr')
    await page.getByRole('button', { name: /inviter/i }).click()

    await expect(page.getByRole('alert')).toContainText(/déjà invité/i)
  })
})
```

Pas-à-pas : (1) `getByLabel` garantit que l'`<input>` a un `<label>` associé — test + RGAA ; (2) `getByRole('button', { name: /inviter/i })` garantit que le bouton a un texte accessible ; (3) `toBeVisible()` sur le `listitem` réessaie automatiquement pendant 5 s — aucun `waitForTimeout` ; (4) chaque test est isolé (BrowserContext neuf) — l'invitation du test 3 ne pollue pas le test 2.

### Exemple B — isolation vérifiée + interception réseau (fading)

Objectif : vérifier que l'app gère l'erreur réseau correctement, sans dépendre d'un backend en panne. On intercepte la requête avec `context.route`.

```ts
test('gère une erreur API 500 — affiche un message d'erreur réseau', async ({ page, context }) => {
  // Intercepter la route POST /api/invitations et répondre 500
  await context.route('**/api/invitations', route =>
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'INTERNAL' }) })
  )

  await page.goto('/invitations/new')
  await page.getByLabel('Adresse email').fill('bob@tribu.fr')
  await page.getByRole('button', { name: /inviter/i }).click()

  // L'app doit afficher une erreur compréhensible
  await expect(page.getByRole('alert')).toContainText(/erreur serveur/i)

  // Le bouton est à nouveau actif (pas de loading infini)
  await expect(page.getByRole('button', { name: /inviter/i })).toBeEnabled()
})
```

Pas-à-pas : (1) `context.route` intercepte au niveau du `BrowserContext` de ce test uniquement — isolation totale ; (2) `route.fulfill` simule la réponse serveur sans démarrer un vrai backend en erreur ; (3) on vérifie deux invariants UX : message d'erreur + bouton réactivé.

## 4. Pièges & misconceptions

- **Sélecteurs CSS fragiles.** Écrire `page.locator('.invitation-item:nth-child(2)')` couple le test à l'implémentation CSS. Un refactor du markup (div → li, ajout d'une classe) casse le test sans régression réelle. *Correct* : `page.getByRole('listitem', { name: /sophie/ })` cible la sémantique, pas la structure.

- **`waitForTimeout` comme béquille.** `await page.waitForTimeout(2000)` est un sleep aveugle : trop court sur une machine lente = flaky ; trop long = tests qui traînent. *Correct* : identifier l'état observable attendu et l'exprimer avec une assertion web-first (`toBeVisible`, `toHaveCount`) ou un `waitFor({ state: 'hidden' })`.

- **Tests dépendants (state partagé).** Si le test B suppose que le test A a créé un utilisateur, et que A est sauté ou exécuté en parallèle, B échoue aléatoirement. *Correct* : chaque test est autosuffisant (crée ses données en `beforeEach` ou via API), grâce à l'isolation des fixtures `page`/`context`.

- **Confondre locator et snapshot.** `const el = page.getByRole('button', { name: /inviter/i })` ne cherche pas l'élément — c'est une recette différée. L'élément est recherché seulement lors de `.click()` ou `expect(el).toBeVisible()`. Écrire `expect(el).toBeTruthy()` est inutile et ne prouve rien (el est toujours un objet Locator).

- **`getByText` pour cibler les boutons.** `page.getByText('Inviter')` sélectionne n'importe quel élément portant ce texte (span, div, p…). Un bouton trouvé par `getByText` n'est pas prouvé être un `<button>` cliquable. *Correct* : `getByRole('button', { name: /inviter/i })` cible un élément avec `role=button`, ce qui garantit l'actionabilité ARIA.

- **`trace: 'on'` en local dans la config.** Activer la trace en permanence ralentit chaque test de 10-30 %. *Correct* : `'on-first-retry'` en CI (trace uniquement sur l'échec) et `--trace on` ponctuellement en local pour déboguer.

## 5. Ancrage TribuZen

Couche fil-rouge : **test E2E du parcours d'invitation TribuZen** (`smaurier/tribuzen`). Ce module couvre exactement le flux critique du produit :

- Le formulaire `/invitations/new` (champ email + bouton "Inviter") doit avoir des labels accessibles — `getByLabel` et `getByRole` valident cela automatiquement. C'est un point de contrôle RGAA 4.1 (formulaires).
- L'assertion `toBeVisible()` sur le `listitem` avec le nom de l'invité prouve que la réponse API est traitée et le composant réactif mis à jour — sans jamais consulter la base de données directement dans le test.
- L'interception `context.route('**/api/invitations', ...)` permet de tester les cas d'erreur (500, timeout) sans polluer la base de données de test ou dépendre d'un serveur instable.
- Ces tests E2E complètent les tests Vitest du module 04 (logique domaine, isolation) et les tests d'intégration du module 09 (API + base) : la pyramide est complète.

En session TribuZen, on écrit `e2e/invitation.spec.ts` dans le vrai repo, on configure `playwright.config.ts` avec `webServer: { command: 'npm run dev', ... }`, et on valide avec `npx playwright test --project=chromium`.

## 6. Points clés

1. `playwright.config.ts` centralise `baseURL`, `webServer`, `retries`, `trace` et les `projects` (navigateurs).
2. Les locators (`getByRole`, `getByLabel`) sont des recettes différées — l'élément est cherché à l'action ou à l'assertion, pas à la déclaration.
3. `getByRole` est le locator prioritaire : il cible la sémantique ARIA, force l'accessibilité, et double comme contrôle RGAA partiel.
4. `getByLabel` cible les champs formulaire via leur `<label>` — garantit que le label existe et est correctement associé.
5. Les assertions web-first (`expect(locator).toBeVisible()`) réessaient jusqu'au timeout (5 s par défaut) — elles remplacent les `waitForTimeout`.
6. L'auto-waiting s'applique aux actions (`click`, `fill`) : Playwright vérifie attached + visible + stable + enabled + receives-events avant d'agir.
7. Chaque test reçoit un `page` dans un `BrowserContext` isolé — cookies, sessions et storage ne fuient pas.
8. `trace: 'on-first-retry'` active la trace en CI ; `npx playwright show-report` ouvre le Trace Viewer.
9. `context.route` intercepte les requêtes réseau dans l'isolation du test — utile pour simuler erreurs 500 sans changer le backend.

## 7. Seeds Anki

```
Pourquoi préférer getByRole à un sélecteur CSS ?|getByRole cible la sémantique ARIA (role + nom accessible) — résistant aux refactors CSS, et double comme contrôle d'accessibilité RGAA partiel
Que fait expect(locator).toBeVisible() que expect(val).toBe(true) ne fait pas ?|C'est une assertion web-first : elle réessaie activement jusqu'au timeout (5 s par défaut) au lieu d'échouer immédiatement — remplace les waitForTimeout
Qu'est-ce qu'un locator Playwright ?|Une recette de sélection différée — l'élément est cherché seulement lors de l'action ou de l'assertion, pas à la déclaration
Comment isoler deux tests E2E qui ne doivent pas partager de session ?|Chaque test reçoit automatiquement un BrowserContext isolé via la fixture page — cookies, localStorage et sessions sont vierges pour chaque test
Pourquoi ne pas écrire waitForTimeout dans un test Playwright ?|C'est un sleep aveugle (trop court = flaky, trop long = lent) — identifier l'état observable et l'exprimer avec une assertion web-first ou waitFor({ state })
Quelle config trace recommander en CI ?|trace: 'on-first-retry' — enregistre la trace seulement sur le premier retry d'un test en échec, sans coût permanent
Comment simuler une erreur 500 d'API dans un test sans toucher le backend ?|context.route('**/api/endpoint', route => route.fulfill({ status: 500, body: '...' })) — l'interception est isolée au BrowserContext du test
À quoi sert getByLabel pour le RGAA ?|Il cible l'input via son <label> associé — si le test passe, le label existe et est correctement lié à son champ (critère d'accessibilité formulaires)
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-10-playwright-fondamentaux/`. Tu y écris les tests E2E du parcours d'invitation TribuZen en **`@playwright/test` réel** — formulaire, soumission, vérification de la liste, cas d'erreur et interception réseau. Corrigé complet commenté + variante J+30 dans le README du lab.
