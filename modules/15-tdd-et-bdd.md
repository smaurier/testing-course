# Module 15 — TDD et BDD

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 4/5        | 120 min       | [Lab 15](../labs/lab-15-tdd-bdd/) | [Quiz 15](../quizzes/quiz-15-tdd-bdd.html) |

## Objectifs

- Comprendre et pratiquer le cycle TDD Red-Green-Refactor
- Ancrer le réflexe RED — écrire les tests toi-même avant tout
- Utiliser TDD comme mécanisme de contrôle du code généré par IA
- Savoir quand TDD est benefique et quand il l'est moins
- Realiser un kata TDD complet (StringCalculator) from scratch
- Écrire des spécifications BDD en Given-When-Then
- Configurer Cucumber.js avec TypeScript
- Comparer TDD, BDD et ATDD
- Choisir entre Outside-in et Inside-out TDD

> **Analogie** : Le TDD, c'est écrire la recette AVANT de cuisiner. Tu décris d'abord le goût attendu (le test), puis tu cuisines (le code), puis tu goûtes (tu lances le test). Si le goût ne correspond pas, tu ajustes la recette. Le BDD, c'est quand le client écrit la recette dans sa langue ("En tant que convive, je veux un plat salé").

---

## TDD : Test-Driven Development

### Le cycle Red-Green-Refactor

```
     ┌──────────┐
     │   RED    │  1. Ecrire un test qui echoue  ← LA phase à ancrer
     │  (fail)  │
     └────┬─────┘
          │
     ┌────▼─────┐
     │  GREEN   │  2. Ecrire le minimum de code pour passer
     │  (pass)  │
     └────┬─────┘
          │
     ┌────▼─────┐
     │ REFACTOR │  3. Ameliorer le code sans casser les tests
     │ (clean)  │
     └────┬─────┘
          │
          └──────────► Retour a RED
```

### Les 3 lois du TDD (Robert C. Martin)

1. **Ne pas écrire de code de production** tant qu'il n'y a pas un test qui echoue
2. **Ne pas écrire plus de test** qu'il n'en faut pour echouer (un assert suffit)
3. **Ne pas écrire plus de code** qu'il n'en faut pour passer le test

### Exemple minimal

```typescript
// RED — le test echoue (la fonction n'existe pas)
import { describe, it, expect } from 'vitest';
import { add } from './math';

describe('add', () => {
  it('should return 0 for empty arguments', () => {
    expect(add()).toBe(0);
  });
});
```

```typescript
// GREEN — le minimum pour passer
// src/math.ts
export function add(): number {
  return 0;
}
```

```typescript
// RED — nouveau test
it('should return the number itself for a single argument', () => {
  expect(add(5)).toBe(5);
});
```

```typescript
// GREEN — evoluer le code
export function add(...numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers[0];
}
```

```typescript
// RED — encore un test
it('should return the sum of two numbers', () => {
  expect(add(2, 3)).toBe(5);
});
```

```typescript
// GREEN — generaliser
export function add(...numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + n, 0);
}

// REFACTOR — le code est deja propre, on passe au prochain test
```

---

## La phase RED — le réflexe fondamental

> C'est la phase que les labs classiques ne t'entrainent pas à faire. Dans la plupart des exercices, les tests sont déjà écrits — tu implémentes pour les passer. C'est utile, mais ce n'est pas le réflexe TDD. Le réflexe TDD, c'est **toi** qui écris le test avant d'avoir une seule ligne d'implémentation.

### Pourquoi c'est difficile à ancrer

Tu as l'habitude de penser : "qu'est-ce que mon code doit faire ?" et d'implémenter immédiatement. TDD te force à une question différente : "comment est-ce que je saurais que mon code fait ce qu'il doit faire ?" Ces deux questions produisent des designs très différents.

Quand tu écris le test en premier :
- tu definis l'interface publique avant l'implémentation (noms de méthodes, paramètres, retours)
- tu forces une décision sur les cas limites avant de coder
- tu identifies les dépendances à injecter plutôt qu'à instancier en dur

### Le protocole RED strict

Pour chaque nouvelle fonctionnalité, dans cet ordre — sans exception :

