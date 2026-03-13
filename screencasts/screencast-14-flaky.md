# Screencast 14 — Flaky tests et debugging

## Informations
- **Duree estimee** : 15-18 min
- **Module** : `modules/14-flaky-tests-et-debugging.md`
- **Lab associe** : Lab 14
- **Prerequis** : Screencast 13

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Projet de demo avec des exemples de tests flaky prepares
- [ ] Fichier `modules/14-flaky-tests-et-debugging.md` ouvert

## Script

### [00:00-02:00] Introduction — Qu'est-ce qu'un test flaky ?

> Un test flaky est un test qui produit des resultats differents sans changement de code. Il passe parfois, echoue parfois. C'est le pire ennemi d'une suite de tests car il detruit la confiance.

**Action** : Afficher l'impact.

```
IMPACT DES FLAKY TESTS :
━━━━━━━━━━━━━━━━━━━━━━━━
Confiance   → L'equipe ignore les echecs CI ("c'est juste un flaky")
Vitesse     → Re-runs inutiles, temps perdu a investiguer
Qualite     → De vrais bugs masques par le bruit
Moral       → Frustration, perte de confiance dans la suite
Cout        → Chaque re-run consomme des minutes CI (= argent)
```

### [02:00-06:00] Les 5 causes racines

**Action** : Passer en revue chaque cause avec un exemple.

```typescript
// CAUSE 1 : Dependance au temps
it('should expire after 1 second', async () => {
  const token = createToken({ expiresIn: 1000 });
  await new Promise(r => setTimeout(r, 1000)); // timing variable
  expect(token.isExpired()).toBe(true); // FLAKY !
});
// FIX : vi.useFakeTimers()

// CAUSE 2 : Ordre d'execution
let counter = 0;
it('first test', () => { counter++; expect(counter).toBe(1); });
it('second test', () => { counter++; expect(counter).toBe(2); });
// FLAKY si les tests s'executent en parallele ou dans un autre ordre
// FIX : pas de variable partagee entre tests

// CAUSE 3 : Etat global (DB, fichiers, singletons)
it('should create user', async () => {
  await db.insert({ email: 'alice@test.com' });
  // FLAKY si un autre test a deja insere alice@test.com
});
// FIX : cleanup dans beforeEach ou DB in-memory

// CAUSE 4 : Conditions de course reseau
it('should load data', async () => {
  render(DataList);
  expect(screen.getByText('Alice')).toBeVisible(); // FLAKY !
});
// FIX : await findByText('Alice') — attendre le rendu async

// CAUSE 5 : Animations et transitions CSS
it('should show modal', async () => {
  await page.click('button');
  await expect(page.locator('.modal')).toBeVisible(); // FLAKY si animation
});
// FIX : desactiver les animations en test ou attendre la fin
```

### [06:00-09:00] Outils de debugging — Vitest UI et Trace Viewer

**Action** : Demontrer le debugging avec Vitest UI.

```bash
# Lancer Vitest en mode UI pour inspecter un test flaky
npx vitest --ui

# Re-executer un test specifique N fois pour reproduire le flaky
npx vitest run --reporter=verbose --retry 10 src/flaky.test.ts
```

**Action** : Demontrer le Trace Viewer pour les tests Playwright.

```bash
# Activer le trace pour chaque test
npx playwright test --trace on

# Ouvrir le trace d'un test echoue
npx playwright show-trace test-results/flaky-test/trace.zip
```

> Le trace viewer montre chaque action avec un screenshot avant/apres. On peut voir exactement ce qui etait affiche au moment de l'echec, les requetes reseau, les logs console. C'est comme une camera de surveillance pour les tests.

### [09:00-12:00] Patterns de correction eprouves

**Action** : Montrer les fixes pour chaque categorie.

```typescript
// PATTERN 1 : Fake timers pour les problemes de temps
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('should expire token', () => {
  const token = createToken({ expiresIn: 1000 });
  vi.advanceTimersByTime(1001);
  expect(token.isExpired()).toBe(true); // Deterministe !
});

// PATTERN 2 : waitFor pour les rendus asynchrones
it('should load data', async () => {
  render(DataList);
  // Attend jusqu'a 5s avec retry automatique
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeVisible();
  });
});

// PATTERN 3 : Isolation complete avec factory
it('should create user with unique email', async () => {
  const email = `user-${crypto.randomUUID()}@test.com`;
  const user = await createUser({ email });
  expect(user.email).toBe(email);
});

// PATTERN 4 : Desactiver les animations en Playwright
// playwright.config.ts
export default defineConfig({
  use: {
    // Desactiver toutes les animations CSS
    launchOptions: {
      args: ['--force-prefers-reduced-motion'],
    },
  },
});
```

### [12:00-14:30] Prevention systematique — Le checklist anti-flaky

**Action** : Afficher le checklist.

```
CHECKLIST ANTI-FLAKY :
━━━━━━━━━━━━━━━━━━━━━
□ Chaque test est independant (pas de variable partagee)
□ Fake timers pour tout ce qui depend du temps
□ waitFor / findBy pour les rendus asynchrones
□ Donnees uniques par test (UUID dans les emails, IDs)
□ Cleanup dans afterEach (DB, DOM, mocks)
□ Animations desactivees en test
□ Pas de sleep() ou setTimeout() dans les tests
□ onUnhandledRequest: 'error' dans MSW
□ Retry en CI (mais investiguer la cause root)
□ Quarantine pour les flaky chroniques
```

### [14:30-16:00] Diagnostiquer un flaky en 5 etapes

**Action** : Afficher la methode de diagnostic.

```
ETAPE 1 : Reproduire
→ npx vitest run --retry 50 src/suspect.test.ts
→ npx playwright test --repeat-each 20 e2e/suspect.spec.ts

ETAPE 2 : Isoler
→ Executer le test SEUL (it.only) puis avec les AUTRES
→ Si flaky seul → timing/reseau. Si flaky avec les autres → etat partage

ETAPE 3 : Instrumenter
→ Ajouter des console.log aux points cles
→ Activer le trace Playwright
→ Verifier les logs reseau (MSW unhandled requests)

ETAPE 4 : Classifier
→ Temps ? Etat ? Ordre ? Reseau ? Animation ?
→ Appliquer le pattern de correction correspondant

ETAPE 5 : Verifier
→ Re-executer 50+ fois apres le fix
→ Monitorer en CI pendant 1 semaine
```

### [16:00-17:30] Recapitulatif

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Flaky = test qui passe/echoue sans changement de code
2. 5 causes : temps, ordre, etat global, reseau, animations
3. Fake timers, waitFor, UUID, cleanup, desactiver animations
4. Trace Viewer = camera de surveillance pour les tests E2E
5. Reproduire → Isoler → Instrumenter → Classifier → Verifier
6. Un flaky non-corrige detruit la confiance de toute l'equipe

PROCHAINE ETAPE :
→ Screencast 15 : TDD et BDD
```

## Points d'attention pour l'enregistrement
- Les 5 causes avec exemples de code sont le coeur — bien detailler chacune
- Le trace viewer est visuellement tres parlant — montrer un vrai trace
- Le checklist anti-flaky est un reference a garder — l'afficher en plein ecran
- Montrer un vrai flaky reproduit avec --retry 50 si possible
