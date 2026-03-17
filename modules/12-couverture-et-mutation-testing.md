# Module 12 — Couverture de code et mutation testing

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 3/5        | 75 min        | [Lab 12](../labs/lab-12-couverture/) | [Quiz 12](../quizzes/quiz-12-couverture.html) |

## Objectifs

- Comprendre les metriques de couverture (lignes, branches, fonctions, statements)
- Configurer Istanbul/c8 avec Vitest
- Définir des seuils de couverture pragmatiques
- Savoir ce que la couverture dit — et ne dit pas
- Demystifier le mythe du 100%
- Decouvrir le mutation testing avec Stryker
- Interpreter un rapport de mutations et corriger les tests faibles

---

## Qu'est-ce que la couverture de code ?

La couverture mesure **quelle proportion du code source est executee** pendant les tests. C'est un indicateur quantitatif, pas qualitatif.

### Les 4 metriques principales

| Metrique | Ce qu'elle mesure | Exemple |
|----------|-------------------|---------|
| **Statements** | Nombre d'instructions executees | `const x = 1; console.log(x);` = 2 statements |
| **Branches** | Chemins conditionnels couverts | `if/else`, `switch`, `? :`, `??`, `&&` |
| **Functions** | Fonctions appelees au moins une fois | Declarations, expressions, fleches |
| **Lines** | Lignes physiques executees | Approximation de statements |

### Visualiser la différence

```typescript
// fichier: src/pricing.ts
export function calculatePrice(quantity: number, unitPrice: number): number {
  // Statement 1: la declaration de la variable
  let total = quantity * unitPrice;

  // Branch 1: if — Branch 2: else
  if (total > 1000) {
    total *= 0.9; // Statement dans branche 1
  } else {
    total *= 0.95; // Statement dans branche 2
  }

  // Branch 3: if (sans else)
  if (quantity > 100) {
    total -= 50; // Bonus volume
  }

  return total;
}
```

```typescript
// test qui couvre partiellement
import { describe, it, expect } from 'vitest';
import { calculatePrice } from '../src/pricing';

describe('calculatePrice', () => {
  it('should apply 10% discount for orders over 1000', () => {
    const result = calculatePrice(20, 100); // total = 2000 > 1000
    expect(result).toBe(1800); // 2000 * 0.9
  });
});
```

**Résultat de couverture :**

| Metrique | Couvert | Total | % |
|----------|---------|-------|---|
| Statements | 4 | 6 | 66.7% |
| Branches | 1 | 3 | 33.3% |
| Functions | 1 | 1 | 100% |
| Lines | 4 | 6 | 66.7% |

Branches manquantes : le `else` (total <= 1000) et le `if quantity > 100`.

---

## Configurer la couverture avec Vitest

Vitest supporte deux providers de couverture :

| Provider | Mécanisme | Vitesse | Precision |
|----------|-----------|---------|-----------|
| **c8** (v8) | Instrumentation native V8 | Rapide | Bonne (quelques edge cases) |
| **istanbul** | Instrumentation du code source | Plus lent | Excellente |

### Installation

```bash
# Provider v8 (recommande pour la plupart des projets)
pnpm add -D @vitest/coverage-v8

# OU provider Istanbul (meilleure precision)
pnpm add -D @vitest/coverage-istanbul
```

### Configuration dans vitest.config.ts

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      // Provider : 'v8' ou 'istanbul'
      provider: 'v8',

      // Activer la couverture (sinon il faut --coverage en CLI)
      enabled: false,

      // Fichiers a inclure dans le rapport
      include: ['src/**/*.ts', 'src/**/*.tsx'],

      // Fichiers a exclure
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/types.ts',
        'src/**/index.ts', // barrels
        'src/**/__mocks__/**',
      ],

      // Formats de rapport
      reporter: ['text', 'html', 'lcov', 'json-summary'],

      // Dossier de sortie
      reportsDirectory: './coverage',

      // Seuils minimaux
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### Lancer la couverture

