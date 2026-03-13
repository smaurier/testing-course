# Module 03 — Vitest : fondamentaux

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 2/5        | 75 min        | [Lab 03](../labs/lab-03-vitest-fondamentaux/) | [Quiz 03](../quizzes/quiz-03-vitest.html) |

## Objectifs

- Comprendre pourquoi Vitest remplace Jest dans l'ecosysteme moderne
- Configurer Vitest dans un projet TypeScript
- Maitriser l'ensemble des matchers disponibles
- Utiliser les modificateurs .only, .skip, .todo, .each
- Exploiter les snapshots (inline et fichier)
- Travailler efficacement avec le watch mode et l'UI mode

---

## Vitest vs Jest

### Pourquoi un nouveau test runner ?

Jest a ete concu pour l'ecosysteme CommonJS. Avec l'adoption massive d'ESM (ES Modules), TypeScript et Vite, ses limitations deviennent evidentes :

| Critere | Jest | Vitest |
|---------|------|--------|
| Support ESM natif | Partiel, necessite transformations | Natif via Vite |
| Vitesse de demarrage | Lent (transformations Babel/ts-jest) | Rapide (esbuild / SWC) |
| Configuration TypeScript | ts-jest ou @swc/jest requis | Zero config avec Vite |
| HMR / Watch mode | Re-execute tous les fichiers impactes | Ne re-execute que le strict necessaire |
| Compatibilite API | Reference historique | Compatible Jest (migration facile) |
| UI integree | Non (package tiers) | `vitest --ui` inclus |
| Workspace / monorepo | `projects` config | `vitest.workspace.ts` natif |

### Migration depuis Jest

L'API est quasi identique. Dans la plupart des cas, il suffit de :

```typescript
// Avant (Jest)
import { describe, it, expect, jest } from '@jest/globals';

const mockFn = jest.fn();
jest.spyOn(obj, 'method');
jest.useFakeTimers();

// Apres (Vitest)
import { describe, it, expect, vi } from 'vitest';

const mockFn = vi.fn();
vi.spyOn(obj, 'method');
vi.useFakeTimers();
```

La seule difference majeure : `jest.*` devient `vi.*`.

---

## Installation et configuration

### Installation

```bash
# Avec pnpm (recommande)
pnpm add -D vitest

# Avec npm
npm install -D vitest

# Avec un projet Vite existant, Vitest reutilise vite.config.ts automatiquement
```

### Configuration minimale

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Dossier racine pour la resolution des fichiers
    root: '.',

    // Globals : describe, it, expect sans import
    globals: true,

    // Environnement : 'node' (defaut), 'jsdom', 'happy-dom'
    environment: 'node',

    // Pattern des fichiers de test
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // Fichiers a exclure
    exclude: ['node_modules', 'dist', '.git'],
  },
});
```

### Configuration avancee

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],

    // Alias (reutilise ceux de vite.config.ts si present)
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },

    // Coverage
    coverage: {
      provider: 'v8', // ou 'istanbul'
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },

    // Timeouts
    testTimeout: 5000,      // par test
    hookTimeout: 10000,     // beforeAll, afterAll

    // Reporters
    reporters: ['default', 'html'],

    // Fichier de setup global
    setupFiles: ['./tests/setup.ts'],

    // Pool de threads
    pool: 'forks',          // 'threads' | 'forks' | 'vmThreads'
    poolOptions: {
      forks: {
        singleFork: false,  // true = un seul process (utile pour debug)
      },
    },
  },
});
```

### Setup global

```typescript
// tests/setup.ts
import { beforeEach, afterEach } from 'vitest';

// Reset tous les mocks entre chaque test
beforeEach(() => {
  // Code execute avant CHAQUE test de TOUS les fichiers
});

afterEach(() => {
  // Nettoyage apres chaque test
});
```

### Activer les globals dans TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

Avec `globals: true`, plus besoin d'importer `describe`, `it`, `expect` :

```typescript
// Sans globals (import explicite)
import { describe, it, expect } from 'vitest';

describe('Calculator', () => {
  it('should add', () => {
    expect(1 + 1).toBe(2);
  });
});

// Avec globals (zero import pour les primitives de test)
describe('Calculator', () => {
  it('should add', () => {
    expect(1 + 1).toBe(2);
  });
});
```

---

## describe / it / expect en profondeur

### describe : grouper les tests

