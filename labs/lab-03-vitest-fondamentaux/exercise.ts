// =============================================================================
// Lab 03 — Vitest fondamentaux (Exercices)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Matchers de base
// Implementez ces fonctions pour exercer differents types de comparaisons
// =============================================================================

function isStrictlyEqual(_a: unknown, _b: unknown): boolean {
  // TODO: strict equality (===)
  throw new Error('Not implemented');
}

function isDeepEqual(_a: unknown, _b: unknown): boolean {
  // TODO: deep equality (JSON comparison)
  throw new Error('Not implemented');
}

function containsItem<T>(_arr: T[], _item: T): boolean {
  // TODO: array includes
  throw new Error('Not implemented');
}

function matchesPattern(_str: string, _pattern: RegExp): boolean {
  // TODO: regex test
  throw new Error('Not implemented');
}

function throwsError(_fn: () => void): boolean {
  // TODO: returns true if fn throws
  throw new Error('Not implemented');
}

// =============================================================================
// Exercise 2: FizzBuzz avec tests parametres
// Implementez fizzbuzz(n) et les donnees de test
// =============================================================================

function fizzbuzz(_n: number): string {
  // TODO: implementez fizzbuzz
  throw new Error('Not implemented');
}

interface FizzBuzzTestCase {
  input: number;
  expected: string;
}

function getFizzBuzzTestCases(): FizzBuzzTestCase[] {
  // TODO: retournez au moins 8 cas de test couvrant tous les scenarios
  throw new Error('Not implemented');
}

// =============================================================================
// Exercise 3: Snapshot testing
// Implementez createUserSummary qui retourne un texte formate
// =============================================================================

interface User {
  name: string;
  email: string;
  role: string;
  joinDate: string;
}

function createUserSummary(_user: User): string {
  // TODO: retournez un texte formate multi-lignes
  throw new Error('Not implemented');
}

// =============================================================================
// Exercise 4: Matcher personnalise toBeWithinRange
// =============================================================================

function isWithinRange(_value: number, _min: number, _max: number): boolean {
  // TODO: implementez la verification de plage
  throw new Error('Not implemented');
}

// =============================================================================
// Exercise 5: Filtrage de tests (skip / todo)
// Implementez les fonctions et marquez les tests correctement
// =============================================================================

function add(_a: number, _b: number): number {
  // TODO
  throw new Error('Not implemented');
}

function subtract(_a: number, _b: number): number {
  // TODO
  throw new Error('Not implemented');
}

// These are placeholder for future features
function _multiply(_a: number, _b: number): number {
  throw new Error('Not implemented yet');
}

// =============================================================================
// Exercise 6: TodoList complete
// =============================================================================

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

class TodoList {
  // TODO: implementez la classe complete
  add(_title: string): Todo { throw new Error('Not implemented'); }
  toggle(_id: number): void { throw new Error('Not implemented'); }
  remove(_id: number): void { throw new Error('Not implemented'); }
  getAll(): Todo[] { throw new Error('Not implemented'); }
  getCompleted(): Todo[] { throw new Error('Not implemented'); }
  getPending(): Todo[] { throw new Error('Not implemented'); }
  clear(): void { throw new Error('Not implemented'); }
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assertDeepEqual, assert, assertThrows, run } = createTestRunner('Lab 03 — Vitest fondamentaux');

// --- Exercise 1 ---
await test('Ex1: strict equality', () => {
  assert(isStrictlyEqual(1, 1));
  assert(!isStrictlyEqual(1, '1'));
});
await test('Ex1: deep equality', () => {
  assert(isDeepEqual({ a: 1 }, { a: 1 }));
  assert(!isDeepEqual({ a: 1 }, { a: 2 }));
});
await test('Ex1: contains item', () => {
  assert(containsItem([1, 2, 3], 2));
  assert(!containsItem([1, 2, 3], 4));
});
await test('Ex1: matches pattern', () => {
  assert(matchesPattern('hello@test.com', /^\S+@\S+\.\S+$/));
});
await test('Ex1: throws error', () => {
  assert(throwsError(() => { throw new Error('boom'); }));
  assert(!throwsError(() => 'ok'));
});

// --- Exercise 2 ---
await test('Ex2: fizzbuzz basic cases', () => {
  assertEqual(fizzbuzz(1), '1');
  assertEqual(fizzbuzz(3), 'Fizz');
  assertEqual(fizzbuzz(5), 'Buzz');
  assertEqual(fizzbuzz(15), 'FizzBuzz');
});
await test('Ex2: parametrized test cases cover all scenarios', () => {
  const cases = getFizzBuzzTestCases();
  assert(cases.length >= 8, `Expected at least 8 test cases, got ${cases.length}`);
  for (const { input, expected } of cases) {
    assertEqual(fizzbuzz(input), expected, `fizzbuzz(${input}) should be ${expected}`);
  }
});

// --- Exercise 3 ---
await test('Ex3: user summary snapshot', () => {
  const user: User = { name: 'Alice', email: 'alice@example.com', role: 'admin', joinDate: '2024-01-15' };
  const summary = createUserSummary(user);
  assert(summary.includes('Alice'), 'Should include name');
  assert(summary.includes('alice@example.com'), 'Should include email');
  assert(summary.includes('admin'), 'Should include role');
});
await test('Ex3: snapshot consistency', () => {
  const user: User = { name: 'Bob', email: 'bob@test.com', role: 'user', joinDate: '2024-06-01' };
  const s1 = createUserSummary(user);
  const s2 = createUserSummary(user);
  assertEqual(s1, s2);
});

// --- Exercise 4 ---
await test('Ex4: within range true', () => {
  assert(isWithinRange(5, 1, 10));
  assert(isWithinRange(1, 1, 10));
  assert(isWithinRange(10, 1, 10));
});
await test('Ex4: within range false', () => {
  assert(!isWithinRange(0, 1, 10));
  assert(!isWithinRange(11, 1, 10));
});

// --- Exercise 5 ---
await test('Ex5: add works correctly', () => {
  assertEqual(add(2, 3), 5);
});
await test('Ex5: subtract works correctly', () => {
  assertEqual(subtract(10, 4), 6);
});
// Note: multiply is intentionally not tested (would be .todo in Vitest)

// --- Exercise 6 ---
await test('Ex6: add todo', () => {
  const list = new TodoList();
  const todo = list.add('Buy milk');
  assertEqual(todo.title, 'Buy milk');
  assert(!todo.completed);
});
await test('Ex6: toggle todo', () => {
  const list = new TodoList();
  const todo = list.add('Task');
  list.toggle(todo.id);
  assert(list.getAll()[0].completed);
});
await test('Ex6: remove todo', () => {
  const list = new TodoList();
  const todo = list.add('Task');
  list.remove(todo.id);
  assertEqual(list.getAll().length, 0);
});
await test('Ex6: filter completed and pending', () => {
  const list = new TodoList();
  list.add('Done task');
  const t2 = list.add('Pending task');
  list.toggle(list.getAll()[0].id);
  assertEqual(list.getCompleted().length, 1);
  assertEqual(list.getPending().length, 1);
  assertEqual(list.getPending()[0].id, t2.id);
});

run();
