# Module 04 — Mocking et test doubles

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 3/5        | 90 min        | [Lab 04](../labs/lab-04-mocking/) | [Quiz 04](../quizzes/quiz-04-mocking.html) |

## Objectifs

- Connaitre la taxonomie des test doubles (dummy, stub, spy, mock, fake)
- Maitriser vi.fn(), vi.spyOn(), vi.mock() et vi.hoisted()
- Savoir mocker des modules, des timers et des dates
- Comprendre le mocking partiel
- Identifier l'anti-pattern du sur-mocking (over-mocking)
- Considerer l'injection de dependances comme alternative

---

## Taxonomie des test doubles

Gerard Meszaros (puis Martin Fowler) definit 5 types de "doublures" de test :

### 1. Dummy

Un objet passe en parametre mais jamais utilise. Il remplit un slot obligatoire.

```typescript
interface Logger {
  info(message: string): void;
  error(message: string): void;
}

// Le dummy logger ne fait rien — on ne teste pas les logs ici
const dummyLogger: Logger = {
  info: () => {},
  error: () => {},
};

function createUserService(logger: Logger): UserService {
  return new UserService(logger);
}

it('should create a user', () => {
  const service = createUserService(dummyLogger); // dummy : pas utilise dans l'assertion
  const user = service.create({ name: 'Alice' });
  expect(user.name).toBe('Alice');
});
```

### 2. Stub

Retourne des reponses predefinies. Ne verifie pas comment il est appele.

```typescript
interface PricingAPI {
  getExchangeRate(from: string, to: string): Promise<number>;
}

// Stub : retourne toujours la meme valeur
const stubPricingAPI: PricingAPI = {
  getExchangeRate: async (_from: string, _to: string) => 1.08, // EUR/USD fixe
};

it('should convert EUR to USD using exchange rate', async () => {
  const converter = new CurrencyConverter(stubPricingAPI);
  const result = await converter.convert(100, 'EUR', 'USD');
  expect(result).toBeCloseTo(108, 2);
});
```

### 3. Spy