```
1. Écris une phrase : "ce code doit [comportement]"
2. Traduis cette phrase en assertion : expect(code).toBe(résultat)
3. Lance → doit être ROUGE (si vert, le test ne test rien)
4. Écris le minimum de code pour passer
5. Lance → doit être VERT
6. Refactor si nécessaire, relance → doit rester VERT
7. Retour à 1
```

### Ce que "minimum de code" veut dire vraiment

C'est contre-intuitif. Pour `expect(calculate('')).toBe(0)`, le code minimal est :

```typescript
export function calculate(_input: string): number {
  return 0; // toujours 0
}
```

Pas `if (input === '') return 0; else return parseFloat(input)`. Ça, c'est anticiper le prochain test. L'implémentation générale émerge des tests successifs — tu ne la prévois pas.

---

## Kata TDD : StringCalculator — pratique RED phase

> **Instructions** : lis chaque étape, **ferme le module**, écris le test toi-même, lance, implémente. Reviens ici seulement pour l'étape suivante — pas pour la solution.

Le kata est présenté sous forme d'exigences successives. Chaque exigence = un nouveau test à écrire.

### Setup

```bash
# Crée un fichier vide — PAS de tests pré-écrits
touch labs/lab-15-tdd-bdd/kata-stringcalculator.ts
```

Structure de départ :

```typescript
import { createTestRunner } from '../test-utils.ts';

const { test, assertEqual, assertThrows, run } = createTestRunner('StringCalculator kata');

// --- TES TESTS ICI ---

run();
```

---

### Exigence 1 — chaine vide retourne 0

> `calculate('')` → `0`

Ferme le module. Écris le test. Lance. Implémente. Lance. ✓ Reviens.

<details>
<summary>Test attendu</summary>

```typescript
await test('empty string returns 0', () => {
  assertEqual(calculate(''), 0);
});
```

</details>

<details>
<summary>Implémentation minimale</summary>

```typescript
export function calculate(_input: string): number {
  return 0;
}
```

</details>

---

### Exigence 2 — un seul nombre

> `calculate('1')` → `1` | `calculate('5')` → `5`

Ferme. Écris le test. Lance (rouge). Implémente (minimum). Lance (vert).

<details>
<summary>Test attendu</summary>

```typescript
await test('single number returns itself', () => {
  assertEqual(calculate('1'), 1);
  assertEqual(calculate('5'), 5);
});
```

</details>

<details>
<summary>Implémentation minimale</summary>

```typescript
export function calculate(input: string): number {
  if (input === '') return 0;
  return Number(input);
}
```

</details>

---

### Exigence 3 — deux nombres séparés par une virgule

> `calculate('1,2')` → `3`

<details>
<summary>Test attendu</summary>

```typescript
await test('two comma-separated numbers returns sum', () => {
  assertEqual(calculate('1,2'), 3);
});
```

</details>

<details>
<summary>Implémentation minimale</summary>

```typescript
export function calculate(input: string): number {
  if (input === '') return 0;
  return input.split(',').map(Number).reduce((sum, n) => sum + n, 0);
}
```

</details>

---

### Exigence 4 — nombre arbitraire de valeurs

> `calculate('1,2,3,4,5')` → `15`

<details>
<summary>Test attendu</summary>

```typescript
await test('any number of values', () => {
  assertEqual(calculate('1,2,3,4,5'), 15);
});
```

</details>

<details>
<summary>Implémentation minimale</summary>

```typescript
// Le code précédent gère déjà ce cas — pas de changement.
// REFACTOR : rien à faire. C'est ça, le baby step.
```

</details>

---

### Exigence 5 — saut de ligne comme séparateur

> `calculate('1\n2,3')` → `6`

<details>
<summary>Test attendu</summary>

```typescript
await test('newline as separator', () => {
  assertEqual(calculate('1\n2,3'), 6);
});
```

</details>

<details>
<summary>Implémentation minimale</summary>

```typescript
export function calculate(input: string): number {
  if (input === '') return 0;
  return input.replace(/\n/g, ',').split(',').map(Number).reduce((sum, n) => sum + n, 0);
}
```

</details>

---

### Exigence 6 — séparateur personnalisé

> Format `//[sep]\n[nombres]` : `calculate('//;\n1;2')` → `3`