```bash
# Lancer les tests avec couverture
pnpm vitest run --coverage

# En mode watch (recalcule a chaque modification)
pnpm vitest --coverage

# Couverture sur des fichiers specifiques
pnpm vitest run --coverage src/services/
```

### Lire le rapport texte

```
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |   82.35 |    71.43 |   85.71 |   82.35 |
 pricing.ts         |   66.67 |    33.33 |     100 |   66.67 | 11,16
 cart.ts            |     100 |      100 |     100 |     100 |
 discount.ts        |   83.33 |    66.67 |     100 |   83.33 | 22
--------------------|---------|----------|---------|---------|-------------------
```

La colonne **Uncovered Line #s** indique les lignes jamais executees.

### Rapport HTML interactif

```bash
# Generer et ouvrir le rapport HTML
pnpm vitest run --coverage
open coverage/index.html  # macOS
# ou: start coverage/index.html  # Windows
```

Le rapport HTML permet de :
- Naviguer fichier par fichier
- Voir les lignes couvertes (vert) et non couvertes (rouge)
- Identifier les branches manquantes (surlignage jaune)

---

## Seuils de couverture (thresholds)

### Configuration par seuils globaux

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

Si un seuil n'est pas atteint, **le process echoue avec code 1** — ideal pour la CI.

### Seuils par fichier ou par dossier

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        // Seuils globaux
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,

        // Seuils specifiques par glob
        'src/services/**': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        'src/utils/**': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
```

### Script package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:coverage:check": "vitest run --coverage --coverage.thresholds.100"
  }
}
```

---

## Ce que la couverture dit — et ne dit pas

### Ce qu'elle dit

- Quelles parties du code **ne sont jamais executees** pendant les tests
- Une approximation du **risque de regression** non detectee
- Les **zones mortes** potentielles (code mort)

### Ce qu'elle ne dit PAS

La couverture ne mesure **pas la qualite des assertions**.

```typescript
// Ce test a 100% de couverture... mais ne teste RIEN
describe('calculatePrice', () => {
  it('should work', () => {
    calculatePrice(10, 50);  // execute tout le code
    // Aucun expect ! Le test passe toujours.
  });
});
```

```typescript
// Ce test a 100% de couverture... mais teste mal
describe('calculatePrice', () => {
  it('should calculate', () => {
    const result = calculatePrice(10, 50);
    expect(result).toBeDefined(); // verifie juste que ca retourne quelque chose
  });
});
```

### L'analogie du parachute

> Avoir 100% de couverture, c'est comme avoir vérifié que chaque couture
> du parachute existe. Mais est-ce qu'elles tiennent sous pression ?

La couverture mesure **"est-ce que le code a ete exécuté"**, pas **"est-ce que le comportement est correctement vérifié"**.

---

## Le mythe du 100%

### Pourquoi 100% est presque toujours une mauvaise cible

1. **Rendements decroissants** : passer de 80% a 90% coute beaucoup plus que de 0% a 80%
2. **Faux sentiment de sécurité** : 100% de couverture != 0 bugs
3. **Tests fragiles** : pour atteindre 100%, on écrit des tests couples a l'implementation
4. **Code non testable utilement** : getters triviaux, barrels, types, configurations

### Exemple de code ou 100% est absurde

```typescript
// src/types.ts — rien a tester ici
export interface User {
  id: string;
  name: string;
  email: string;
}

export type Role = 'admin' | 'editor' | 'viewer';

export const DEFAULT_PAGE_SIZE = 20;
```

```typescript
// src/index.ts — barrel file, pure re-exportation
export { calculatePrice } from './pricing';
export { ShoppingCart } from './cart';
export { UserValidator } from './validator';
```

### Seuils pragmatiques recommandes

