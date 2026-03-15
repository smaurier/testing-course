# Module 02 — Anatomie d'un test

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 2/5        | 60 min        | [Lab 02](../labs/lab-02-anatomie-dun-test/) | [Quiz 02](../quizzes/quiz-02-anatomie.html) |

## Objectifs

- Maîtriser le pattern AAA (Arrange, Act, Assert)
- Structurer ses tests avec describe/it
- Utiliser les conventions de nommage
- Comprendre setup/teardown et l'isolation des tests
- Éviter les anti-patterns les plus courants

---

## Le pattern AAA

Tout test suit trois étapes :

```typescript
import { describe, it, expect } from 'vitest';

describe('ShoppingCart', () => {
  it('should calculate total with discount', () => {
    // ARRANGE — preparer les donnees et le contexte
    const cart = new ShoppingCart();
    cart.addItem({ name: 'Laptop', price: 1000, quantity: 1 });
    cart.addItem({ name: 'Mouse', price: 25, quantity: 2 });
    cart.applyDiscount(0.1); // 10%

    // ACT — executer l'action a tester
    const total = cart.getTotal();

    // ASSERT — verifier le resultat
    expect(total).toBe(945); // (1000 + 50) * 0.9
  });
});
```

### Variante BDD : Given-When-Then

Même concept, vocabulaire différent :

```typescript
describe('ShoppingCart', () => {
  it('given a cart with items and 10% discount, when calculating total, then returns discounted price', () => {
    // Given
    const cart = new ShoppingCart();
    cart.addItem({ name: 'Laptop', price: 1000, quantity: 1 });
    cart.applyDiscount(0.1);

    // When
    const total = cart.getTotal();

    // Then
    expect(total).toBe(900);
  });
});
```

---

## Structure : describe et it

### Groupement logique

```typescript
describe('UserValidator', () => {

  describe('validateEmail', () => {
    it('should accept a valid email', () => {
      expect(validateEmail('user@example.com')).toBe(true);
    });

    it('should reject email without @', () => {
      expect(validateEmail('userexample.com')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(validateEmail('user@')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept password with 8+ chars, uppercase, lowercase, digit', () => {
      expect(validatePassword('MyP4ssword')).toBe(true);
    });

    it('should reject password shorter than 8 chars', () => {
      expect(validatePassword('Ab1')).toBe(false);
    });

    it('should reject password without uppercase', () => {
      expect(validatePassword('myp4ssword')).toBe(false);
    });
  });
});
```

### Regles de structuration

1. **Un describe par unite** (classe, module, composant)
2. **Nested describes par méthode/fonctionnalite**
3. **Un it par comportement** (pas par branche de code)
4. **Pas plus de 3 niveaux de nesting**

---

## Conventions de nommage

### Pattern recommande : "should X when Y"

```typescript
it('should return 0 when cart is empty')
it('should throw when dividing by zero')
it('should send email when order is confirmed')
it('should retry 3 times when request fails')
```

### Pattern BDD : "given X, when Y, then Z"

```typescript
it('given an expired token, when authenticating, then returns 401')
it('given a valid coupon, when applying to cart, then reduces total')
```

### Anti-patterns de nommage

```typescript
// ❌ Trop vague
it('should work')
it('test email')
it('handles error')

// ❌ Description de l'implementation
it('should call fetch with correct URL')
it('should set state.loading to true')

// ✓ Description du comportement
it('should display loading spinner while fetching')
it('should show error message when API returns 500')
```

---

## Assertions en profondeur

### Egalite

```typescript
// toBe — egalite stricte (===), pour primitives
expect(42).toBe(42);
expect('hello').toBe('hello');
expect(true).toBe(true);

// toEqual — egalite profonde, pour objets/tableaux
expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } });
expect([1, 2, 3]).toEqual([1, 2, 3]);

// toStrictEqual — comme toEqual mais verifie les types et undefined
expect({ a: 1 }).toStrictEqual({ a: 1 });
// Echoue si classes differentes ou proprietes undefined
```