<details>
<summary>Test attendu</summary>

```typescript
await test('custom delimiter', () => {
  assertEqual(calculate('//;\n1;2'), 3);
  assertEqual(calculate('//|\n1|2|3'), 6);
});
```

</details>

<details>
<summary>Implémentation minimale</summary>

```typescript
export function calculate(input: string): number {
  if (input === '') return 0;

  let delimiter = /[,\n]/;
  let body = input;

  if (input.startsWith('//')) {
    const newlineIndex = input.indexOf('\n');
    const custom = input.substring(2, newlineIndex);
    const escaped = custom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    delimiter = new RegExp(escaped);
    body = input.substring(newlineIndex + 1);
  }

  return body.split(delimiter).map(Number).reduce((sum, n) => sum + n, 0);
}
```

</details>

---

### Exigence 7 — nombres négatifs interdits

> `calculate('1,-2,3')` → throw `'Negatives not allowed: -2'`
> `calculate('-1,-2,3')` → throw `'Negatives not allowed: -1, -2'`

<details>
<summary>Test attendu</summary>

```typescript
await test('negative numbers throw', () => {
  assertThrows(() => calculate('1,-2,3'), 'Negatives not allowed: -2');
  assertThrows(() => calculate('-1,-2,3'), 'Negatives not allowed: -1, -2');
});
```

</details>

<details>
<summary>Implémentation minimale</summary>

```typescript
// Dans calculate(), après split :
const negatives = numbers.filter(n => n < 0);
if (negatives.length > 0) {
  throw new Error(`Negatives not allowed: ${negatives.join(', ')}`);
}
```

</details>

---

### Exigence 8 — ignorer les nombres > 1000

> `calculate('2,1001')` → `2` | `calculate('1000,2')` → `1002`

<details>
<summary>Test attendu</summary>

```typescript
await test('numbers over 1000 are ignored', () => {
  assertEqual(calculate('2,1001'), 2);
  assertEqual(calculate('1000,2'), 1002);
});
```

</details>

<details>
<summary>Implémentation finale complète</summary>

```typescript
export function calculate(input: string): number {
  if (input === '') return 0;

  let delimiter = /[,\n]/;
  let body = input;

  if (input.startsWith('//')) {
    const newlineIndex = input.indexOf('\n');
    const custom = input.substring(2, newlineIndex);
    const escaped = custom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    delimiter = new RegExp(escaped);
    body = input.substring(newlineIndex + 1);
  }

  const numbers = body.split(delimiter).map(Number);

  const negatives = numbers.filter(n => n < 0);
  if (negatives.length > 0) {
    throw new Error(`Negatives not allowed: ${negatives.join(', ')}`);
  }

  return numbers.filter(n => n <= 1000).reduce((sum, n) => sum + n, 0);
}
```

</details>

---

### Bilan du kata

Après ces 8 étapes tu as écrit 8 tests toi-même, tu as implémenté incrementalement, et l'algo final a émergé des tests — pas de ta tête. C'est ça le TDD.

Observe ce qui s'est passé entre l'étape 1 et l'étape 8 : le code de l'étape 1 était faux pour l'étape 2. C'est normal. Baby steps.

---

## TDD et IA — le seul workflow qui fonctionne

> Cette section n'existe pas dans les ressources classiques sur le TDD. Elle est critique en 2026.

### Le piège du "génère-moi ça"

```
❌ Workflow délégation (le piège)

Tu → IA : "écris-moi une fonction qui valide un email"
IA → toi : 40 lignes, regex complexe, 3 cas non demandés
Tu : "looks good" → merge
```

Le problème : tu n'as jamais défini ce que "valide" signifie dans TON contexte. L'IA a fait des choix implicites que tu n'as pas contrôlés.

### Le workflow TDD+IA

```
✅ Workflow contrôle (TDD appliqué à l'IA)

1. TU écris le test (ou la liste des cas)
   expect(validateEmail('a@b.com')).toBe(true)
   expect(validateEmail('invalid')).toBe(false)
   expect(validateEmail('')).toBe(false)
   // ton contexte : est-ce que 'a@b.c' est valide ici ? → tu décides AVANT

2. TU donnes le test à l'IA comme contrainte
   "implémente validateEmail() pour que ces tests passent"

3. TU lis chaque ligne du code généré
   → une ligne qui n'est pas nécessaire pour passer un test = risque

4. TU lances les tests
   → si rouge : tu sais exactement POURQUOI
   → si vert : tu as la preuve, pas juste la confiance
```