| Couche | Statement | Branch | Justification |
|--------|-----------|--------|---------------|
| Utils / Logique pure | 90-95% | 85-90% | Facile à tester, critique |
| Services / Use cases | 85-90% | 80-85% | Logique metier importante |
| API / Controllers | 75-85% | 70-80% | Intégration souvent plus utile |
| UI Components | 70-80% | 65-75% | Tester le comportement, pas le rendu |
| **Global** | **80%** | **75%** | Bon equilibre effort/sécurité |

> **Regle d'or** : 80% de couverture + tests de qualite sur les chemins critiques
> vaut mieux que 100% de couverture avec des tests superficiels.

---

## Introduction au mutation testing

### Le problème que ça resout

La couverture dit : "Ce code a ete exécuté pendant les tests."

Le mutation testing demandé : **"Est-ce que les tests detecteraient une erreur dans ce code ?"**

### Le principe

1. **Créer un mutant** : modifier legerement le code source (ex: `>` devient `>=`)
2. **Lancer les tests** sur le mutant
3. **Observer** :
   - Tests echouent -> le mutant est **tue** (les tests sont bons)
   - Tests passent -> le mutant **survit** (les tests sont faibles)

### Types de mutations

| Categorie | Original | Mutant | Nom |
|-----------|----------|--------|-----|
| Arithmetique | `a + b` | `a - b` | ArithmeticOperator |
| Comparaison | `a > b` | `a >= b` | ConditionalExpression |
| Comparaison | `a === b` | `a !== b` | EqualityOperator |
| Logique | `a && b` | `a \|\| b` | LogicalOperator |
| Negation | `if (x)` | `if (!x)` | BooleanSubstitution |
| Bloc | `if (x) { ... }` | `if (x) { }` | BlockStatement |
| Valeur | `return total` | `return 0` | StringLiteral / NumberLiteral |
| Increment | `i++` | `i--` | UpdateOperator |
| Suppression | `array.filter(fn)` | `array` | ArrayDeclaration |

### Illustration concrete

```typescript
// Code original
export function isEligibleForDiscount(age: number, memberYears: number): boolean {
  return age >= 65 || memberYears > 5;
}
```

```typescript
// Test faible
it('should return true for senior members', () => {
  expect(isEligibleForDiscount(70, 1)).toBe(true);
});

it('should return true for long-time members', () => {
  expect(isEligibleForDiscount(30, 10)).toBe(true);
});
```

**Mutants generes :**

| # | Mutation | Code mute | Tue ? |
|---|----------|-----------|-------|
| 1 | `>=` -> `>` | `age > 65` | Non ! (test utilise 70, pas 65) |
| 2 | `>` -> `>=` | `memberYears >= 5` | Non ! (test utilise 10, pas 5) |
| 3 | `\|\|` -> `&&` | `age >= 65 && memberYears > 5` | Oui (70,1 echouerait) |
| 4 | `true` -> `false` | `return false` | Oui |

**Mutants survivants** = faille dans les tests. Il manque les tests aux **limites** :

```typescript
// Tests ameliores pour tuer les mutants survivants
it('should return true for exactly 65 years old', () => {
  expect(isEligibleForDiscount(65, 0)).toBe(true); // tue mutant #1
});

it('should return false for exactly 5 member years (not >5)', () => {
  expect(isEligibleForDiscount(30, 5)).toBe(false); // tue mutant #2
});
```

---

## Stryker : mutation testing en pratique

### Installation

```bash
# Installer Stryker et le plugin Vitest
pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner

# OU avec le CLI interactif
pnpm dlx stryker init
```

### Configuration

```javascript
// stryker.config.mjs
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // Runner de tests
  testRunner: 'vitest',

  // Fichiers a muter
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],

  // Reporters
  reporters: ['html', 'clear-text', 'progress'],

  // Niveau de log
  logLevel: 'info',

  // Timeouts (les mutants peuvent causer des boucles infinies)
  timeoutMS: 10000,
  timeoutFactor: 1.5,

  // Concurrence
  concurrency: 4,

  // Seuils
  thresholds: {
    high: 80,
    low: 60,
    break: 50, // echoue en dessous de 50%
  },
};
```

