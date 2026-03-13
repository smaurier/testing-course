# Module 15 — TDD et BDD

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 4/5        | 90 min        | [Lab 15](../labs/lab-15-tdd-bdd/) | [Quiz 15](../quizzes/quiz-15-tdd-bdd.html) |

## Objectifs

- Comprendre et pratiquer le cycle TDD Red-Green-Refactor
- Savoir quand TDD est benefique et quand il l'est moins
- Realiser un kata TDD complet (StringCalculator)
- Ecrire des specifications BDD en Given-When-Then
- Configurer Cucumber.js avec TypeScript
- Comparer TDD, BDD et ATDD
- Choisir entre Outside-in et Inside-out TDD

---

## TDD : Test-Driven Development

### Le cycle Red-Green-Refactor

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
     │ REFACTOR │  3. Ameliorer le code sans casser les tests
     │ (clean)  │
     └────┬─────┘
          │
          └──────────► Retour a RED
```

### Les 3 lois du TDD (Robert C. Martin)

1. **Ne pas ecrire de code de production** tant qu'il n'y a pas un test qui echoue
2. **Ne pas ecrire plus de test** qu'il n'en faut pour echouer (un assert suffit)
3. **Ne pas ecrire plus de code** qu'il n'en faut pour passer le test

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

## Kata TDD : StringCalculator

Le kata StringCalculator est un exercice classique pour pratiquer le TDD. Voici le deroulement complet, etape par etape.

### Etape 1 : chaine vide retourne 0

```typescript
// RED
import { describe, it, expect } from 'vitest';
import { calculate } from './string-calculator';

describe('StringCalculator', () => {
  it('should return 0 for an empty string', () => {
    expect(calculate('')).toBe(0);
  });
});
```

```typescript
// GREEN
// src/string-calculator.ts
export function calculate(_input: string): number {
  return 0;
}
```

### Etape 2 : un seul nombre

```typescript
// RED
it('should return the number for a single number string', () => {
  expect(calculate('1')).toBe(1);
});

it('should handle different single numbers', () => {
  expect(calculate('5')).toBe(5);
});
```

```typescript
// GREEN
export function calculate(input: string): number {
  if (input === '') return 0;
  return Number(input);
}
```

### Etape 3 : deux nombres separes par une virgule

```typescript
// RED
it('should return the sum of two comma-separated numbers', () => {
  expect(calculate('1,2')).toBe(3);
});
```

```typescript
// GREEN
export function calculate(input: string): number {
  if (input === '') return 0;

  const numbers = input.split(',').map(Number);
  return numbers.reduce((sum, n) => sum + n, 0);
}
```

### Etape 4 : nombre arbitraire de valeurs

```typescript
// RED
it('should handle any amount of numbers', () => {
  expect(calculate('1,2,3,4,5')).toBe(15);
});
```

```typescript
// GREEN — le code precedent gere deja ce cas !
// REFACTOR — rien a changer, les tests passent
```

### Etape 5 : supporter le saut de ligne comme separateur

```typescript
// RED
it('should handle newlines as separators', () => {
  expect(calculate('1\n2,3')).toBe(6);
});
```

```typescript
// GREEN
export function calculate(input: string): number {
  if (input === '') return 0;

  // Remplacer les newlines par des virgules
  const normalized = input.replace(/\n/g, ',');
  const numbers = normalized.split(',').map(Number);
  return numbers.reduce((sum, n) => sum + n, 0);
}
```

### Etape 6 : separateur personnalise

```typescript
// RED
it('should support custom delimiter defined in first line', () => {
  // Format: "//[delimiter]\n[numbers]"
  expect(calculate('//;\n1;2')).toBe(3);
});