### Règle pratique

**Avant tout prompt qui génère du code :**

```typescript
// Écris d'abord en commentaire :
// ATTENDU : validateEmail('a@b.com') → true
// ATTENDU : validateEmail('invalid') → false
// ATTENDU : validateEmail('') → false
// QUESTION : validateEmail('a@b.c') → true ou false dans ce contexte ?

// Maintenant tu peux demander à l'IA
```

Ces 3-4 lignes te forcent à avoir une opinion avant de voir ce que l'IA propose. L'écart entre ta liste et le code généré est ton terrain d'apprentissage — c'est là que tu vois où l'IA brode.

### Revue critique systématique

Pour chaque génération IA, avant d'accepter :

```
□ Identifie une ligne qui n'était pas nécessaire pour passer tes tests
□ Si elle existe : pourquoi est-elle là ? (optimisation prématurée ? cas non demandé ?)
□ Les noms de variables sont-ils du domaine métier ou des noms IA génériques ?
□ Y a-t-il de la gestion d'erreur pour des cas qui ne peuvent pas arriver ?
□ Le code exprime-t-il l'intention ou l'implémentation ?
```

### Quand TDD+IA brille particulièrement

| Situation | Ce que tu fais | Ce que l'IA fait |
|-----------|---------------|-----------------|
| Algo complexe (bowling, StringCalculator) | Écris les tests cas par cas | Implémente pour les passer |
| Feature inconnue (nouveau domaine) | Définis les contrats avec des tests | Remplit les contrats |
| Bug fix | Écris le test qui reproduit le bug d'abord | Corrige pour que le test passe |
| Refactor | Tes tests existants = filet de sécurité | Refactore sous contrainte |

---

## Quand TDD fonctionne bien

| Situation | Pourquoi TDD aide |
|-----------|-------------------|
| **Logique metier complexe** | Force a définir les regles avant le code |
| **Algorithmes** | Decompose le problème en petites étapes |
| **API design** | Le test est le premier "client" de l'API |
| **Bug fix** | Écrire le test qui reproduit le bug d'abord |
| **Code critique** | Garantit une couverture exhaustive |

## Quand TDD est moins adapte

| Situation | Pourquoi |
|-----------|----------|
| **Prototypage / exploration** | On ne sait pas encore ce qu'on construit |
| **UI visuelle** | Le rendu est difficile a exprimer en assertions |
| **Intégration système** | Les dépendances externes sont complexes a simuler |
| **Code jetable** | L'investissement ne sera pas rentabilise |
| **Refactoring massif** | Écrire les tests après est parfois plus pragmatique |

---

## BDD : Behavior-Driven Development

### De TDD a BDD

TDD se concentre sur les **unites de code**. BDD se concentre sur les **comportements metier** exprimes dans un langage naturel structure.

### Le format Given-When-Then

```gherkin
Feature: Shopping Cart
  As a customer
  I want to manage items in my cart
  So that I can purchase what I need

  Scenario: Adding an item to an empty cart
    Given an empty shopping cart
    When I add a product "Laptop" priced at 999.99 euros
    Then the cart should contain 1 item
    And the total should be 999.99 euros

  Scenario: Applying a discount code
    Given a cart with a product "Laptop" priced at 999.99 euros
    When I apply the discount code "SAVE10"
    Then the total should be 899.99 euros

  Scenario: Removing the last item
    Given a cart with a product "Mouse" priced at 29.99 euros
    When I remove the product "Mouse"
    Then the cart should be empty
    And the total should be 0 euros
```

### Avantages du format Gherkin

- **Lisible par tous** : devs, PO, QA, stakeholders
- **Documentation vivante** : les specs sont executables
- **Language ubiquitaire** : partage le vocabulaire du domaine
- **Non-technique** : le PO peut écrire les scenarios

---

## Cucumber.js avec TypeScript

### Installation