### Lancer le mutation testing

```bash
# Lancer sur tout le projet
pnpm stryker run

# Lancer sur un fichier specifique
pnpm stryker run --mutate "src/services/pricing.ts"
```

### Lire le rapport

```
All files
  Mutation score: 72.34%
  Mutants:
    Killed:    34
    Survived:  10
    Timeout:    2
    No coverage: 1

src/services/pricing.ts
  Mutation score: 65.00%
  Killed: 13   Survived: 7

  Survived mutants:
  [1] ConditionalExpression: changed "total > 1000" to "true"  (line 8)
  [2] EqualityOperator: changed ">=" to ">"                    (line 12)
  [3] ArithmeticOperator: changed "*" to "/"                   (line 15)
  ...
```

### Interpreter les résultats

| Statut | Signification | Action |
|--------|---------------|--------|
| **Killed** | Les tests detectent la mutation | Rien à faire |
| **Survived** | Les tests NE detectent PAS la mutation | Ameliorer les tests |
| **Timeout** | La mutation cause une boucle infinie | Generalement OK |
| **No coverage** | Le code mute n'est pas couvert | Ajouter des tests |
| **Compile error** | La mutation produit du code invalide | Ignore |

### Le mutation score

```
Mutation Score = Killed / (Total - CompileErrors - Timeouts) * 100
```

Un score de 80%+ sur la logique metier est un **excellent indicateur** de qualite des tests.

---

## Exemple complet : ameliorer des tests grâce à Stryker

### Code source

```typescript
// src/services/subscription.ts
export type Plan = 'free' | 'basic' | 'premium' | 'enterprise';

export interface SubscriptionResult {
  price: number;
  features: string[];
  trialDays: number;
}

export function calculateSubscription(
  plan: Plan,
  isAnnual: boolean,
  couponPercent: number = 0,
): SubscriptionResult {
  const prices: Record<Plan, number> = {
    free: 0,
    basic: 9.99,
    premium: 29.99,
    enterprise: 99.99,
  };

  const features: Record<Plan, string[]> = {
    free: ['basic-access'],
    basic: ['basic-access', 'email-support'],
    premium: ['basic-access', 'email-support', 'priority-support', 'api-access'],
    enterprise: ['basic-access', 'email-support', 'priority-support', 'api-access', 'sla', 'custom-domain'],
  };

  let price = prices[plan];

  // Reduction annuelle de 20%
  if (isAnnual && plan !== 'free') {
    price = price * 12 * 0.8;
  } else if (!isAnnual && plan !== 'free') {
    price = price; // Mensuel, pas de reduction
  }

  // Application du coupon
  if (couponPercent > 0 && couponPercent <= 100) {
    price = price * (1 - couponPercent / 100);
  }

  // Arrondir a 2 decimales
  price = Math.round(price * 100) / 100;

  // Trial days
  const trialDays = plan === 'free' ? 0 : plan === 'enterprise' ? 30 : 14;

  return { price, features: features[plan], trialDays };
}
```

### Tests initiaux (couverture 100%, mais faibles)

```typescript
// src/services/subscription.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSubscription } from './subscription';

describe('calculateSubscription', () => {
  it('should return free plan details', () => {
    const result = calculateSubscription('free', false);
    expect(result.price).toBe(0);
    expect(result.features).toContain('basic-access');
  });

  it('should calculate basic plan monthly', () => {
    const result = calculateSubscription('basic', false);
    expect(result.price).toBe(9.99);
  });

  it('should apply annual discount', () => {
    const result = calculateSubscription('premium', true);
    expect(result.price).toBeGreaterThan(0);
    // Assertion trop vague !
  });

  it('should apply coupon', () => {
    const result = calculateSubscription('basic', false, 50);
    expect(result.price).toBeLessThan(9.99);
    // Assertion trop vague !
  });

  it('should return trial days', () => {
    const result = calculateSubscription('basic', false);
    expect(result.trialDays).toBeDefined();
    // Ne verifie pas la valeur exacte !
  });
});
```