Enregistre les appels (arguments, nombre d'appels) sans changer le comportement.

```typescript
it('should log a warning when user has weak password', () => {
  const logger = {
    warn: vi.fn(), // spy : enregistre les appels
    info: vi.fn(),
    error: vi.fn(),
  };

  const validator = new PasswordValidator(logger);
  validator.validate('123'); // mot de passe faible

  // On verifie QUE le spy a ete appele (pas le retour)
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('weak password')
  );
  expect(logger.warn).toHaveBeenCalledTimes(1);
});
```

### 4. Mock

Comme un spy, mais avec des attentes predefinies sur la facon dont il sera appele. L'echec du test vient du mock, pas de l'assertion finale.

```typescript
it('should send exactly one confirmation email', () => {
  const emailService = {
    send: vi.fn(), // mock avec attente
  };

  const orderService = new OrderService(emailService);
  orderService.placeOrder({ item: 'Book', qty: 1 });

  // L'assertion porte sur LE MOCK (comment il a ete utilise)
  expect(emailService.send).toHaveBeenCalledOnce();
  expect(emailService.send).toHaveBeenCalledWith(
    expect.objectContaining({
      subject: expect.stringContaining('Confirmation'),
    })
  );
});
```

### 5. Fake

Une implementation simplifiee mais fonctionnelle. Contrairement au stub, elle a de la logique.

```typescript
// Fake : une base de donnees en memoire
class FakeUserRepository implements UserRepository {
  private users: Map<number, User> = new Map();
  private nextId = 1;

  async findById(id: number): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async save(data: Omit<User, 'id'>): Promise<User> {
    const user = { ...data, id: this.nextId++ };
    this.users.set(user.id, user);
    return user;
  }

  async delete(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async findAll(): Promise<User[]> {
    return [...this.users.values()];
  }
}

describe('UserService with FakeRepository', () => {
  let service: UserService;
  let repo: FakeUserRepository;

  beforeEach(() => {
    repo = new FakeUserRepository();
    service = new UserService(repo);
  });

  it('should create and retrieve a user', async () => {
    const created = await service.create({ name: 'Alice', email: 'alice@test.com' });
    const found = await service.getById(created.id);
    expect(found).toEqual(created);
  });

  it('should return null for non-existent user', async () => {
    const found = await service.getById(999);
    expect(found).toBeNull();
  });
});
```

### Resume : quand utiliser quoi ?

| Type | Comportement | Verification | Cas d'usage |
|------|-------------|--------------|-------------|
| Dummy | Aucun | Non | Remplir un parametre obligatoire |
| Stub | Reponse fixe | Non | Controler les donnees d'entree |
| Spy | Reel + enregistre | Oui (appels) | Verifier les interactions |
| Mock | Configure + enregistre | Oui (attentes) | Verifier le protocole |
| Fake | Simplifie | Non | Remplacer infrastructure (DB, API) |

---

## vi.fn() — mock functions

### Creation et utilisation

```typescript
import { describe, it, expect, vi } from 'vitest';

// Creer une fonction mock
const mockFn = vi.fn();

// Appeler la fonction
mockFn('hello');
mockFn(42, true);

// Verifier les appels
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith('hello');
expect(mockFn).toHaveBeenCalledWith(42, true);
expect(mockFn).toHaveBeenLastCalledWith(42, true);
expect(mockFn).toHaveBeenNthCalledWith(1, 'hello');
```

### mockReturnValue / mockReturnValueOnce

```typescript
const mockRandom = vi.fn();

// Retourne toujours la meme valeur
mockRandom.mockReturnValue(0.5);
expect(mockRandom()).toBe(0.5);
expect(mockRandom()).toBe(0.5);

// Retourne des valeurs differentes en sequence
mockRandom
  .mockReturnValueOnce(0.1)
  .mockReturnValueOnce(0.9)
  .mockReturnValue(0.5); // fallback

expect(mockRandom()).toBe(0.1); // premier appel
expect(mockRandom()).toBe(0.9); // deuxieme appel
expect(mockRandom()).toBe(0.5); // tous les suivants
```

### mockResolvedValue / mockRejectedValue

```typescript
// Pour les fonctions async
const mockFetch = vi.fn();

mockFetch.mockResolvedValue({ id: 1, name: 'Alice' });
const result = await mockFetch(1);
expect(result).toEqual({ id: 1, name: 'Alice' });

// Simuler une erreur
mockFetch.mockRejectedValue(new Error('Network error'));
await expect(mockFetch(1)).rejects.toThrow('Network error');

// Sequence : succes puis echec
mockFetch
  .mockResolvedValueOnce({ id: 1, name: 'Alice' })
  .mockRejectedValueOnce(new Error('Not found'));

expect(await mockFetch(1)).toEqual({ id: 1, name: 'Alice' });
await expect(mockFetch(999)).rejects.toThrow('Not found');
```

### mockImplementation

```typescript
// Implementation complete
const mockCalculate = vi.fn().mockImplementation((a: number, b: number) => {
  return a * b + 10; // logique simplifiee pour le test
});

expect(mockCalculate(3, 4)).toBe(22);

// Implementation differente par appel
const mockFetch = vi.fn()
  .mockImplementationOnce(async (id: number) => {
    if (id === 1) return { id: 1, name: 'Alice' };
    throw new Error('Not found');
  })
  .mockImplementationOnce(async () => {
    throw new Error('Server down');
  });
```

### Inspecter les appels

```typescript
const mockFn = vi.fn();
mockFn('a', 1);
mockFn('b', 2);
mockFn('c', 3);

// .mock.calls — tableau de tous les appels (chaque appel = tableau d'arguments)
expect(mockFn.mock.calls).toEqual([
  ['a', 1],
  ['b', 2],
  ['c', 3],
]);

// .mock.calls[0] — arguments du premier appel
expect(mockFn.mock.calls[0]).toEqual(['a', 1]);

// .mock.results — tableau des resultats
const mockAdd = vi.fn((a: number, b: number) => a + b);
mockAdd(1, 2);
mockAdd(3, 4);
expect(mockAdd.mock.results).toEqual([
  { type: 'return', value: 3 },
  { type: 'return', value: 7 },
]);

// .mock.lastCall — dernier appel
expect(mockFn.mock.lastCall).toEqual(['c', 3]);
```

### Reinitialiser les mocks

```typescript
const mockFn = vi.fn().mockReturnValue(42);
mockFn();

// mockClear — efface l'historique des appels, garde l'implementation
mockFn.mockClear();
expect(mockFn).not.toHaveBeenCalled();
expect(mockFn()).toBe(42); // implementation preservee

// mockReset — efface tout (appels + implementation)
mockFn.mockReset();
expect(mockFn()).toBeUndefined(); // plus d'implementation

// mockRestore — restaure l'implementation originale (utile avec spyOn)
// Voir section vi.spyOn ci-dessous

// Global : dans afterEach
afterEach(() => {
  vi.restoreAllMocks(); // restaure tous les mocks/spies
});
```

---

## vi.spyOn() — espionner des methodes

### Espionner sans modifier

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';

const calculator = {
  add(a: number, b: number): number {
    return a + b;
  },
  multiply(a: number, b: number): number {
    return a * b;
  },
};

describe('Calculator spy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should track calls to add', () => {
    const spy = vi.spyOn(calculator, 'add');

    const result = calculator.add(2, 3);

    // Le comportement original est preserve
    expect(result).toBe(5);

    // Mais on peut verifier les appels
    expect(spy).toHaveBeenCalledWith(2, 3);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

### Espionner et remplacer

```typescript
it('should override the implementation', () => {
  const spy = vi.spyOn(calculator, 'multiply').mockReturnValue(999);

  const result = calculator.multiply(2, 3);

  expect(result).toBe(999); // valeur mockee
  expect(spy).toHaveBeenCalledWith(2, 3);
});
```

### Espionner console, Math, Date

```typescript
describe('console spy', () => {
  it('should spy on console.error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logError('Something went wrong');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Something went wrong')
    );
  });
});

describe('Math spy', () => {
  it('should control Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);

    const result = generateId(); // utilise Math.random() internement
    expect(result).toBe('42'); // deterministe
  });
});
```

### Espionner des getters et setters

```typescript
const config = {
  _theme: 'light' as string,
  get theme(): string {
    return this._theme;
  },
  set theme(value: string) {
    this._theme = value;
  },
};

it('should spy on getter', () => {
  const spy = vi.spyOn(config, 'theme', 'get').mockReturnValue('dark');
  expect(config.theme).toBe('dark');
  expect(spy).toHaveBeenCalled();
});

it('should spy on setter', () => {
  const spy = vi.spyOn(config, 'theme', 'set');
  config.theme = 'dark';
  expect(spy).toHaveBeenCalledWith('dark');
});
```

---

## vi.mock() — mocker des modules

### Auto-mocking

```typescript
// vi.mock remplace TOUT le module par des vi.fn()
vi.mock('./user-repository');

import { UserRepository } from './user-repository';
// Toutes les fonctions exportees sont des vi.fn()

it('should call repository', () => {
  const repo = new UserRepository();
  // repo.findById est un vi.fn() — retourne undefined par defaut

  // On peut configurer le retour
  vi.mocked(repo.findById).mockResolvedValue({ id: 1, name: 'Alice' });

  // ...
});
```

### Mock avec factory

```typescript
// Fournir une implementation mock
vi.mock('./email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'abc-123' }),
  sendBulkEmails: vi.fn().mockResolvedValue({ sent: 5, failed: 0 }),
}));

import { sendEmail, sendBulkEmails } from './email-service';

describe('OrderService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should send confirmation email after order', async () => {
    const orderService = new OrderService();
    await orderService.placeOrder({ item: 'Book', qty: 1 });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.any(String),
        subject: expect.stringContaining('Confirmation'),
      })
    );
  });
});
```

### Mock de module par defaut (default export)

```typescript
// src/services/analytics.ts
export default class Analytics {
  track(event: string, data: Record<string, unknown>): void { /* ... */ }
  identify(userId: string): void { /* ... */ }
}

// Dans le test
vi.mock('./services/analytics', () => ({
  default: vi.fn().mockImplementation(() => ({
    track: vi.fn(),
    identify: vi.fn(),
  })),
}));

import Analytics from './services/analytics';

it('should track order event', () => {
  const analytics = new Analytics();
  const service = new OrderService(analytics);

  service.placeOrder({ item: 'Book' });

  expect(analytics.track).toHaveBeenCalledWith('order_placed', { item: 'Book' });
});
```

---

## vi.hoisted() — hoisting des variables mock

`vi.mock()` est hisse (hoisted) en haut du fichier par Vitest. Cela pose un probleme si la factory utilise des variables :

```typescript
// PROBLEME : mockFn n'est pas encore defini quand vi.mock est hisse
const mockFn = vi.fn();

vi.mock('./module', () => ({
  doSomething: mockFn, // ReferenceError !
}));
```

Solution avec `vi.hoisted()` :

```typescript
// vi.hoisted() est AUSSI hisse, mais AVANT vi.mock
const { mockDoSomething } = vi.hoisted(() => ({
  mockDoSomething: vi.fn(),
}));

vi.mock('./module', () => ({
  doSomething: mockDoSomething,
}));

import { doSomething } from './module';
// doSomething === mockDoSomething

it('should call doSomething', () => {
  mockDoSomething.mockReturnValue(42);
  expect(doSomething()).toBe(42);
});
```

### Ordre d'execution reel

```typescript
// Ce que vous ecrivez :
import { foo } from './foo';
const { mockBar } = vi.hoisted(() => ({ mockBar: vi.fn() }));
vi.mock('./bar', () => ({ bar: mockBar }));
import { bar } from './bar';

// Ce que Vitest execute reellement :
// 1. vi.hoisted(() => ({ mockBar: vi.fn() }))  — declare mockBar
// 2. vi.mock('./bar', () => ({ bar: mockBar })) — enregistre le mock
// 3. import { foo } from './foo'                — charge foo (reel)
// 4. import { bar } from './bar'                — charge bar (mock)
```

---

## Mocking partiel

Parfois on veut mocker UNE fonction d'un module et garder le reste reel :

```typescript
// src/utils/math.ts
export function add(a: number, b: number): number { return a + b; }
export function multiply(a: number, b: number): number { return a * b; }
export function complexCalculation(x: number): number {
  return multiply(add(x, 10), 2); // utilise add et multiply
}
```

```typescript
// Mock partiel : seulement multiply
vi.mock('./utils/math', async (importOriginal) => {
  const original = await importOriginal<typeof import('./utils/math')>();
  return {
    ...original,                              // garder add et complexCalculation
    multiply: vi.fn().mockReturnValue(100),   // mocker multiply
  };
});

import { add, multiply, complexCalculation } from './utils/math';

it('add should still work normally', () => {
  expect(add(2, 3)).toBe(5); // implementation reelle
});

it('multiply is mocked', () => {
  expect(multiply(2, 3)).toBe(100); // valeur mockee
});
```

---

## Timer mocking

### vi.useFakeTimers / vi.useRealTimers

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not call function before delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();

    // 299ms plus tard
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should call function after delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should reset timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(200);
    debounced(); // reset le timer
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled(); // seulement 200ms depuis le dernier appel

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should pass arguments to the original function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('hello', 42);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('hello', 42);
  });
});
```

### Autres methodes de controle des timers

```typescript
describe('Timer control methods', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('advanceTimersByTime — avance de N ms', () => {
    const fn = vi.fn();
    setTimeout(fn, 1000);

    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('advanceTimersToNextTimer — saute au prochain timer', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    setTimeout(fn1, 100);
    setTimeout(fn2, 200);

    vi.advanceTimersToNextTimer();
    expect(fn1).toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();

    vi.advanceTimersToNextTimer();
    expect(fn2).toHaveBeenCalled();
  });

  it('runAllTimers — execute tous les timers en attente', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const fn3 = vi.fn();

    setTimeout(fn1, 100);
    setTimeout(fn2, 500);
    setTimeout(fn3, 1000);

    vi.runAllTimers();

    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
    expect(fn3).toHaveBeenCalled();
  });

  it('getTimerCount — nombre de timers en attente', () => {
    setTimeout(() => {}, 100);
    setTimeout(() => {}, 200);
    setInterval(() => {}, 300);

    expect(vi.getTimerCount()).toBe(3);

    vi.advanceTimersByTime(100);
    expect(vi.getTimerCount()).toBe(2); // le premier setTimeout a fire
  });
});
```

---

## Date mocking

### vi.setSystemTime

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for recent dates', () => {
    const date = new Date('2025-06-15T11:59:45Z'); // 15 secondes avant
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('should return minutes ago', () => {
    const date = new Date('2025-06-15T11:30:00Z'); // 30 minutes avant
    expect(formatRelativeTime(date)).toBe('30m ago');
  });

  it('should return hours ago', () => {
    const date = new Date('2025-06-15T09:00:00Z'); // 3 heures avant
    expect(formatRelativeTime(date)).toBe('3h ago');
  });

  it('should return days ago', () => {
    const date = new Date('2025-06-12T12:00:00Z'); // 3 jours avant
    expect(formatRelativeTime(date)).toBe('3d ago');
  });
});
```