```typescript
// Basique
describe('MathUtils', () => {
  // tests ici
});

// Nested : par methode / fonctionnalite
describe('StringUtils', () => {
  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('slugify', () => {
    it('should replace spaces with hyphens', () => {
      expect(slugify('hello world')).toBe('hello-world');
    });

    it('should lowercase everything', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('hello@world!')).toBe('helloworld');
    });
  });
});
```

### it vs test

`it` et `test` sont des alias identiques. Convention :

```typescript
// "it" se lit comme une phrase anglaise
it('should return the sum of two numbers', () => { /* ... */ });

// "test" se lit comme une instruction
test('returns the sum of two numbers', () => { /* ... */ });

// Les deux sont valides — choisissez une convention et tenez-vous-y
```

### expect : le coeur des assertions

`expect(value)` retourne un objet avec des matchers. L'assertion echoue si le matcher ne correspond pas.

```typescript
const result = add(2, 3);

// expect prend la valeur reelle (actual)
// Le matcher prend la valeur attendue (expected)
expect(result).toBe(5);
//      ^actual  ^matcher ^expected
```

---

## Catalogue complet des matchers

### Egalite

```typescript
// toBe — egalite stricte (===)
// Utiliser pour les primitives : number, string, boolean, null, undefined
expect(42).toBe(42);
expect('hello').toBe('hello');
expect(true).toBe(true);
expect(null).toBe(null);

// ATTENTION : toBe echoue pour les objets (reference differente)
expect({ a: 1 }).toBe({ a: 1 }); // ECHOUE !

// toEqual — egalite profonde (deep equality)
// Utiliser pour les objets et tableaux
expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } });
expect([1, 2, 3]).toEqual([1, 2, 3]);

// toEqual ignore les proprietes undefined
expect({ a: 1, b: undefined }).toEqual({ a: 1 }); // PASSE

// toStrictEqual — egalite profonde STRICTE
// Verifie aussi : types de classes, proprietes undefined, sparse arrays
expect({ a: 1, b: undefined }).toStrictEqual({ a: 1 }); // ECHOUE
expect({ a: 1 }).toStrictEqual({ a: 1 }); // PASSE

class User {
  constructor(public name: string) {}
}
// toEqual passe (meme forme)
expect(new User('Alice')).toEqual({ name: 'Alice' }); // PASSE
// toStrictEqual echoue (classes differentes)
expect(new User('Alice')).toStrictEqual({ name: 'Alice' }); // ECHOUE
```

### Chaines de caracteres

```typescript
// toContain — contient une sous-chaine
expect('Hello World').toContain('World');
expect('Hello World').toContain('lo Wo');

// toMatch — correspond a une regex ou sous-chaine
expect('Hello World').toMatch(/^Hello/);
expect('Hello World').toMatch(/world$/i);  // flag insensible a la casse
expect('error: file not found').toMatch(/error: .+/);

// toHaveLength — longueur
expect('hello').toHaveLength(5);
expect('').toHaveLength(0);
```

### Tableaux

```typescript
const fruits = ['apple', 'banana', 'cherry'];

// toContain — contient un element (strict ===)
expect(fruits).toContain('banana');

// toContainEqual — contient un element (deep equality)
const users = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
expect(users).toContainEqual({ id: 1, name: 'Alice' });

// toHaveLength
expect(fruits).toHaveLength(3);
expect([]).toHaveLength(0);

// toEqual — egalite profonde du tableau entier
expect(fruits).toEqual(['apple', 'banana', 'cherry']);

// Verifier qu'un tableau contient certains elements (ordre quelconque)
expect(fruits).toEqual(expect.arrayContaining(['cherry', 'apple']));
```

### Objets

```typescript
const user = { id: 1, name: 'Alice', email: 'alice@example.com', age: 30 };

// toHaveProperty — verifie l'existence d'une propriete
expect(user).toHaveProperty('name');
expect(user).toHaveProperty('name', 'Alice');

// Notation pointee pour les proprietes imbriquees
const config = { db: { host: 'localhost', port: 5432 } };
expect(config).toHaveProperty('db.host', 'localhost');
expect(config).toHaveProperty('db.port');

// toMatchObject — correspondance partielle
expect(user).toMatchObject({ name: 'Alice', age: 30 });
// Passe meme si user a d'autres proprietes (id, email)

// expect.objectContaining — dans un toEqual
expect(user).toEqual(expect.objectContaining({
  name: 'Alice',
  email: expect.stringContaining('@'),
}));
```

### Veracite et nullite