**Couverture** : 100% statements, 100% branches, 100% functions, 100% lines.

**Mutation score** : 52% — la moitie des mutants survivent !

### Mutants survivants identifies par Stryker

```
[1] ArithmeticOperator: "price * 12 * 0.8" -> "price / 12 * 0.8"    (survived)
[2] ArithmeticOperator: "price * 12 * 0.8" -> "price * 12 / 0.8"    (survived)
[3] ConditionalExpression: "couponPercent > 0" -> "couponPercent >= 0" (survived)
[4] EqualityOperator: "plan === 'enterprise'" -> "plan !== 'enterprise'" (survived)
[5] NumberLiteral: "14" -> "0"                                        (survived)
[6] NumberLiteral: "30" -> "0"                                        (survived)
```

### Tests ameliores (mutation score 95%+)

```typescript
import { describe, it, expect } from 'vitest';
import { calculateSubscription } from './subscription';

describe('calculateSubscription', () => {
  describe('pricing', () => {
    it('should return 0 for free plan', () => {
      expect(calculateSubscription('free', false).price).toBe(0);
    });

    it('should return monthly price for basic plan', () => {
      expect(calculateSubscription('basic', false).price).toBe(9.99);
    });

    it('should apply 20% annual discount: basic plan', () => {
      // 9.99 * 12 * 0.8 = 95.90 (arrondi)
      expect(calculateSubscription('basic', true).price).toBe(95.9);
    });

    it('should apply 20% annual discount: premium plan', () => {
      // 29.99 * 12 * 0.8 = 287.90
      expect(calculateSubscription('premium', true).price).toBe(287.9);
    });

    it('should NOT apply annual discount to free plan', () => {
      expect(calculateSubscription('free', true).price).toBe(0);
    });
  });

  describe('coupons', () => {
    it('should apply 50% coupon', () => {
      // 9.99 * 0.5 = 4.995 -> 5.00
      expect(calculateSubscription('basic', false, 50).price).toBe(5);
    });

    it('should apply 100% coupon', () => {
      expect(calculateSubscription('basic', false, 100).price).toBe(0);
    });

    it('should NOT apply coupon of 0%', () => {
      expect(calculateSubscription('basic', false, 0).price).toBe(9.99);
    });

    it('should ignore negative coupon', () => {
      expect(calculateSubscription('basic', false, -10).price).toBe(9.99);
    });
  });

  describe('trial days', () => {
    it('should return 0 trial days for free plan', () => {
      expect(calculateSubscription('free', false).trialDays).toBe(0);
    });

    it('should return 14 trial days for basic plan', () => {
      expect(calculateSubscription('basic', false).trialDays).toBe(14);
    });

    it('should return 14 trial days for premium plan', () => {
      expect(calculateSubscription('premium', false).trialDays).toBe(14);
    });

    it('should return 30 trial days for enterprise plan', () => {
      expect(calculateSubscription('enterprise', false).trialDays).toBe(30);
    });
  });

  describe('features', () => {
    it('should include all premium features', () => {
      const { features } = calculateSubscription('premium', false);
      expect(features).toEqual([
        'basic-access', 'email-support', 'priority-support', 'api-access',
      ]);
    });

    it('should include SLA and custom domain for enterprise', () => {
      const { features } = calculateSubscription('enterprise', false);
      expect(features).toContain('sla');
      expect(features).toContain('custom-domain');
    });
  });
});
```

---

## Stratégies avancees

### Couverture incrementale (changed files only)

```bash
# Couverture uniquement sur les fichiers modifies
pnpm vitest run --coverage --changed HEAD~1
```