it('should support custom delimiter with pipe', () => {
  expect(calculate('//|\n1|2|3')).toBe(6);
});
```

```typescript
// GREEN
export function calculate(input: string): number {
  if (input === '') return 0;

  let delimiter = /[,\n]/;
  let body = input;

  // Detecter un delimiteur personnalise
  if (input.startsWith('//')) {
    const newlineIndex = input.indexOf('\n');
    const customDelimiter = input.substring(2, newlineIndex);
    // Echapper les caracteres speciaux regex
    const escaped = customDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    delimiter = new RegExp(escaped);
    body = input.substring(newlineIndex + 1);
  }

  const numbers = body.split(delimiter).map(Number);
  return numbers.reduce((sum, n) => sum + n, 0);
}
```

### Etape 7 : nombres negatifs interdits

```typescript
// RED
it('should throw for negative numbers', () => {
  expect(() => calculate('1,-2,3')).toThrow('Negatives not allowed: -2');
});

it('should list all negative numbers in error message', () => {
  expect(() => calculate('-1,-2,3')).toThrow('Negatives not allowed: -1, -2');
});
```

```typescript
// GREEN
export function calculate(input: string): number {
  if (input === '') return 0;

  let delimiter = /[,\n]/;
  let body = input;

  if (input.startsWith('//')) {
    const newlineIndex = input.indexOf('\n');
    const customDelimiter = input.substring(2, newlineIndex);
    const escaped = customDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    delimiter = new RegExp(escaped);
    body = input.substring(newlineIndex + 1);
  }

  const numbers = body.split(delimiter).map(Number);

  // Verifier les negatifs
  const negatives = numbers.filter((n) => n < 0);
  if (negatives.length > 0) {
    throw new Error(`Negatives not allowed: ${negatives.join(', ')}`);
  }

  return numbers.reduce((sum, n) => sum + n, 0);
}
```

### Etape 8 : ignorer les nombres > 1000

```typescript
// RED
it('should ignore numbers greater than 1000', () => {
  expect(calculate('2,1001')).toBe(2);
});

it('should include 1000 exactly', () => {
  expect(calculate('1000,2')).toBe(1002);
});
```

```typescript
// GREEN + REFACTOR
export function calculate(input: string): number {
  if (input === '') return 0;

  let delimiter = /[,\n]/;
  let body = input;

  if (input.startsWith('//')) {
    const newlineIndex = input.indexOf('\n');
    const customDelimiter = input.substring(2, newlineIndex);
    const escaped = customDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    delimiter = new RegExp(escaped);
    body = input.substring(newlineIndex + 1);
  }

  const numbers = body.split(delimiter).map(Number);

  const negatives = numbers.filter((n) => n < 0);
  if (negatives.length > 0) {
    throw new Error(`Negatives not allowed: ${negatives.join(', ')}`);
  }

  return numbers
    .filter((n) => n <= 1000)
    .reduce((sum, n) => sum + n, 0);
}
```

### Suite de tests finale

```typescript
import { describe, it, expect } from 'vitest';
import { calculate } from './string-calculator';

describe('StringCalculator', () => {
  // Cas de base
  it('should return 0 for empty string', () => {
    expect(calculate('')).toBe(0);
  });

  it('should return number for single value', () => {
    expect(calculate('42')).toBe(42);
  });

  // Addition
  it('should sum two numbers', () => {
    expect(calculate('1,2')).toBe(3);
  });

  it('should sum multiple numbers', () => {
    expect(calculate('1,2,3,4,5')).toBe(15);
  });

  // Separateurs
  it('should handle newline separator', () => {
    expect(calculate('1\n2,3')).toBe(6);
  });

  it('should handle custom delimiter', () => {
    expect(calculate('//;\n1;2')).toBe(3);
  });

  // Validation
  it('should throw for negatives', () => {
    expect(() => calculate('-1,2,-3')).toThrow('Negatives not allowed: -1, -3');
  });

  // Filtrage
  it('should ignore numbers > 1000', () => {
    expect(calculate('2,1001,3')).toBe(5);
  });

  it('should include 1000', () => {
    expect(calculate('1000,1')).toBe(1001);
  });
});
```

---

## Quand TDD fonctionne bien

| Situation | Pourquoi TDD aide |
|-----------|-------------------|
| **Logique metier complexe** | Force a definir les regles avant le code |
| **Algorithmes** | Decompose le probleme en petites etapes |
| **API design** | Le test est le premier "client" de l'API |
| **Bug fix** | Ecrire le test qui reproduit le bug d'abord |
| **Code critique** | Garantit une couverture exhaustive |

## Quand TDD est moins adapte

| Situation | Pourquoi |
|-----------|----------|
| **Prototypage / exploration** | On ne sait pas encore ce qu'on construit |
| **UI visuelle** | Le rendu est difficile a exprimer en assertions |
| **Integration systeme** | Les dependances externes sont complexes a simuler |
| **Code jetable** | L'investissement ne sera pas rentabilise |
| **Refactoring massif** | Ecrire les tests apres est parfois plus pragmatique |

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
- **Non-technique** : le PO peut ecrire les scenarios

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

### Step definitions

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
| **Audience** | Developpeurs | Equipe entiere |
| **Language** | Code (TypeScript) | Gherkin (naturel) |
| **Granularite** | Fonction / methode | Feature / scenario |
| **Quand** | Pendant le developpement | Avant le developpement (specs) |
| **Sortie** | Tests unitaires | Specs executables |
| **Overhead** | Faible | Moyen (step definitions) |

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
    // Utilise le vrai service et le vrai repository
    const response = await request(app).get('/users/1');
    expect(response.status).toBe(200);
  });
});
```