```typescript
// toBeNull / toBeUndefined / toBeDefined
expect(null).toBeNull();
expect(undefined).toBeUndefined();
expect('hello').toBeDefined();
expect(undefined).not.toBeDefined();

// toBeTruthy — truthy en JavaScript (pas false, 0, '', null, undefined, NaN)
expect(1).toBeTruthy();
expect('hello').toBeTruthy();
expect([]).toBeTruthy();       // tableau vide est truthy !
expect({}).toBeTruthy();       // objet vide est truthy !

// toBeFalsy — falsy en JavaScript
expect(0).toBeFalsy();
expect('').toBeFalsy();
expect(null).toBeFalsy();
expect(undefined).toBeFalsy();
expect(NaN).toBeFalsy();

// toBeNaN
expect(NaN).toBeNaN();
expect(Number('abc')).toBeNaN();
```

### Nombres et comparaisons

```typescript
// toBeGreaterThan / toBeGreaterThanOrEqual
expect(10).toBeGreaterThan(5);
expect(10).toBeGreaterThanOrEqual(10);

// toBeLessThan / toBeLessThanOrEqual
expect(5).toBeLessThan(10);
expect(5).toBeLessThanOrEqual(5);

// toBeCloseTo — pour les nombres a virgule flottante
expect(0.1 + 0.2).toBeCloseTo(0.3);        // precision par defaut : 5 decimales
expect(0.1 + 0.2).toBeCloseTo(0.3, 10);    // precision : 10 decimales
expect(Math.PI).toBeCloseTo(3.14159, 4);
```

### Exceptions

```typescript
// toThrow — verifie qu'une fonction lance une erreur
function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

// IMPORTANT : envelopper dans une fonction flechee
expect(() => divide(10, 0)).toThrow();
expect(() => divide(10, 0)).toThrow('Division by zero');        // message exact
expect(() => divide(10, 0)).toThrow(/zero/);                    // regex
expect(() => divide(10, 0)).toThrow(Error);                     // type d'erreur

// Erreur personnalisee
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validateAge(age: number): void {
  if (age < 0) throw new ValidationError('age', 'Age cannot be negative');
  if (age > 150) throw new ValidationError('age', 'Age seems unrealistic');
}

expect(() => validateAge(-1)).toThrow(ValidationError);
expect(() => validateAge(-1)).toThrow('Age cannot be negative');

// Ne PAS oublier le wrapper () =>
// expect(divide(10, 0)).toThrow(); // ERREUR : l'exception est lancee AVANT expect
```

### Promesses : resolves / rejects

```typescript
async function fetchUser(id: number): Promise<{ id: number; name: string }> {
  if (id <= 0) throw new Error('Invalid ID');
  return { id, name: 'Alice' };
}

// resolves — verifie qu'une promesse se resout
await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alice' });
await expect(fetchUser(1)).resolves.toHaveProperty('name', 'Alice');

// rejects — verifie qu'une promesse rejette
await expect(fetchUser(-1)).rejects.toThrow('Invalid ID');
await expect(fetchUser(-1)).rejects.toThrow(Error);
await expect(fetchUser(0)).rejects.toThrow(/Invalid/);

// IMPORTANT : toujours await sinon le test passe meme si la promesse echoue
```

### Negation avec .not

```typescript
expect(42).not.toBe(43);
expect('hello').not.toContain('xyz');
expect([1, 2, 3]).not.toContain(4);
expect(null).not.toBeDefined();
expect({ a: 1 }).not.toHaveProperty('b');
expect(() => divide(10, 2)).not.toThrow();
```

### Asymmetric matchers

```typescript
// expect.any(Type) — n'importe quelle valeur de ce type
expect(1).toEqual(expect.any(Number));
expect('hello').toEqual(expect.any(String));

// Utile dans les comparaisons d'objets
expect({
  id: 42,
  name: 'Alice',
  createdAt: new Date(),
}).toEqual({
  id: expect.any(Number),
  name: expect.any(String),
  createdAt: expect.any(Date),
});

// expect.stringContaining / expect.stringMatching
expect('hello world').toEqual(expect.stringContaining('world'));
expect('error: timeout').toEqual(expect.stringMatching(/error: \w+/));

// expect.arrayContaining — sous-ensemble du tableau
expect([1, 2, 3, 4, 5]).toEqual(expect.arrayContaining([3, 1, 5]));

// expect.objectContaining — sous-ensemble de l'objet
expect({ a: 1, b: 2, c: 3 }).toEqual(expect.objectContaining({ a: 1, c: 3 }));

// Combiner les asymmetric matchers
expect({
  users: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ],
}).toEqual({
  users: expect.arrayContaining([
    expect.objectContaining({
      name: 'Alice',
      email: expect.stringContaining('@'),
    }),
  ]),
});
```

