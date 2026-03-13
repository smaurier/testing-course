# Screencast 15 — TDD et BDD

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/15-tdd-et-bdd.md`
- **Lab associe** : Lab 15
- **Prerequis** : Screencast 14

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert en watch mode (`npx vitest`)
- [ ] Fichier `modules/15-tdd-et-bdd.md` ouvert
- [ ] Aucun fichier pre-existant pour le kata

## Script

### [00:00-02:00] Introduction — TDD, le cycle Red-Green-Refactor

> TDD inverse le workflow habituel : au lieu d'ecrire le code puis le test, on ecrit le test PUIS le code. Le cycle se repete en 3 etapes : Red (test qui echoue), Green (code minimal pour passer), Refactor (ameliorer sans changer le comportement).

**Action** : Afficher le cycle.

```
     ┌──────────┐
     │   RED    │  1. Ecrire un test qui echoue
     │  (fail)  │
     └────┬─────┘
          │
     ┌────▼─────┐
     │  GREEN   │  2. Ecrire le minimum de code pour passer
     │  (pass)  │
     └────┬─────┘
          │
     ┌────▼─────┐
     │ REFACTOR │  3. Ameliorer le code sans changer le comportement
     │  (pass)  │
     └────┬─────┘
          │
          └──────── Repeter
```

### [02:00-10:00] Kata TDD — StringCalculator

> Faisons un kata TDD complet. On va implementer un StringCalculator pas a pas, en suivant strictement Red-Green-Refactor.

**Action** : Creer `src/string-calculator.test.ts` et `src/string-calculator.ts`.

```typescript
// ITERATION 1 — RED : chaine vide retourne 0
it('should return 0 for empty string', () => {
  expect(add('')).toBe(0);
});
```

```typescript
// ITERATION 1 — GREEN : implementation minimale
export function add(input: string): number {
  return 0;
}
```

```typescript
// ITERATION 2 — RED : un seul nombre
it('should return the number for a single number', () => {
  expect(add('5')).toBe(5);
});

// GREEN
export function add(input: string): number {
  if (input === '') return 0;
  return Number(input);
}
```

```typescript
// ITERATION 3 — RED : deux nombres separes par virgule
it('should sum two comma-separated numbers', () => {
  expect(add('1,2')).toBe(3);
});

// GREEN
export function add(input: string): number {
  if (input === '') return 0;
  return input.split(',').reduce((sum, n) => sum + Number(n), 0);
}
```

```typescript
// ITERATION 4 — RED : retour a la ligne comme separateur
it('should handle newline as separator', () => {
  expect(add('1\n2,3')).toBe(6);
});

// GREEN
export function add(input: string): number {
  if (input === '') return 0;
  return input.split(/[,\n]/).reduce((sum, n) => sum + Number(n), 0);
}
```

```typescript
// ITERATION 5 — RED : nombres negatifs interdits
it('should throw for negative numbers', () => {
  expect(() => add('-1,2,-3')).toThrow('Negatives not allowed: -1, -3');
});

// GREEN
export function add(input: string): number {
  if (input === '') return 0;
  const numbers = input.split(/[,\n]/).map(Number);
  const negatives = numbers.filter(n => n < 0);
  if (negatives.length > 0) {
    throw new Error(`Negatives not allowed: ${negatives.join(', ')}`);
  }
  return numbers.reduce((sum, n) => sum + n, 0);
}
```

> A chaque iteration, on ajoute UN test, on ecrit le MINIMUM de code pour le faire passer, puis on refactore si necessaire. Le watch mode de Vitest donne un feedback instantane.

### [10:00-13:00] BDD — Given-When-Then et Cucumber

> BDD exprime les specifications en langage naturel. Le format Given-When-Then est lisible par les non-developpeurs.

**Action** : Ecrire un fichier Gherkin.

```gherkin
# features/login.feature
Feature: Authentication
  As a registered user
  I want to log in
  So that I can access my tasks

  Scenario: Successful login
    Given I am on the login page
    When I enter "alice@test.com" as email
    And I enter "password123" as password
    And I click the "Se connecter" button
    Then I should be redirected to "/tasks"
    And I should see "Bienvenue, Alice"

  Scenario: Failed login
    Given I am on the login page
    When I enter "alice@test.com" as email
    And I enter "wrong-password" as password
    And I click the "Se connecter" button
    Then I should see an error "Identifiants invalides"
```

**Action** : Implementer les steps.

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Given('I am on the login page', async function () {
  await this.page.goto('/login');
});

When('I enter {string} as email', async function (email: string) {
  await this.page.getByLabel('Email').fill(email);
});

When('I enter {string} as password', async function (password: string) {
  await this.page.getByLabel('Mot de passe').fill(password);
});

When('I click the {string} button', async function (name: string) {
  await this.page.getByRole('button', { name }).click();
});

Then('I should be redirected to {string}', async function (url: string) {
  await expect(this.page).toHaveURL(url);
});

Then('I should see {string}', async function (text: string) {
  await expect(this.page.getByText(text)).toBeVisible();
});
```

### [13:00-15:30] TDD vs BDD vs ATDD — Quand utiliser quoi ?

**Action** : Afficher la comparaison.

```
METHODE | QUI ECRIT      | FORMAT            | QUAND L'UTILISER
--------|----------------|-------------------|----------------------------------
TDD     | Developpeur    | Code (test)       | Logique metier, algorithmes
BDD     | Dev + PO       | Gherkin (Given...) | Features utilisateur, specs partagees
ATDD    | Equipe entiere | Criteres d'accept. | Sprint planning, definition de done

TDD : "Le code fait-il ce qu'il doit faire ?"
BDD : "L'utilisateur obtient-il le resultat attendu ?"
ATDD : "Sommes-nous d'accord sur ce qui est fini ?"
```

### [15:30-17:30] Outside-in vs Inside-out TDD

**Action** : Expliquer les deux approches.

```
INSIDE-OUT (Chicago school)           OUTSIDE-IN (London school)
━━━━━━━━━━━━━━━━━━━━━━━━━            ━━━━━━━━━━━━━━━━━━━━━━━━━
Commencer par les fonctions pures     Commencer par le test E2E/integration
Remonter vers les services            Descendre vers les unites
Pas/peu de mocks                      Mocks pour les couches inferieures
Design emerge naturellement           Design guide par l'interface

Ideal pour : algorithmes,             Ideal pour : features UI,
logique metier complexe               flux utilisateur, APIs
```

### [17:30-19:00] Recapitulatif

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. TDD = Red → Green → Refactor (un test a la fois)
2. Le kata StringCalculator illustre le workflow complet
3. BDD = Given-When-Then en langage naturel (Gherkin + Cucumber)
4. TDD pour la logique, BDD pour les specs partagees
5. Inside-out pour les algorithmes, outside-in pour les features
6. Le watch mode est essentiel pour le TDD (feedback instantane)

PROCHAINE ETAPE :
→ Screencast 16 : Contract testing
```

## Points d'attention pour l'enregistrement
- Le kata TDD DOIT etre fait en live, iteration par iteration
- Le watch mode de Vitest en split screen est ideal pour montrer Red → Green
- Chaque iteration doit etre petite — resister a la tentation d'ecrire trop de code
- Le Gherkin est nouveau pour beaucoup — bien montrer la lisibilite