### Ignorer du code avec istanbul comments

```typescript
export function debugOnly(message: string): void {
  /* istanbul ignore next -- @preserve: debug-only code */
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`);
  }
}

export function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    /* istanbul ignore next -- @preserve: defensive error handling */
    return null;
  }
}
```

### Combiner couverture et mutation testing dans le workflow

```json
{
  "scripts": {
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:mutation": "stryker run",
    "test:mutation:changed": "stryker run --mutate $(git diff --name-only HEAD~1 | grep 'src/' | tr '\\n' ',')",
    "test:quality": "pnpm test:coverage && pnpm test:mutation"
  }
}
```

### Stryker sur les fichiers modifies uniquement (CI)

```yaml
# .github/workflows/mutation.yml
name: Mutation Testing (Changed Files)
on: pull_request

jobs:
  mutation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Get changed source files
        id: changed
        run: |
          FILES=$(git diff --name-only origin/main...HEAD | grep '^src/.*\.ts$' | grep -v '\.test\.' | grep -v '\.spec\.' | tr '\n' ',' | sed 's/,$//')
          echo "files=$FILES" >> $GITHUB_OUTPUT

      - name: Run Stryker on changed files
        if: steps.changed.outputs.files != ''
        run: pnpm stryker run --mutate "${{ steps.changed.outputs.files }}"
```

---

## Anti-patterns de couverture

### 1. Le test sans assertion

```typescript
// MAUVAIS — 100% coverage, 0% utilite
it('should not crash', () => {
  calculatePrice(10, 5);
});
```

### 2. Le snapshot sur tout

```typescript
// MAUVAIS — couverture haute mais fragile
it('should match snapshot', () => {
  expect(calculateSubscription('premium', true, 25)).toMatchInlineSnapshot();
  // Chaque changement casse le test, meme les changements voulus
});
```

### 3. L'obsession du chiffre

```typescript
// MAUVAIS — tester du code trivial pour le %
it('should export DEFAULT_PAGE_SIZE', () => {
  expect(DEFAULT_PAGE_SIZE).toBe(20);
  // Ce test ne protege de rien
});
```

### 4. Couverture sans isolation

```typescript
// MAUVAIS — depend d'un autre test qui s'execute avant
it('should update user', () => {
  // Ce test suppose que le test "create user" a deja tourne
  const user = getLastCreatedUser(); // fragile !
  user.name = 'Updated';
  expect(updateUser(user)).toBeTruthy();
});
```

---

## Checklist du module

- [ ] J'ai configure la couverture v8 ou istanbul dans Vitest
- [ ] J'ai défini des seuils pragmatiques (80% global, plus haut sur la logique critique)
- [ ] Je sais lire un rapport de couverture (texte, HTML)
- [ ] Je comprends la différence entre "code exécuté" et "code vérifié"
- [ ] J'ai installe et configure Stryker
- [ ] Je sais interpreter un rapport de mutation (killed, survived, timeout)
- [ ] J'ai ameliore des tests en corrigeant des mutants survivants
- [ ] J'utilise la mutation testing sur les chemins critiques, pas partout

---

## Exercice pratique

Reprenez un module de votre projet :

1. Lancez la couverture : `pnpm vitest run --coverage`
2. Identifiez les fichiers sous 80%
3. Ajoutez les tests manquants
4. Lancez Stryker : `pnpm stryker run --mutate "src/services/votre-fichier.ts"`
5. Identifiez les mutants survivants
6. Corrigez vos tests
7. Atteignez un mutation score de 80%+

> Solution dans le [Lab 12](../labs/lab-12-couverture/)

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [11 - Playwright avance](./11-playwright-avance) | [13 - Tests en CI/CD](./13-tests-en-ci-cd) |

---

## Ressources

- [Quiz 12 : Testez vos connaissances](../quizzes/quiz-12-couverture.html)
- [Lab 12 : Couverture et mutation testing](../labs/lab-12-couverture/)
- [Vitest Coverage](https://vitest.dev/guide/coverage)
- [Stryker Mutator](https://stryker-mutator.io/)
- [Martin Fowler — Test Coverage](https://martinfowler.com/bliki/TestCoverage.html)
- [Mutation Testing — Wikipedia](https://en.wikipedia.org/wiki/Mutation_testing)

---

## Visual regression testing

### Qu'est-ce que le visual regression testing ?

Le visual regression testing (test de régression visuelle) consiste a **capturer des screenshots** de l'interface a un instant donne, puis a les comparer automatiquement lors des prochains passages de tests. L'objectif est de detecter tout changement visuel involontaire : un bouton decale, une couleur modifiee, un texte tronque, une mise en page cassee.

Contrairement aux tests unitaires ou d'integration qui verifient la logique, les tests visuels verifient ce que **l'utilisateur voit reellement**. Un composant peut passer tous ses tests fonctionnels tout en etant visuellement casse (CSS casse, z-index incorrect, overflow masque).

### Pourquoi c'est important

Les regressions visuelles sont parmi les bugs les plus difficiles a detecter automatiquement :

- Un changement CSS dans un composant partage peut **casser 20 pages** sans qu'aucun test unitaire ne le detecte
- Les **effets de bord CSS** (specificity wars, cascade, media queries) sont invisibles pour les tests classiques
- Les **mises a jour de dependances** (framework UI, librairie de composants) peuvent introduire des changements subtils
- Les **navigateurs** n'interpretent pas tous le CSS de la meme facon

```
Test unitaire      : "Le bouton a la classe .primary"           ✅
Test d'integration : "Cliquer le bouton envoie le formulaire"   ✅
Test visuel        : "Le bouton est rouge au lieu de bleu"      ❌ DETECTE !
```

### Outils principaux

#### Playwright — `toHaveScreenshot()`

Playwright integre nativement la comparaison de screenshots. C'est la solution la plus simple si vous utilisez deja Playwright pour vos tests E2E.

```typescript
import { test, expect } from '@playwright/test';