```bash
pnpm add -D @cucumber/cucumber ts-node @types/node
```

### Structure du projet

```
features/
  shopping-cart.feature     # Scenarios Gherkin
  step-definitions/
    cart.steps.ts           # Implementation des steps
  support/
    world.ts                # Contexte partage entre steps
cucumber.mjs                # Configuration
```

### Configuration

```javascript
// cucumber.mjs
export default {
  requireModule: ['ts-node/register'],
  require: ['features/step-definitions/**/*.ts', 'features/support/**/*.ts'],
  format: ['progress-bar', 'html:reports/cucumber.html'],
  publishQuiet: true,
};
```

### Le World (contexte partage)

```typescript
// features/support/world.ts
import { setWorldConstructor, World } from '@cucumber/cucumber';
import { ShoppingCart } from '../../src/shopping-cart';

export class CartWorld extends World {
  cart: ShoppingCart = new ShoppingCart();
  error: Error | null = null;
}

setWorldConstructor(CartWorld);
```

### Feature file

```gherkin
# features/shopping-cart.feature
Feature: Shopping Cart Management
  As a customer
  I want to manage items in my shopping cart
  So that I can prepare my order

  Background:
    Given a clean shopping cart

  Scenario: Add a single item
    When I add "Laptop" at 999.99 euros with quantity 1
    Then the cart should have 1 item
    And the total should be 999.99 euros

  Scenario: Add multiple items
    When I add "Laptop" at 999.99 euros with quantity 1
    And I add "Mouse" at 29.99 euros with quantity 2
    Then the cart should have 2 items
    And the total should be 1059.97 euros

  Scenario: Apply percentage discount
    Given I add "Laptop" at 999.99 euros with quantity 1
    When I apply a 10% discount
    Then the total should be 899.99 euros

  Scenario: Remove an item
    Given I add "Laptop" at 999.99 euros with quantity 1
    And I add "Mouse" at 29.99 euros with quantity 1
    When I remove "Laptop"
    Then the cart should have 1 item
    And the total should be 29.99 euros

  Scenario: Reject negative quantity
    When I try to add "Laptop" at 999.99 euros with quantity -1
    Then I should get an error "Quantity must be positive"

  Scenario Outline: Bulk pricing
    When I add "<product>" at <price> euros with quantity <qty>
    Then the total should be <total> euros

    Examples:
      | product | price  | qty | total   |
      | Widget  | 10.00  | 1   | 10.00   |
      | Widget  | 10.00  | 5   | 50.00   |
      | Widget  | 10.00  | 100 | 900.00  |
```

### Step définitions

```typescript
// features/step-definitions/cart.steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import type { CartWorld } from '../support/world';

Given('a clean shopping cart', function (this: CartWorld) {
  this.cart = new ShoppingCart();
  this.error = null;
});

When(
  'I add {string} at {float} euros with quantity {int}',
  function (this: CartWorld, name: string, price: number, quantity: number) {
    this.cart.addItem({ name, price, quantity });
  },
);

When(
  'I try to add {string} at {float} euros with quantity {int}',
  function (this: CartWorld, name: string, price: number, quantity: number) {
    try {
      this.cart.addItem({ name, price, quantity });
    } catch (e) {
      this.error = e as Error;
    }
  },
);

When('I apply a {int}% discount', function (this: CartWorld, percent: number) {
  this.cart.applyDiscount(percent / 100);
});

When('I remove {string}', function (this: CartWorld, name: string) {
  this.cart.removeItem(name);
});

Then('the cart should have {int} item(s)', function (this: CartWorld, count: number) {
  expect(this.cart.items).to.have.length(count);
});

Then('the cart should be empty', function (this: CartWorld) {
  expect(this.cart.items).to.have.length(0);
});

Then('the total should be {float} euros', function (this: CartWorld, total: number) {
  expect(this.cart.getTotal()).to.be.closeTo(total, 0.01);
});

Then('I should get an error {string}', function (this: CartWorld, message: string) {
  expect(this.error).to.not.be.null;
  expect(this.error!.message).to.equal(message);
});
```

### Lancer les tests Cucumber

```bash
pnpm cucumber-js

# Avec un tag specifique
pnpm cucumber-js --tags "@smoke"

# Avec un scenario specifique
pnpm cucumber-js --name "Add a single item"
```