---

## Modificateurs : .only, .skip, .todo, .each

### .only — executer un seul test ou groupe

```typescript
describe('MathUtils', () => {
  // Seul ce test s'executera dans ce describe
  it.only('should add correctly', () => {
    expect(add(2, 3)).toBe(5);
  });

  // Ignore (mais pas marque "skipped")
  it('should subtract correctly', () => {
    expect(subtract(5, 3)).toBe(2);
  });
});

// Fonctionne aussi avec describe
describe.only('CriticalFeature', () => {
  // Tous les tests de ce bloc s'executent
});

describe('OtherFeature', () => {
  // Tout ce bloc est ignore
});
```

**Attention** : ne pas committer `.only` ! Configurez ESLint pour le detecter :

```typescript
// eslint.config.js
// Regle : no-only-tests/no-only-tests (plugin eslint-plugin-no-only-tests)
```

### .skip — ignorer un test

```typescript
// Test ignore avec raison en commentaire
it.skip('should handle edge case (TODO: fix #1234)', () => {
  // Ce test ne s'execute pas
  expect(processEdgeCase()).toBe(true);
});

describe.skip('LegacyModule', () => {
  // Tout le bloc est ignore
});
```

### .todo — marquer un test a ecrire

```typescript
describe('PaymentProcessor', () => {
  it('should process credit card', () => {
    // Test implemente
  });

  // Placeholder : rappel qu'il faut ecrire ce test
  it.todo('should handle 3D Secure authentication');
  it.todo('should retry on network timeout');
  it.todo('should send receipt email after successful payment');
});
```

Les `.todo` apparaissent dans le rapport sous "todo" — pas d'echec ni de skip.

### .each — tests parametres

Le pattern `it.each` permet d'executer le meme test avec differentes donnees :

```typescript
// Syntaxe avec tableau de tableaux
describe('isEven', () => {
  it.each([
    [2, true],
    [3, false],
    [0, true],
    [-4, true],
    [-7, false],
    [100, true],
  ])('isEven(%i) should return %s', (input, expected) => {
    expect(isEven(input)).toBe(expected);
  });
});

// Syntaxe avec tableau d'objets (plus lisible)
describe('calculateDiscount', () => {
  it.each([
    { amount: 100, percentage: 10, expected: 90 },
    { amount: 200, percentage: 25, expected: 150 },
    { amount: 50, percentage: 0, expected: 50 },
    { amount: 50, percentage: 100, expected: 0 },
  ])(
    'should return $expected for amount=$amount with $percentage% discount',
    ({ amount, percentage, expected }) => {
      expect(calculateDiscount(amount, percentage)).toBe(expected);
    }
  );
});

// describe.each — parametrer un groupe entier
describe.each([
  { currency: 'EUR', symbol: '\u20ac', decimals: 2 },
  { currency: 'JPY', symbol: '\u00a5', decimals: 0 },
  { currency: 'BTC', symbol: '\u20bf', decimals: 8 },
])('Currency: $currency', ({ currency, symbol, decimals }) => {
  it(`should format with ${symbol} symbol`, () => {
    const result = formatCurrency(1000, currency);
    expect(result).toContain(symbol);
  });

  it(`should have ${decimals} decimal places`, () => {
    const result = formatCurrency(1000.123456789, currency);
    const parts = result.replace(/[^0-9.]/g, '').split('.');
    if (decimals > 0) {
      expect(parts[1]).toHaveLength(decimals);
    } else {
      expect(parts).toHaveLength(1);
    }
  });
});
```

### Combiner les modificateurs

```typescript
// Parametrer et skip
it.skip.each([
  [1, 1, 2],
  [2, 3, 5],
])('add(%i, %i) = %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});

// Only + each
it.only.each([
  ['admin', true],
  ['user', false],
])('isAdmin("%s") should return %s', (role, expected) => {
  expect(isAdmin(role)).toBe(expected);
});
```

---

## Snapshots

### Snapshots fichier

Un snapshot enregistre la sortie et la compare aux executions futures :