### Tester du code qui depend de la date courante

```typescript
function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

describe('Date-dependent functions', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('isWeekend returns true on Saturday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-14T10:00:00Z')); // samedi
    expect(isWeekend()).toBe(true);
  });

  it('isWeekend returns false on Monday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-16T10:00:00Z')); // lundi
    expect(isWeekend()).toBe(false);
  });

  it.each([
    ['2025-06-15T08:00:00Z', 'Good morning'],
    ['2025-06-15T14:00:00Z', 'Good afternoon'],
    ['2025-06-15T20:00:00Z', 'Good evening'],
  ])('at %s should greet "%s"', (dateStr, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(dateStr));
    expect(getGreeting()).toBe(expected);
  });
});
```

---

## Exemple complet : mocker fetch

```typescript
// src/services/api-client.ts
interface ApiResponse<T> {
  data: T;
  status: number;
}

export async function fetchJSON<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return { data: data as T, status: response.status };
}
```

```typescript
// src/services/api-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJSON } from './api-client';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchJSON', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return parsed JSON data on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, name: 'Alice' }),
    });

    const result = await fetchJSON<{ id: number; name: string }>('/api/users/1');

    expect(result).toEqual({
      data: { id: 1, name: 'Alice' },
      status: 200,
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/users/1');
  });

  it('should throw on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(fetchJSON('/api/users/999')).rejects.toThrow('HTTP 404: Not Found');
  });

  it('should throw on network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchJSON('/api/users/1')).rejects.toThrow('Failed to fetch');
  });
});
```