---

## BDD vs TDD

| Aspect | TDD | BDD |
|--------|-----|-----|
| **Focus** | Code, unites | Comportement, metier |
| **Audience** | Développeurs | Équipe entière |
| **Language** | Code (TypeScript) | Gherkin (naturel) |
| **Granularite** | Fonction / méthode | Feature / scenario |
| **Quand** | Pendant le développement | Avant le développement (specs) |
| **Sortie** | Tests unitaires | Specs executables |
| **Overhead** | Faible | Moyen (step définitions) |

### Quand utiliser quoi ?

```
Spec metier ambigue ? ──────────────────────────► BDD
  │                                                (clarifier avec Given/When/Then)
  ▼
Logique complexe ? ─────────────────────────────► TDD
  │                                                (Red-Green-Refactor)
  ▼
Correction de bug ? ────────────────────────────► TDD
  │                                                (test du bug d'abord)
  ▼
Integration systeme ? ──────────────────────────► BDD + Integration tests
  │
  ▼
Prototypage ? ──────────────────────────────────► Ni l'un ni l'autre
                                                   (tester apres)
```

---

## Outside-in vs Inside-out TDD

### Inside-out (classique / bottom-up)

On commence par les briques de base et on monte vers les couches superieures.

```typescript
// 1. D'abord, le repository (couche basse)
describe('UserRepository', () => {
  it('should find user by id', () => {
    const repo = new UserRepository(inMemoryDb);
    repo.save({ id: '1', name: 'Alice' });
    expect(repo.findById('1')).toEqual({ id: '1', name: 'Alice' });
  });
});

// 2. Ensuite, le service (couche moyenne)
describe('UserService', () => {
  it('should get user profile', () => {
    const repo = new UserRepository(inMemoryDb);
    repo.save({ id: '1', name: 'Alice', email: 'alice@test.com' });

    const service = new UserService(repo);
    const profile = service.getProfile('1');

    expect(profile.displayName).toBe('Alice');
  });
});

// 3. Enfin, le controller (couche haute)
describe('UserController', () => {
  it('should return 200 with user profile', async () => {
    const response = await request(app).get('/users/1');
    expect(response.status).toBe(200);
  });
});
```

**Avantages** : pas de mocks, tests réels, design emerge naturellement.
**Inconvenients** : feedback tardif, peut construire des choses inutiles.

### Outside-in (London school / top-down)

On commence par le comportement utilisateur et on descend en mockant les couches inferieures.

```typescript
// 1. D'abord, le controller (ce que l'utilisateur voit)
describe('GET /users/:id', () => {
  it('should return user profile', async () => {
    const mockService = {
      getProfile: vi.fn().mockReturnValue({
        displayName: 'Alice',
        email: 'alice@test.com',
      }),
    };

    const controller = new UserController(mockService);
    const response = await controller.getUser('1');

    expect(response.status).toBe(200);
    expect(response.body.displayName).toBe('Alice');
    expect(mockService.getProfile).toHaveBeenCalledWith('1');
  });
});

// 2. Ensuite, le service (decouvrir l'interface necessaire)
describe('UserService', () => {
  it('should build profile from repository data', () => {
    const mockRepo = {
      findById: vi.fn().mockReturnValue({
        id: '1', name: 'Alice', email: 'alice@test.com',
      }),
    };

    const service = new UserService(mockRepo);
    const profile = service.getProfile('1');

    expect(profile.displayName).toBe('Alice');
    expect(mockRepo.findById).toHaveBeenCalledWith('1');
  });
});

// 3. Enfin, le repository (implementation concrete)
describe('UserRepository', () => {
  it('should find user by id in database', () => {
    const repo = new UserRepository(testDb);
    repo.save({ id: '1', name: 'Alice', email: 'alice@test.com' });

    expect(repo.findById('1')).toEqual({
      id: '1', name: 'Alice', email: 'alice@test.com',
    });
  });
});
```

**Avantages** : design guide par l'usage, feedback rapide, interfaces emergent.
**Inconvenients** : beaucoup de mocks, risque de tests couples a l'implementation.

### Comparaison