**Avantages** : pas de mocks, tests reels, design emerge naturellement.
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

1. **Ecrire un test d'acceptance** (BDD / Gherkin) qui definit le comportement attendu
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

### Generer un rapport HTML

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

### Integration avec des outils de documentation

```bash
# Installer le generateur de rapport
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

### Avantage cle

> Si un scenario Gherkin passe, la fonctionnalite decrite **fonctionne**.
> Si un scenario echoue, la fonctionnalite est **cassee** et la doc le dit.

Contrairement a un wiki ou un Confluence qui peut devenir obsolete, la living doc est **mecaniquement liee au code**.

---

## Conseils pratiques

### TDD au quotidien

1. **Commencez petit** : ne faites pas du TDD sur tout, commencez par un bug fix ou un algorithme
2. **Baby steps** : chaque cycle Red-Green-Refactor doit durer 2-5 minutes max
3. **N'optimisez pas en Green** : ecrivez le code le plus simple qui passe, meme moche
4. **Refactor est obligatoire** : ne sautez jamais l'etape Refactor
5. **Une assertion par test** : soyez specifique, un test = un comportement

### BDD au quotidien

1. **Ecrivez les scenarios AVANT le code** : c'est le but
2. **Impliquez le PO** : les scenarios doivent etre comprehensibles par un non-dev
3. **Evitez les details techniques** : pas de SQL, pas de JSON, pas de HTTP codes dans le Gherkin
4. **Utilisez les Scenario Outline** : pour les variations parametriques
5. **Gardez les steps reutilisables** : une step = une action atomique

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
- [ ] J'ai realise le kata StringCalculator en TDD pur
- [ ] Je sais quand TDD est adapte et quand il l'est moins
- [ ] Je sais ecrire des scenarios Given-When-Then en Gherkin
- [ ] J'ai configure Cucumber.js avec TypeScript
- [ ] Je comprends la difference entre Inside-out et Outside-in TDD
- [ ] Je sais quand utiliser TDD, BDD ou ATDD
- [ ] J'evite les anti-patterns (scenarios techniques, tests trop gros)

---

## Exercice pratique

### Partie 1 : Kata TDD

Implementez un `RomanNumeralConverter` en TDD strict :
- `toRoman(1)` -> `"I"`, `toRoman(4)` -> `"IV"`, ..., `toRoman(3999)` -> `"MMMCMXCIX"`
- Ecrivez un test, faites-le passer, refactorisez. Repetez.

### Partie 2 : BDD

Ecrivez les scenarios Gherkin et les step definitions pour une feature "Gestion de taches" :
- Creer une tache
- Marquer une tache comme terminee
- Filtrer les taches par statut
- Supprimer une tache

> Solution dans le [Lab 15](../labs/lab-15-tdd-bdd/)

---

## Navigation

| Precedent | Suivant |
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
