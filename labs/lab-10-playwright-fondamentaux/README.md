# Lab 10 — Playwright fondamentaux

> **Outcome :** à la fin, tu sais écrire des tests E2E qui pilotent un vrai navigateur Chromium, ciblent les éléments par rôle accessible, utilisent les assertions web-first, et interceptent le réseau — le tout sur le parcours d'invitation TribuZen.
> **Vrai outil :** `@playwright/test` (navigateur Chromium réel). Aucun harnais simulé, aucun gap-fill.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

On part de l'application TribuZen avec la page d'invitation déjà existante (`/invitations/new`). Tu ne touches pas au code de l'app — tu écris uniquement les tests E2E.

**Interface cible (markup HTML déjà en place) :**

```html
<!-- /invitations/new -->
<h1>Inviter un membre</h1>
<form>
  <label for="email">Adresse email</label>
  <input id="email" type="email" name="email" />
  <button type="submit">Inviter</button>
</form>

<!-- Après soumission réussie, dans /invitations -->
<ul aria-label="Membres invités">
  <li aria-label="sophie@tribu.fr">sophie@tribu.fr — En attente</li>
</ul>
```

Ta mission : écrire `e2e/invitation.spec.ts` qui couvre le flux nominal, l'erreur de validation, le doublon, et la panne API — **sans `waitForTimeout`, sans sélecteurs CSS fragiles**.

## Étapes (en friction)

1. **Configurer `playwright.config.ts`.** Crée ou complète la config avec `baseURL: 'http://localhost:3000'`, `trace: 'on-first-retry'`, `webServer: { command: 'npm run dev', url: '...', reuseExistingServer: !process.env.CI }`. Vérifie avec `npx playwright test --list`.

2. **Test nominal.** Écris un test qui ouvre `/invitations/new`, remplit le champ `getByLabel('Adresse email')`, clique `getByRole('button', { name: /inviter/i })`, et vérifie que `getByRole('listitem', { name: /sophie@tribu\.fr/ })` devient `toBeVisible()`. **N'utilise aucun `waitForTimeout`.**

3. **Email invalide.** Saisis `pas-un-email`, soumet, et assert que `getByRole('alert')` contient `/email invalide/i` et que l'URL reste `/invitations/new`. Vérifie aussi que la valeur du champ est conservée (`toHaveValue`).

4. **Doublon.** Invite `alice@tribu.fr` une première fois (flux nominal), puis retente avec le même email et assert que l'alerte contient `/déjà invité/i`.

5. **Interception réseau (panne API).** Utilise `context.route('**/api/invitations', ...)` pour simuler une réponse `500`. Vérifie que l'alerte affiche `/erreur serveur/i` et que le bouton est à nouveau `toBeEnabled()` (pas de loading infini).

6. **Discipline : pas de CSS ni de sleeps.** Relis tes tests — chaque `locator` doit utiliser `getByRole`, `getByLabel`, `getByText` ou `getByRole+filter`. Aucun `waitForTimeout`, aucun `.locator('.class')` isolé.

## Corrigé complet commenté