| Critere | Inside-out | Outside-in |
|---------|-----------|------------|
| Direction | Bottom → Top | Top → Bottom |
| Mocks | Peu/pas | Beaucoup |
| Feedback | Tardif | Immediat |
| Design | Emerge du code | Emerge de l'usage |
| Risque | Construire l'inutile | Tests couples aux mocks |
| Ideal pour | Libs, algorithmes | Apps, features user |

---

## ATDD : Acceptance Test-Driven Development

ATDD combine BDD et TDD :

1. **Écrire un test d'acceptance** (BDD / Gherkin) qui définit le comportement attendu
2. **Implementer avec TDD** (Red-Green-Refactor) pour satisfaire le test d'acceptance
3. **Valider** que le test d'acceptance passe

```
  Product Owner          Developer              Tests
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │  Ecrire  │          │          │          │ Acceptance│
  │ scenario ├─────────►│  TDD     ├─────────►│ test     │
  │ Gherkin  │          │ interne  │          │ passe    │
  └──────────┘          └──────────┘          └──────────┘
```

### Workflow ATDD concret

```gherkin
# 1. PO ecrit le scenario
Feature: Password Strength Indicator
  Scenario: Weak password
    Given I am on the registration page
    When I type "abc" in the password field
    Then the strength indicator should show "Weak"
    And the indicator should be red

  Scenario: Strong password
    Given I am on the registration page
    When I type "C0mpl3x!Pass#2025" in the password field
    Then the strength indicator should show "Strong"
    And the indicator should be green
```

```typescript
// 2. Dev implementente avec TDD
// RED
describe('PasswordStrength', () => {
  it('should rate "abc" as weak', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
  });
});

// GREEN
export function getPasswordStrength(password: string): string {
  if (password.length < 8) return 'weak';
  return 'medium';
}

// RED
it('should rate complex password as strong', () => {
  expect(getPasswordStrength('C0mpl3x!Pass#2025')).toBe('strong');
});

// GREEN
export function getPasswordStrength(password: string): string {
  if (password.length < 8) return 'weak';

  let score = 0;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score >= 4 && password.length >= 12) return 'strong';
  if (score >= 2) return 'medium';
  return 'weak';
}

// 3. Le test d'acceptance (Cucumber) passe automatiquement
```

---

## Living documentation

Les tests BDD generent une **documentation vivante** : toujours a jour car les specs sont les tests.

### Générer un rapport HTML

```javascript
// cucumber.mjs
export default {
  format: [
    'progress-bar',
    'html:reports/cucumber-report.html',
    'json:reports/cucumber-report.json',
  ],
};
```

### Intégration avec des outils de documentation

```bash
pnpm add -D cucumber-html-reporter
```

```typescript
// scripts/generate-report.ts
import reporter from 'cucumber-html-reporter';

reporter.generate({
  theme: 'bootstrap',
  jsonFile: 'reports/cucumber-report.json',
  output: 'reports/living-doc.html',
  reportSuiteAsScenarios: true,
  scenarioTimestamp: true,
  launchReport: true,
  metadata: {
    'App Version': '1.0.0',
    'Test Environment': 'CI',
    'Executed': new Date().toISOString(),
  },
});
```

> Si un scenario Gherkin passe, la fonctionnalite decrite **fonctionne**.
> Si un scenario echoue, la fonctionnalite est **cassee** et la doc le dit.

---

## Conseils pratiques

### TDD au quotidien

1. **Commencez petit** : ne faites pas du TDD sur tout, commencez par un bug fix ou un algorithme
2. **Baby steps** : chaque cycle Red-Green-Refactor doit durer 2-5 minutes max
3. **N'optimisez pas en Green** : ecrivez le code le plus simple qui passe, même moche
4. **Refactor est obligatoire** : ne sautez jamais l'étape Refactor
5. **Une assertion par test** : soyez spécifique, un test = un comportement

### BDD au quotidien

1. **Ecrivez les scenarios AVANT le code** : c'est le but
2. **Impliquez le PO** : les scenarios doivent etre comprehensibles par un non-dev
3. **Evitez les details techniques** : pas de SQL, pas de JSON, pas de HTTP codes dans le Gherkin
4. **Utilisez les Scenario Outline** : pour les variations parametriques
5. **Gardez les steps réutilisables** : une step = une action atomique

