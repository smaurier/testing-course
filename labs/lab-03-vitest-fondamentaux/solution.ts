// =============================================================================
// Lab 03 — Vitest fondamentaux (Solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Matchers de base
// =============================================================================

function isStrictlyEqual(a: unknown, b: unknown): boolean {
  return a === b;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function containsItem<T>(arr: T[], item: T): boolean {
  return arr.includes(item);
}

function matchesPattern(str: string, pattern: RegExp): boolean {
  return pattern.test(str);
}

function throwsError(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

// =============================================================================
// Exercise 2: FizzBuzz avec tests parametres
// =============================================================================

function fizzbuzz(n: number): string {
  if (n % 15 === 0) return 'FizzBuzz';
  if (n % 3 === 0) return 'Fizz';
  if (n % 5 === 0) return 'Buzz';
  return String(n);
}

interface FizzBuzzTestCase {
  input: number;
  expected: string;
}

function getFizzBuzzTestCases(): FizzBuzzTestCase[] {
  return [
    { input: 1, expected: '1' },
    { input: 2, expected: '2' },
    { input: 3, expected: 'Fizz' },
    { input: 5, expected: 'Buzz' },
    { input: 6, expected: 'Fizz' },
    { input: 10, expected: 'Buzz' },
    { input: 15, expected: 'FizzBuzz' },
    { input: 30, expected: 'FizzBuzz' },
    { input: 7, expected: '7' },
    { input: 9, expected: 'Fizz' },
  ];
}

// =============================================================================
// Exercise 3: Snapshot testing
// =============================================================================

interface User {
  name: string;
  email: string;
  role: string;
  joinDate: string;
}

function createUserSummary(user: User): string {
  return [
    `=== User Profile ===`,
    `Name:      ${user.name}`,
    `Email:     ${user.email}`,
    `Role:      ${user.role}`,
    `Joined:    ${user.joinDate}`,
    `====================`,
  ].join('\n');
}

// =============================================================================
// Exercise 4: Matcher personnalise toBeWithinRange
// =============================================================================

function isWithinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// =============================================================================
// Exercise 5: Filtrage de tests (skip / todo)
// =============================================================================

function add(a: number, b: number): number {
  return a + b;
}

function subtract(a: number, b: number): number {
  return a - b;
}

// Placeholder for future feature — would be .todo in Vitest
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
  private todos: Todo[] = [];
  private nextId = 1;

  add(title: string): Todo {
    const todo: Todo = { id: this.nextId++, title, completed: false };
    this.todos.push(todo);
    return { ...todo };
  }

  toggle(id: number): void {
    const todo = this.todos.find(t => t.id === id);
    if (!todo) throw new Error(`Todo ${id} not found`);
    todo.completed = !todo.completed;
  }

  remove(id: number): void {
    const idx = this.todos.findIndex(t => t.id === id);
    if (idx === -1) throw new Error(`Todo ${id} not found`);
    this.todos.splice(idx, 1);
  }

  getAll(): Todo[] {
    return this.todos.map(t => ({ ...t }));
  }

  getCompleted(): Todo[] {
    return this.todos.filter(t => t.completed).map(t => ({ ...t }));
  }

  getPending(): Todo[] {
    return this.todos.filter(t => !t.completed).map(t => ({ ...t }));
  }

  clear(): void {
    this.todos = [];
    this.nextId = 1;
  }
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assertDeepEqual, assert, run } = createTestRunner('Lab 03 — Vitest fondamentaux');

// --- Exercise 1: Matchers ---
await test('Ex1: strict equality (===)', () => {
  assert(isStrictlyEqual(1, 1));
  assert(isStrictlyEqual('hello', 'hello'));
  assert(!isStrictlyEqual(1, '1' as unknown));
  assert(!isStrictlyEqual(null, undefined));
});

await test('Ex1: deep equality', () => {
  assert(isDeepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }));
  assert(!isDeepEqual({ a: 1 }, { a: 2 }));
  assert(isDeepEqual([1, 2, 3], [1, 2, 3]));
});

await test('Ex1: contains item in array', () => {
  assert(containsItem([1, 2, 3], 2));
  assert(containsItem(['a', 'b'], 'a'));
  assert(!containsItem([1, 2, 3], 4));
});

await test('Ex1: matches regex pattern', () => {
  assert(matchesPattern('hello@test.com', /^\S+@\S+\.\S+$/));
  assert(matchesPattern('2024-01-15', /^\d{4}-\d{2}-\d{2}$/));
  assert(!matchesPattern('not-an-email', /^\S+@\S+\.\S+$/));
});

await test('Ex1: detects thrown errors', () => {
  assert(throwsError(() => { throw new Error('boom'); }));
  assert(!throwsError(() => 'ok'));
});

// --- Exercise 2: FizzBuzz parametrise ---
await test('Ex2: fizzbuzz basic values', () => {
  assertEqual(fizzbuzz(1), '1');
  assertEqual(fizzbuzz(3), 'Fizz');
  assertEqual(fizzbuzz(5), 'Buzz');
  assertEqual(fizzbuzz(15), 'FizzBuzz');
});

await test('Ex2: parametrized test cases (.each pattern)', () => {
  const cases = getFizzBuzzTestCases();
  assert(cases.length >= 8, `Expected at least 8 test cases, got ${cases.length}`);
  for (const { input, expected } of cases) {
    assertEqual(fizzbuzz(input), expected, `fizzbuzz(${input}) should be "${expected}"`);
  }
});