```typescript
import { describe, it, expect } from 'vitest';

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

function formatUserProfile(user: User): string {
  return [
    `Name: ${user.name}`,
    `Email: ${user.email}`,
    `Member since: ${user.createdAt.toLocaleDateString('fr-FR')}`,
  ].join('\n');
}

describe('formatUserProfile', () => {
  it('should format profile correctly', () => {
    const user: User = {
      id: 1,
      name: 'Alice Dupont',
      email: 'alice@example.com',
      createdAt: new Date('2024-01-15'),
    };

    // Premier run : cree le fichier __snapshots__/xxx.test.ts.snap
    // Runs suivants : compare avec le snapshot existant
    expect(formatUserProfile(user)).toMatchSnapshot();
  });
});
```

Fichier genere (`__snapshots__/user.test.ts.snap`) :

```
// Vitest Snapshot v1

exports[`formatUserProfile > should format profile correctly 1`] = `
"Name: Alice Dupont
Email: alice@example.com
Member since: 15/01/2024"
`;
```

### Snapshots inline

Le snapshot est stocke directement dans le fichier de test :

```typescript
describe('formatUserProfile', () => {
  it('should format profile correctly', () => {
    const user: User = {
      id: 1,
      name: 'Alice Dupont',
      email: 'alice@example.com',
      createdAt: new Date('2024-01-15'),
    };

    // Le snapshot est ecrit ICI par Vitest au premier run
    expect(formatUserProfile(user)).toMatchInlineSnapshot(`
      "Name: Alice Dupont
      Email: alice@example.com
      Member since: 15/01/2024"
    `);
  });
});
```

### Mettre a jour les snapshots

```bash
# Mettre a jour tous les snapshots
pnpm vitest --update
# ou
pnpm vitest -u

# En watch mode, appuyer sur "u" pour update
```

### Bonnes pratiques snapshots

```typescript
// BON : petits snapshots, valeurs deterministes
expect(formatPrice(1234.56, 'EUR')).toMatchInlineSnapshot('"1 234,56 \u20ac"');

// MAUVAIS : snapshot enorme (tout un composant HTML)
expect(renderComponent()).toMatchSnapshot(); // 200 lignes de HTML...

// MAUVAIS : valeurs non-deterministes
expect({
  id: Math.random(),
  createdAt: new Date(),
}).toMatchSnapshot(); // Change a chaque run !

// SOLUTION : remplacer les valeurs dynamiques
expect({
  id: Math.random(),
  createdAt: new Date(),
}).toMatchSnapshot({
  id: expect.any(Number),
  createdAt: expect.any(Date),
});
```

---

## Watch mode et UI mode

### Watch mode

```bash
# Demarrer en mode watch (defaut avec `vitest` sans `run`)
pnpm vitest

# Vitest observe les fichiers modifies et re-execute les tests impactes
# Raccourcis en watch mode :
#   a — executer tous les tests
#   f — re-executer les tests qui ont echoue
#   u — mettre a jour les snapshots
#   p — filtrer par nom de fichier
#   t — filtrer par nom de test
#   q — quitter
```

### UI mode

```bash
# Demarrer l'interface graphique
pnpm vitest --ui

# Ouvre un navigateur avec :
# - Arbre des fichiers de test
# - Resultats en temps reel
# - Module graph (dependances)
# - Code source avec couverture
```

### Lancer un fichier specifique

```bash
# Par chemin
pnpm vitest src/utils/math.test.ts

# Par pattern
pnpm vitest math

# Mode "run" (une seule execution, pas de watch)
pnpm vitest run

# Avec couverture
pnpm vitest run --coverage
```

---

## Integration TypeScript

### Types et autocompletion

Vitest est ecrit en TypeScript et offre un typage complet :

```typescript
import { describe, it, expect, vi } from 'vitest';

interface UserService {
  getById(id: number): Promise<User>;
  create(data: CreateUserDTO): Promise<User>;
  delete(id: number): Promise<void>;
}

// vi.fn() infere les types
const mockGetById = vi.fn<[number], Promise<User>>();
// TypeScript sait que mockGetById prend un number et retourne Promise<User>

mockGetById.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' });
// mockGetById.mockResolvedValue('wrong'); // Erreur TS !
```

### Custom matchers types

```typescript
// tests/custom-matchers.d.ts
import 'vitest';

interface CustomMatchers<R = unknown> {
  toBeValidEmail(): R;
  toBeWithinRange(min: number, max: number): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
```