### Anti-patterns

```gherkin
# MAUVAIS — trop technique
Scenario: Create user
  Given I send a POST to "/api/users" with body '{"name":"Alice"}'
  Then the response status should be 201
  And the JSON body should contain "id"

# BON — comportement metier
Scenario: Register new user
  Given I am on the registration page
  When I register with the name "Alice" and email "alice@example.com"
  Then I should see a welcome message
  And I should receive a confirmation email
```

```typescript
// MAUVAIS — test TDD trop gros
it('should handle the complete order flow', () => {
  // 50 lignes de test...
});

// BON — petits tests focuses
it('should validate order items are not empty', () => { /* ... */ });
it('should calculate subtotal from items', () => { /* ... */ });
it('should apply shipping for orders under 50 euros', () => { /* ... */ });
it('should waive shipping for orders over 50 euros', () => { /* ... */ });
```

---

## Checklist du module

- [ ] Je comprends le cycle Red-Green-Refactor
- [ ] J'ai fait le kata StringCalculator en **écrivant moi-même chaque test** (phase RED)
- [ ] Je sais ce que "minimum de code" signifie réellement (ex : `return 0` pour le premier test)
- [ ] J'ai realise un kata TDD complet (StringCalculator ou RomanNumerals)
- [ ] Je sais quand TDD est adapte et quand il l'est moins
- [ ] J'écris mes assertions AVANT de demander du code à l'IA
- [ ] Je lis chaque ligne de code généré par l'IA avant d'accepter
- [ ] Je sais écrire des scenarios Given-When-Then en Gherkin
- [ ] J'ai configure Cucumber.js avec TypeScript
- [ ] Je comprends la différence entre Inside-out et Outside-in TDD
- [ ] Je sais quand utiliser TDD, BDD ou ATDD
- [ ] J'evite les anti-patterns (scenarios techniques, tests trop gros)

---

## Exercice pratique

### Partie 1 : Kata StringCalculator from scratch (phase RED)

Ouvre `labs/lab-15-tdd-bdd/kata-stringcalculator.ts` (fichier vide). Suis les 8 exigences du module ci-dessus, une par une, en écrivant toi-même chaque test avant de regarder la solution.

Règle : une exigence à la fois. Pas d'implémentation sans test rouge d'abord.

### Partie 2 : Lab TDD (phase GREEN guidée)

Ouvre `labs/lab-15-tdd-bdd/exercise.ts`. Les tests sont déjà écrits — implémente les 6 exercices, un test à la fois.

### Partie 3 : BDD

Écris les scenarios Gherkin et les step définitions pour une feature "Gestion de taches" :
- Créer une tache
- Marquer une tache comme terminee
- Filtrer les taches par statut
- Supprimer une tache

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [14 - Flaky tests et debugging](./14-flaky-tests-et-debugging) | [16 - Contract testing](./16-contract-testing) |

---

## Ressources

- [Quiz 15 : Testez vos connaissances](../quizzes/quiz-15-tdd-bdd.html)
- [Lab 15 : TDD et BDD](../labs/lab-15-tdd-bdd/)
- [Kent Beck — Test-Driven Development: By Example](https://www.oreilly.com/library/view/test-driven-development/0321146530/)
- [Cucumber Documentation](https://cucumber.io/docs/cucumber/)
- [BDD in Action](https://www.manning.com/books/bdd-in-action-second-edition)
- [The StringCalculator Kata](https://osherove.com/tdd-kata-1/)

---

::: tip Parcours recommandé
1. **Module** : lis jusqu'à "La phase RED" inclus
2. **Kata** : `labs/lab-15-tdd-bdd/kata-stringcalculator.ts` — 8 exigences, phase RED
3. **Lab** : `labs/lab-15-tdd-bdd/exercise.ts` — 6 exercices, phase GREEN
4. **Screencast** : [screencast 15 tdd bdd](../screencasts/screencast-15-tdd-bdd.md)
5. **Visualisation** : [Cycle TDD](../visualizations/tdd-cycle.html)
6. **Quiz** : [quiz 15 tdd bdd](../quizzes/quiz-15-tdd-bdd.html)
:::