test('page d\'accueil — apparence globale', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});

test('bouton primary — etat normal et hover', async ({ page }) => {
  await page.goto('/components/button');

  // Screenshot d'un element specifique
  const button = page.getByRole('button', { name: 'Envoyer' });
  await expect(button).toHaveScreenshot('button-primary.png');

  // Screenshot apres hover
  await button.hover();
  await expect(button).toHaveScreenshot('button-primary-hover.png');
});

test('formulaire — etat d\'erreur', async ({ page }) => {
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page).toHaveScreenshot('form-errors.png', {
    maxDiffPixelRatio: 0.01, // tolerer 1% de pixels differents
  });
});
```

**Configuration dans `playwright.config.ts`** :

```typescript
export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.005, // seuil global de tolerance
      animations: 'disabled',   // desactiver les animations pour stabilite
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // Un screenshot par navigateur = detection des differences cross-browser
  ],
});
```

**Gestion des baselines** :

```bash
# Generer les screenshots de reference (premiere fois)
npx playwright test --update-snapshots

# Lancer les tests (compare avec les baselines existantes)
npx playwright test

# Si un changement est volontaire, mettre a jour la baseline
npx playwright test --update-snapshots
```

Les screenshots de reference sont stockes dans un dossier `__screenshots__` a cote des tests. Ils **doivent etre commites dans git** pour servir de baseline a l'equipe.

#### Chromatic — visual testing pour Storybook

[Chromatic](https://www.chromatic.com/) est un service cloud cree par l'equipe Storybook. Il capture automatiquement un screenshot de chaque story et detecte les changements.

```bash
# Installation
pnpm add -D chromatic