### Contenu

```typescript
// Strings
expect('Hello World').toContain('World');
expect('Hello World').toMatch(/^Hello/);

// Arrays
expect([1, 2, 3]).toContain(2);
expect([{ id: 1 }, { id: 2 }]).toContainEqual({ id: 1 });
expect([1, 2, 3]).toHaveLength(3);

// Objects
expect({ name: 'Alice', age: 30 }).toHaveProperty('name');
expect({ name: 'Alice', age: 30 }).toHaveProperty('name', 'Alice');
expect({ a: 1, b: 2, c: 3 }).toMatchObject({ a: 1, b: 2 }); // partial match
```

### Veracite

```typescript
expect(null).toBeNull();
expect(undefined).toBeUndefined();
expect('hello').toBeDefined();
expect(1).toBeTruthy();
expect(0).toBeFalsy();
```

### Nombres

```typescript
expect(10).toBeGreaterThan(5);
expect(10).toBeGreaterThanOrEqual(10);
expect(5).toBeLessThan(10);
expect(0.1 + 0.2).toBeCloseTo(0.3, 5); // precision flottante !
```

### Exceptions

```typescript
// Synchrone
expect(() => divide(10, 0)).toThrow();
expect(() => divide(10, 0)).toThrow('Division by zero');
expect(() => divide(10, 0)).toThrow(DivisionError);
expect(() => divide(10, 0)).toThrowError(/zero/);

// Asynchrone
await expect(fetchUser(-1)).rejects.toThrow('Not found');
await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alice' });
```

### Negation

```typescript
expect(42).not.toBe(43);
expect([1, 2]).not.toContain(3);
expect('hello').not.toMatch(/world/);
```

---

## Setup et Teardown

### beforeEach / afterEach

```typescript
describe('DatabaseService', () => {
  let db: Database;

  beforeEach(() => {
    // Nouveau contexte pour chaque test — ISOLATION
    db = new Database(':memory:');
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
  });

  afterEach(() => {
    // Nettoyage apres chaque test
    db.close();
  });

  it('should insert a user', () => {
    db.exec("INSERT INTO users (name) VALUES ('Alice')");
    const users = db.query('SELECT * FROM users');
    expect(users).toHaveLength(1);
  });

  it('should start with empty table', () => {
    // Ce test passe car beforeEach recree la DB
    const users = db.query('SELECT * FROM users');
    expect(users).toHaveLength(0);
  });
});
```

### beforeAll / afterAll

Pour les ressources couteuses a créer :

```typescript
describe('API Integration', () => {
  let server: Server;

  beforeAll(async () => {
    // Demarre le serveur UNE FOIS pour tous les tests
    server = await createServer();
    await server.listen(0); // port aleatoire
  });

  afterAll(async () => {
    await server.close();
  });

  // Les tests partagent le meme serveur
  // ATTENTION : risque de partage d'etat entre tests !
});
```

### Ordre d'exécution

```
beforeAll (une fois)
  beforeEach
    it('test 1')
  afterEach
  beforeEach
    it('test 2')
  afterEach
afterAll (une fois)
```

---

## Isolation des tests

### Regle d'or : chaque test doit pouvoir s'exécuter seul, dans n'importe quel ordre.

```typescript
// ❌ MAUVAIS : tests interdependants
describe('Counter', () => {
  const counter = new Counter(); // Partage entre tests !

  it('should start at 0', () => {
    expect(counter.value).toBe(0);
  });

  it('should increment', () => {
    counter.increment();
    expect(counter.value).toBe(1); // Depend du test precedent !
  });

  it('should decrement', () => {
    counter.decrement();
    expect(counter.value).toBe(0); // Depend des 2 tests precedents !
  });
});

// ✓ BON : tests isoles
describe('Counter', () => {
  it('should start at 0', () => {
    const counter = new Counter();
    expect(counter.value).toBe(0);
  });

  it('should increment from 0 to 1', () => {
    const counter = new Counter();
    counter.increment();
    expect(counter.value).toBe(1);
  });

  it('should decrement from 1 to 0', () => {
    const counter = new Counter(1); // Arrange explicite
    counter.decrement();
    expect(counter.value).toBe(0);
  });
});
```

