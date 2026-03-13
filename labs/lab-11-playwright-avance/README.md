# Lab 11 — Playwright avance

## Objectifs

Apprendre les patterns avances de test E2E : Page Object Model, fixtures, interception reseau, comparaison de screenshots, tagging et un scenario POM complet.

## Concepts cles

- Page Object Model (POM) : BasePage, LoginPage, DashboardPage
- Fixtures : contexte d'authentification, donnees de test
- Interception reseau : intercepter et mocker les reponses
- Comparaison de screenshots : capturer et comparer les etats
- Tagging : @smoke, @regression pour filtrer les tests
- Scenario POM complet : LoginPage -> DashboardPage -> CRUD

## Exercices

### Exercice 1 : Page Object Model
Implementez `BasePage`, `LoginPage` et `DashboardPage` avec des methodes metier.

### Exercice 2 : Fixtures
Creez `createAuthContext` et `createTestData` pour preparer les tests.

### Exercice 3 : Network interception
Implementez `interceptRoute(url, response)` pour mocker les appels reseau.

### Exercice 4 : Screenshot comparison
Implementez `captureState()` et `assertUnchanged()` pour verifier les etats visuels.

### Exercice 5 : Test tagging
Implementez un systeme de tags (@smoke, @regression) pour filtrer les tests.

### Exercice 6 : POM complet
Scenario LoginPage -> DashboardPage avec create/edit/delete.

## Lancer le lab

```bash
npx tsx labs/lab-11-playwright-avance/exercise.ts
npx tsx labs/lab-11-playwright-avance/solution.ts
```