**`playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    // trace uniquement sur le premier retry d'un échec — économise les ressources CI
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // en local, réutilise le serveur déjà démarré si disponible
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

**`e2e/invitation.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Parcours invitation TribuZen', () => {

  // Chaque test reçoit un BrowserContext isolé via la fixture "page" :
  // cookies, session, localStorage sont vierges — aucun état partagé.

  test('flux nominal — le membre invité apparaît dans la liste', async ({ page }) => {
    // goto utilise baseURL de la config — chemin relatif uniquement
    await page.goto('/invitations/new')

    // Vérifier que la page d'invitation est chargée (assertion web-first)
    await expect(page.getByRole('heading', { name: /inviter un membre/i })).toBeVisible()

    // getByLabel cible l'<input> via son <label id="email"> — garantit l'accessibilité
    await page.getByLabel('Adresse email').fill('sophie@tribu.fr')

    // getByRole('button') garantit un vrai bouton sémantique, pas un div.btn
    await page.getByRole('button', { name: /inviter/i }).click()

    // toBeVisible() réessaie jusqu'à 5 s — pas de waitForTimeout
    // L'app fait une requête POST /api/invitations et met à jour la liste
    await expect(
      page.getByRole('listitem', { name: /sophie@tribu\.fr/i })
    ).toBeVisible()
  })

  test('email invalide — alerte visible, URL inchangée, valeur conservée', async ({ page }) => {
    await page.goto('/invitations/new')

    await page.getByLabel('Adresse email').fill('pas-un-email')
    await page.getByRole('button', { name: /inviter/i }).click()

    // L'alerte doit apparaître (role=alert = annonce immédiate aux lecteurs d'écran)
    await expect(page.getByRole('alert')).toContainText(/email invalide/i)

    // L'utilisateur reste sur le formulaire
    await expect(page).toHaveURL('/invitations/new')

    // UX : la valeur saisie est conservée pour que l'utilisateur puisse la corriger
    await expect(page.getByLabel('Adresse email')).toHaveValue('pas-un-email')
  })

  test('doublon — alerte "déjà invité", pas de duplication dans la liste', async ({ page }) => {
    await page.goto('/invitations/new')

    // Premier envoi (nominal) — alice@tribu.fr doit apparaître
    await page.getByLabel('Adresse email').fill('alice@tribu.fr')
    await page.getByRole('button', { name: /inviter/i }).click()
    await expect(page.getByRole('listitem', { name: /alice@tribu\.fr/i })).toBeVisible()

    // Retour au formulaire pour tenter le doublon
    await page.getByRole('link', { name: /inviter un autre/i }).click()
    await expect(page).toHaveURL('/invitations/new')

    // Second envoi avec le même email
    await page.getByLabel('Adresse email').fill('alice@tribu.fr')
    await page.getByRole('button', { name: /inviter/i }).click()

    // L'API doit rejeter le doublon
    await expect(page.getByRole('alert')).toContainText(/déjà invité/i)

    // Un seul listitem alice — pas de duplication
    await expect(page.getByRole('listitem', { name: /alice@tribu\.fr/i })).toHaveCount(1)
  })

  test('panne API 500 — alerte erreur serveur, bouton réactivé', async ({ page, context }) => {
    // context.route intercepte les requêtes dans ce BrowserContext uniquement
    // Les autres tests ne sont pas affectés
    await context.route('**/api/invitations', route =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'INTERNAL_SERVER_ERROR' }),
      })
    )

    await page.goto('/invitations/new')
    await page.getByLabel('Adresse email').fill('bob@tribu.fr')
    await page.getByRole('button', { name: /inviter/i }).click()

    // L'app doit afficher un message compréhensible (pas "500 Internal Server Error")
    await expect(page.getByRole('alert')).toContainText(/erreur serveur/i)

    // Le bouton doit être réactivé — pas de loading infini
    await expect(page.getByRole('button', { name: /inviter/i })).toBeEnabled()

    // Aucun listitem ne doit avoir été créé (l'API a rejeté)
    await expect(page.getByRole('listitem')).toHaveCount(0)
  })

})
```

Points de validation par le coach :
- (a) aucun `waitForTimeout` — toutes les attentes sont des assertions web-first ou des `waitFor` sémantiques ;
- (b) tous les locators utilisent `getByRole`, `getByLabel` ou `getByText` — aucun `.locator('.css')` isolé ;
- (c) le test doublon prouve l'absence de duplication via `toHaveCount(1)` ;
- (d) l'interception réseau est scoped au `context` du test — les autres tests ne sont pas affectés ;
- (e) `npx playwright show-report` après un échec affiche la trace avec screenshots par étape.

## Variante J+30 (fading)

Reprends **sans relire le corrigé**, en 25 min, avec cette contrainte ajoutée : le formulaire d'invitation a désormais deux étapes. Étape 1 — saisir l'email et cliquer "Suivant" ; étape 2 — saisir un message personnel optionnel et cliquer "Inviter". Écris les tests pour le flux nominal deux étapes, pour la validation email à l'étape 1, et pour un retour à l'étape 1 depuis l'étape 2 (bouton "Retour"). Contrainte : le heading de l'étape courante change entre les deux étapes — utilise-le pour vérifier la progression (`getByRole('heading')`). Aucun `getByTestId`.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `playwright.config.ts` à la racine avec `webServer: { command: 'npm run dev', ... }` et le projet `chromium`.
2. Crée `e2e/invitation.spec.ts` avec les 4 tests ci-dessus adaptés aux vraies routes et vrais labels du formulaire TribuZen.
3. Vérifie que les labels HTML de `/invitations/new` permettent `getByLabel('Adresse email')` — si ce n'est pas le cas, ajouter le `<label for="...">` est un fix RGAA autant qu'un fix de testabilité.
4. Lance `npx playwright test --project=chromium` et corrige les sélecteurs si nécessaire.
5. Commit `smaurier/tribuzen` : `test(e2e): parcours invitation Playwright — flux nominal, validation, doublon, panne API`.