```typescript
// tests/setup.ts
import { expect } from 'vitest';

expect.extend({
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid email`
          : `expected ${received} to be a valid email`,
    };
  },

  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range [${min}, ${max}]`
          : `expected ${received} to be within range [${min}, ${max}]`,
    };
  },
});
```

```typescript
// Utilisation
it('should validate email format', () => {
  expect('alice@example.com').toBeValidEmail();
  expect('not-an-email').not.toBeValidEmail();
});

it('should generate score within range', () => {
  const score = calculateScore(player);
  expect(score).toBeWithinRange(0, 100);
});
```

---

## Exemple complet : tester un module utilitaire

```typescript
// src/utils/string-utils.ts
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function countWords(str: string): number {
  if (!str.trim()) return 0;
  return str.trim().split(/\s+/).length;
}

export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}
```

```typescript
// src/utils/string-utils.test.ts
import { describe, it, expect } from 'vitest';
import { capitalize, slugify, truncate, countWords, toCamelCase } from './string-utils';

describe('StringUtils', () => {

  describe('capitalize', () => {
    it.each([
      ['hello', 'Hello'],
      ['HELLO', 'Hello'],
      ['hELLO wORLD', 'Hello world'],
      ['a', 'A'],
    ])('capitalize("%s") should return "%s"', (input, expected) => {
      expect(capitalize(input)).toBe(expected);
    });

    it('should return empty string for empty input', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('slugify', () => {
    it('should replace spaces with hyphens', () => {
      expect(slugify('hello world')).toBe('hello-world');
    });

    it('should lowercase everything', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify("it's a test!")).toBe('its-a-test');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(slugify(' hello world ')).toBe('hello-world');
    });

    it('should handle multiple consecutive spaces', () => {
      expect(slugify('hello    world')).toBe('hello-world');
    });

    it('should handle accented characters edge case', () => {
      expect(slugify('hello_world')).toBe('hello-world');
    });
  });

  describe('truncate', () => {
    it('should not truncate if string is shorter than maxLength', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should truncate and add default suffix', () => {
      expect(truncate('hello world foo bar', 10)).toBe('hello w...');
    });

    it('should use custom suffix', () => {
      expect(truncate('hello world foo bar', 10, ' [more]')).toBe('hel [more]');
    });

    it('should return original if length equals maxLength', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });
  });

  describe('countWords', () => {
    it.each([
      ['hello world', 2],
      ['one', 1],
      ['  spaced   out  ', 2],
      ['', 0],
      ['   ', 0],
    ])('countWords("%s") should return %i', (input, expected) => {
      expect(countWords(input)).toBe(expected);
    });
  });

  describe('toCamelCase', () => {
    it.each([
      ['hello-world', 'helloWorld'],
      ['hello_world', 'helloWorld'],
      ['hello world', 'helloWorld'],
      ['Hello World', 'helloWorld'],
      ['already', 'already'],
      ['SCREAMING-CASE', 'sCREAMINGCASE'],
    ])('toCamelCase("%s") should return "%s"', (input, expected) => {
      expect(toCamelCase(input)).toBe(expected);
    });
  });
});
```

---

## Commandes CLI essentielles

```bash
# Executer tous les tests
pnpm vitest run

# Mode watch (defaut)
pnpm vitest

# Fichier ou pattern specifique
pnpm vitest run src/utils/math.test.ts
pnpm vitest run math

# Tests qui ont echoue au dernier run
pnpm vitest run --changed

# Avec couverture
pnpm vitest run --coverage

# Interface graphique
pnpm vitest --ui

# Reporter specifique
pnpm vitest run --reporter=verbose
pnpm vitest run --reporter=json --outputFile=results.json

# Mode debug (single thread, pas de timeout)
pnpm vitest run --pool=forks --poolOptions.forks.singleFork --testTimeout=0

# Filtrer par nom de test
pnpm vitest run -t "should calculate total"
```

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| [02 - Anatomie d'un test](./02-anatomie-dun-test) | [04 - Mocking et test doubles](./04-mocking-et-test-doubles) |

---

## Ressources

- [Quiz 03 : Testez vos connaissances](../quizzes/quiz-03-vitest.html)
- [Lab 03 : Vitest fondamentaux](../labs/lab-03-vitest-fondamentaux/)
- [Documentation officielle Vitest](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Migration depuis Jest](https://vitest.dev/guide/migration.html)
- [Vitest UI](https://vitest.dev/guide/ui.html)