# Lancer (necessite un project token)
pnpm chromatic --project-token=<token>
```

**Avantages de Chromatic** :

- Integration native avec Storybook — chaque story devient un test visuel
- Interface web pour approuver ou rejeter les changements visuels
- Tests cross-navigateur automatiques (Chrome, Firefox, Safari)
- Parallelisation cloud — rapide meme avec des centaines de composants

**Inconvenients** :

- Service payant au-dela du tier gratuit (5 000 snapshots/mois)
- Necessite Storybook comme prerequis
- Les screenshots sont stockes dans le cloud, pas en local

#### Percy (BrowserStack)

[Percy](https://percy.io/) est un service similaire a Chromatic, mais agnostique au framework. Il s'integre avec Playwright, Cypress, Puppeteer, Storybook, et d'autres.

```typescript
// Integration avec Playwright
import percySnapshot from '@percy/playwright';

test('homepage visual', async ({ page }) => {
  await page.goto('/');
  await percySnapshot(page, 'Homepage');
});
```

### Quand utiliser le visual regression testing

#### Cas ideaux

| Contexte | Pourquoi |
|----------|----------|
| **Librairies de composants** (design system) | Chaque composant a un contrat visuel strict |
| **Pages marketing / landing pages** | L'apparence est le produit — un pixel compte |
| **Emails HTML** | Le rendu varie enormement entre clients mail |
| **Refactoring CSS a grande echelle** | Detecter les effets de bord sur toutes les pages |
| **Migration de framework UI** | Verifier que la nouvelle version rend identiquement |

#### Quand ne PAS l'utiliser (ou avec prudence)

| Contexte | Pourquoi |
|----------|----------|
| **UIs qui changent frequemment** | Chaque sprint genere des dizaines de faux positifs a approuver |
| **Dashboards avec donnees dynamiques** | Les chiffres changent, les graphiques changent — screenshots instables |
| **Contenus generes par l'utilisateur** | Impossible de predire le rendu exact |
| **Animations complexes** | Les screenshots capturent un instant — l'animation peut etre cassee entre deux frames |

> **Regle pratique** : si vous passez plus de temps a approuver des changements qu'a corriger des bugs, vos tests visuels couvrent trop de surface instable.

### Integration avec la CI

#### Workflow typique avec Playwright

```yaml
# .github/workflows/visual-tests.yml
name: Visual Regression Tests
on: pull_request

jobs:
  visual:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium

      - name: Run visual tests
        run: pnpm exec playwright test --project=chromium

      - name: Upload diff artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: test-results/
          retention-days: 7
```

#### Workflow d'approbation

Le workflow d'approbation des changements visuels est critique pour eviter la frustration :

```
1. Developpeur pousse une PR
2. CI lance les tests visuels
3. Si diff detectee :
   a. Playwright : le test echoue, le dev regarde les diffs dans les artifacts
   b. Chromatic/Percy : interface web avec comparaison cote a cote
4. Si le changement est volontaire :
   a. Playwright : `--update-snapshots` puis commit les nouvelles baselines
   b. Chromatic/Percy : clic "Approve" dans l'interface web
5. Si le changement est involontaire :
   a. Le dev corrige le bug CSS et re-pousse
```

### Bonnes pratiques

1. **Desactiver les animations** dans les tests visuels (`animations: 'disabled'`) pour eviter les screenshots flous
2. **Utiliser des donnees deterministes** (mocks, fixtures) pour que les screenshots soient reproductibles
3. **Tester par composant** plutot que par page entiere — les diffs sont plus faciles a analyser
4. **Definir une tolerance** (`maxDiffPixelRatio`) pour absorber les differences sub-pixel entre OS
5. **Limiter le scope** : ne testez visuellement que les composants stables et critiques
6. **Documenter le process d'approbation** pour que toute l'equipe sache comment gerer les diffs

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 12 couverture](../screencasts/screencast-12-couverture.md)
2. **Lab** : [lab-12-couverture](../labs/lab-12-couverture/README)
3. **Quiz** : [quiz 12 couverture](../quizzes/quiz-12-couverture.html)
:::