---

## Exemple complet : mocker un module de base de donnees

```typescript
// src/repositories/user-repository.ts
import { db } from '../database/connection';

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export async function findUserById(id: number): Promise<User | null> {
  const row = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return row.rows[0] ?? null;
}

export async function createUser(name: string, email: string): Promise<User> {
  const result = await db.query(
    'INSERT INTO users (name, email, created_at) VALUES ($1, $2, NOW()) RETURNING *',
    [name, email]
  );
  return result.rows[0];
}
```

```typescript
// src/repositories/user-repository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock le module database
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('../database/connection', () => ({
  db: {
    query: mockQuery,
  },
}));

import { findUserById, createUser } from './user-repository';

describe('UserRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findUserById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: 1, name: 'Alice', email: 'alice@test.com', createdAt: new Date() };
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const user = await findUserById(1);

      expect(user).toEqual(mockUser);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [1]
      );
    });

    it('should return null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const user = await findUserById(999);

      expect(user).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should insert and return the new user', async () => {
      const newUser = { id: 42, name: 'Bob', email: 'bob@test.com', createdAt: new Date() };
      mockQuery.mockResolvedValue({ rows: [newUser] });

      const user = await createUser('Bob', 'bob@test.com');

      expect(user).toEqual(newUser);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['Bob', 'bob@test.com']
      );
    });
  });
});
```