await test('Ex2: fizzbuzz with multiples of 3 only', () => {
  assertEqual(fizzbuzz(9), 'Fizz');
  assertEqual(fizzbuzz(12), 'Fizz');
});

await test('Ex2: fizzbuzz with multiples of 5 only', () => {
  assertEqual(fizzbuzz(10), 'Buzz');
  assertEqual(fizzbuzz(20), 'Buzz');
});

// --- Exercise 3: Snapshot testing ---
await test('Ex3: user summary contains all fields', () => {
  const user: User = { name: 'Alice', email: 'alice@example.com', role: 'admin', joinDate: '2024-01-15' };
  const summary = createUserSummary(user);
  assert(summary.includes('Alice'), 'Should include name');
  assert(summary.includes('alice@example.com'), 'Should include email');
  assert(summary.includes('admin'), 'Should include role');
  assert(summary.includes('2024-01-15'), 'Should include join date');
});

await test('Ex3: snapshot consistency (same input = same output)', () => {
  const user: User = { name: 'Bob', email: 'bob@test.com', role: 'user', joinDate: '2024-06-01' };
  const s1 = createUserSummary(user);
  const s2 = createUserSummary(user);
  assertEqual(s1, s2);
});

await test('Ex3: snapshot format verification', () => {
  const user: User = { name: 'Charlie', email: 'c@test.com', role: 'editor', joinDate: '2024-03-10' };
  const expected = [
    '=== User Profile ===',
    'Name:      Charlie',
    'Email:     c@test.com',
    'Role:      editor',
    'Joined:    2024-03-10',
    '====================',
  ].join('\n');
  assertEqual(createUserSummary(user), expected);
});

// --- Exercise 4: Matcher personnalise ---
await test('Ex4: value within range (inclusive)', () => {
  assert(isWithinRange(5, 1, 10));
  assert(isWithinRange(1, 1, 10));
  assert(isWithinRange(10, 1, 10));
});

await test('Ex4: value outside range', () => {
  assert(!isWithinRange(0, 1, 10));
  assert(!isWithinRange(11, 1, 10));
  assert(!isWithinRange(-1, 0, 100));
});

await test('Ex4: edge case — single value range', () => {
  assert(isWithinRange(5, 5, 5));
  assert(!isWithinRange(4, 5, 5));
});

// --- Exercise 5: Filtrage de tests ---
await test('Ex5: add works correctly', () => {
  assertEqual(add(2, 3), 5);
  assertEqual(add(-1, 1), 0);
  assertEqual(add(0, 0), 0);
});

await test('Ex5: subtract works correctly', () => {
  assertEqual(subtract(10, 4), 6);
  assertEqual(subtract(0, 0), 0);
  assertEqual(subtract(5, 10), -5);
});

// Note: In real Vitest, multiply would be marked with it.todo('multiply')
// Here we simulate skip/todo by not including those tests

// --- Exercise 6: TodoList complete ---
await test('Ex6: add creates a new todo', () => {
  const list = new TodoList();
  const todo = list.add('Buy milk');
  assertEqual(todo.title, 'Buy milk');
  assert(!todo.completed);
  assert(todo.id > 0);
});

await test('Ex6: add assigns unique IDs', () => {
  const list = new TodoList();
  const t1 = list.add('First');
  const t2 = list.add('Second');
  assert(t1.id !== t2.id, 'IDs should be unique');
});

await test('Ex6: toggle flips completed state', () => {
  const list = new TodoList();
  const todo = list.add('Task');
  list.toggle(todo.id);
  assert(list.getAll()[0].completed, 'Should be completed after toggle');
  list.toggle(todo.id);
  assert(!list.getAll()[0].completed, 'Should be uncompleted after second toggle');
});

await test('Ex6: remove deletes a todo', () => {
  const list = new TodoList();
  const todo = list.add('To remove');
  list.add('To keep');
  list.remove(todo.id);
  assertEqual(list.getAll().length, 1);
  assertEqual(list.getAll()[0].title, 'To keep');
});

await test('Ex6: getCompleted / getPending filters', () => {
  const list = new TodoList();
  const t1 = list.add('Done task');
  list.add('Pending task');
  list.toggle(t1.id);
  assertEqual(list.getCompleted().length, 1);
  assertEqual(list.getPending().length, 1);
  assertEqual(list.getCompleted()[0].title, 'Done task');
  assertEqual(list.getPending()[0].title, 'Pending task');
});

await test('Ex6: clear resets everything', () => {
  const list = new TodoList();
  list.add('A');
  list.add('B');
  list.clear();
  assertEqual(list.getAll().length, 0);
});

await test('Ex6: toggle non-existent throws', () => {
  const list = new TodoList();
  let threw = false;
  try { list.toggle(999); } catch { threw = true; }
  assert(threw, 'Should throw for non-existent todo');
});

await test('Ex6: remove non-existent throws', () => {
  const list = new TodoList();
  let threw = false;
  try { list.remove(999); } catch { threw = true; }
  assert(threw, 'Should throw for non-existent todo');
});

await test('Ex6: getAll returns copies (immutability)', () => {
  const list = new TodoList();
  list.add('Test');
  const all = list.getAll();
  all[0].title = 'Modified';
  assertEqual(list.getAll()[0].title, 'Test');
});

assertDeepEqual; // referenced to avoid unused import warning

run();