---

## Anti-patterns courants

### 1. Tester l'implementation, pas le comportement

```typescript
// ❌ Teste comment c'est fait
it('should call Array.sort with comparator', () => {
  const spy = vi.spyOn(Array.prototype, 'sort');
  sortUsers(users);
  expect(spy).toHaveBeenCalledWith(expect.any(Function));
});

// ✓ Teste le resultat
it('should sort users by name alphabetically', () => {
  const result = sortUsers([{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }]);
  expect(result.map(u => u.name)).toEqual(['Alice', 'Bob', 'Charlie']);
});
```

### 2. Un test qui teste trop de choses

```typescript
// ❌ Plusieurs comportements dans un test
it('should handle user operations', () => {
  const user = createUser('Alice');
  expect(user.name).toBe('Alice');
  user.updateEmail('new@example.com');
  expect(user.email).toBe('new@example.com');
  user.deactivate();
  expect(user.active).toBe(false);
});

// ✓ Un comportement par test
it('should create user with name', () => { /* ... */ });
it('should update email', () => { /* ... */ });
it('should deactivate user', () => { /* ... */ });
```

### 3. Assertions manquantes

```typescript
// ❌ Teste que ca ne plante pas, mais pas le resultat
it('should process order', () => {
  processOrder(order); // Pas d'assertion !
});

// ✓ Verifie le resultat
it('should process order and return confirmation', () => {
  const result = processOrder(order);
  expect(result.status).toBe('confirmed');
  expect(result.total).toBe(100);
});
```

### 4. Nombres magiques

```typescript
// ❌ D'ou vient 945 ?
expect(cart.getTotal()).toBe(945);

// ✓ Calcul explicite
const expectedTotal = (1000 + 25 * 2) * (1 - 0.1); // 945
expect(cart.getTotal()).toBe(expectedTotal);
```

---

## Exercice pratique : la classe Calculator

```typescript
// src/calculator.ts
export class Calculator {
  private history: number[] = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(result);
    return result;
  }

  subtract(a: number, b: number): number {
    const result = a - b;
    this.history.push(result);
    return result;
  }

  multiply(a: number, b: number): number {
    const result = a * b;
    this.history.push(result);
    return result;
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Cannot divide by zero');
    const result = a / b;
    this.history.push(result);
    return result;
  }

  getHistory(): number[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}
```

**Exercice** : ecrivez la suite de tests complete pour cette classe en appliquant :
- Le pattern AAA
- Des noms descriptifs
- L'isolation (beforeEach)
- La couverture de tous les cas limites (zero, negatifs, flottants)

→ Solution dans le [Lab 02](../labs/lab-02-anatomie-dun-test/)

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [01 - Pourquoi tester](./01-pourquoi-tester) | [03 - Vitest fondamentaux](./03-vitest-fondamentaux) |

---

## Ressources

- [Quiz 02 : Testez vos connaissances](../quizzes/quiz-02-anatomie.html)
- [Lab 02 : Anatomie d'un test](../labs/lab-02-anatomie-dun-test/)
- Martin Fowler — [GivenWhenThen](https://martinfowler.com/bliki/GivenWhenThen.html)
- Roy Osherove — [Naming standards for unit tests](https://osherove.com/blog/2005/4/3/naming-standards-for-unit-tests.html)

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 02 anatomie](../screencasts/screencast-02-anatomie.md)
2. **Lab** : [lab-02-anatomie-dun-test](../labs/lab-02-anatomie-dun-test/README)
3. **Quiz** : [quiz 02 anatomie](../quizzes/quiz-02-anatomie.html)
:::