---

## Quand mocker vs utiliser les vrais composants

### Mocker quand :

1. **I/O externe** : reseau, base de donnees, systeme de fichiers
2. **Non-determinisme** : Date.now(), Math.random(), crypto
3. **Lenteur** : appels API, timers longs
4. **Effets de bord** : envoi d'email, paiement, logs

### Ne PAS mocker quand :

1. **Logique pure** : calculs, transformations, validations
2. **Modules internes simples** : utils, helpers
3. **Types de donnees** : classes POJO, DTO

```typescript
// MAUVAIS : mocker ce qui devrait etre teste directement
vi.mock('./price-calculator'); // Pourquoi mocker le coeur de la logique ?

// BON : tester la logique pure sans mock
import { calculatePrice } from './price-calculator';

it('should calculate discounted price', () => {
  expect(calculatePrice(100, { discount: 0.2 })).toBe(80);
});
```

---

## Anti-pattern : over-mocking

```typescript
// MAUVAIS : tout est mocke, le test ne verifie rien de reel
vi.mock('./validator');
vi.mock('./formatter');
vi.mock('./repository');
vi.mock('./emailer');
vi.mock('./logger');

it('should create order', async () => {
  vi.mocked(validator.validate).mockReturnValue(true);
  vi.mocked(formatter.format).mockReturnValue('formatted');
  vi.mocked(repository.save).mockResolvedValue({ id: 1 });
  vi.mocked(emailer.send).mockResolvedValue(undefined);

  await createOrder(data);

  // On teste juste que les mocks sont appeles dans le bon ordre
  // Mais on ne teste PAS le comportement reel !
  expect(validator.validate).toHaveBeenCalled();
  expect(repository.save).toHaveBeenCalled();
  expect(emailer.send).toHaveBeenCalled();
});

// BON : ne mocker que l'infrastructure, garder la logique reelle
vi.mock('./repository');   // I/O
vi.mock('./emailer');      // I/O

it('should create order with correct total', async () => {
  vi.mocked(repository.save).mockResolvedValue({ id: 1 });
  vi.mocked(emailer.send).mockResolvedValue(undefined);

  const order = await createOrder({
    items: [{ price: 100, qty: 2 }, { price: 50, qty: 1 }],
    discount: 0.1,
  });

  // On verifie la LOGIQUE reelle (calcul du total)
  expect(repository.save).toHaveBeenCalledWith(
    expect.objectContaining({ total: 225 }) // (200 + 50) * 0.9
  );
});
```

---

## L'injection de dependances comme alternative

Au lieu de mocker des modules avec `vi.mock()`, on peut injecter les dependances :

```typescript
// SANS injection (difficile a tester)
import { db } from './database';
import { sendEmail } from './email-service';

export async function registerUser(name: string, email: string): Promise<User> {
  const user = await db.insert('users', { name, email });
  await sendEmail(email, 'Welcome!');
  return user;
}

// AVEC injection (facile a tester)
interface Dependencies {
  db: Database;
  emailService: EmailService;
}

export function createRegistrationService(deps: Dependencies) {
  return {
    async registerUser(name: string, email: string): Promise<User> {
      const user = await deps.db.insert('users', { name, email });
      await deps.emailService.send(email, 'Welcome!');
      return user;
    },
  };
}

// Dans le test : pas besoin de vi.mock()
it('should register user and send email', async () => {
  const mockDb = { insert: vi.fn().mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@test.com' }) };
  const mockEmail = { send: vi.fn().mockResolvedValue(undefined) };

  const service = createRegistrationService({
    db: mockDb as unknown as Database,
    emailService: mockEmail as unknown as EmailService,
  });

  const user = await service.registerUser('Alice', 'alice@test.com');

  expect(user.name).toBe('Alice');
  expect(mockEmail.send).toHaveBeenCalledWith('alice@test.com', 'Welcome!');
});
```

L'injection de dependances sera approfondie dans le Module 06.

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| [03 - Vitest fondamentaux](./03-vitest-fondamentaux) | [05 - Tests asynchrones](./05-tests-asynchrones) |

---

## Ressources

- [Quiz 04 : Testez vos connaissances](../quizzes/quiz-04-mocking.html)
- [Lab 04 : Mocking](../labs/lab-04-mocking/)
- Martin Fowler — [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html)
- Gerard Meszaros — [Test Double](http://xunitpatterns.com/Test%20Double.html)
- [Documentation Vitest : vi](https://vitest.dev/api/vi.html)
- [Documentation Vitest : Mock Functions](https://vitest.dev/api/mock.html)
