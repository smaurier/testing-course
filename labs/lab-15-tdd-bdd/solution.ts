// =============================================================================
// Lab 15 — TDD Kata and BDD Patterns (solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// -----------------------------------------------------------------------------
// Exercice 1 — TDD Stack
// -----------------------------------------------------------------------------

export class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T {
    if (this.items.length === 0) throw new Error('Stack is empty');
    return this.items.pop()!;
  }

  peek(): T {
    if (this.items.length === 0) throw new Error('Stack is empty');
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }
}

// -----------------------------------------------------------------------------
// Exercice 2 — TDD RomanNumerals converter
// -----------------------------------------------------------------------------

export function toRoman(num: number): string {
  const mapping: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];

  let result = '';
  let remaining = num;

  for (const [value, symbol] of mapping) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// Exercice 3 — BDD Given-When-Then runner
// -----------------------------------------------------------------------------

interface BddStep {
  type: 'given' | 'when' | 'then';
  description: string;
  fn: (context: Record<string, unknown>) => void | Promise<void>;
}

interface ScenarioResult {
  name: string;
  steps: Array<{ type: string; description: string; status: 'passed' | 'failed'; error?: string }>;
  status: 'passed' | 'failed';
}

export function createScenario(name: string) {
  const steps: BddStep[] = [];

  const builder = {
    given(description: string, fn: (context: Record<string, unknown>) => void | Promise<void>) {
      steps.push({ type: 'given', description, fn });
      return builder;
    },
    when(description: string, fn: (context: Record<string, unknown>) => void | Promise<void>) {
      steps.push({ type: 'when', description, fn });
      return builder;
    },
    then(description: string, fn: (context: Record<string, unknown>) => void | Promise<void>) {
      steps.push({ type: 'then', description, fn });
      return builder;
    },
    async run(): Promise<ScenarioResult> {
      const context: Record<string, unknown> = {};
      const results: ScenarioResult['steps'] = [];
      let failed = false;

      for (const step of steps) {
        if (failed) {
          results.push({ type: step.type, description: step.description, status: 'failed', error: 'Skipped due to previous failure' });
          continue;
        }
        try {
          await step.fn(context);
          results.push({ type: step.type, description: step.description, status: 'passed' });
        } catch (err) {
          failed = true;
          results.push({
            type: step.type,
            description: step.description,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return {
        name,
        steps: results,
        status: failed ? 'failed' : 'passed',
      };
    },
  };

  return builder;
}

// -----------------------------------------------------------------------------
// Exercice 4 — Step definitions registry
// -----------------------------------------------------------------------------

export function createStepRegistry() {
  const definitions: Array<{
    type: string;
    pattern: RegExp;
    fn: (ctx: Record<string, unknown>, ...captures: string[]) => void | Promise<void>;
  }> = [];

  return {
    defineStep(
      type: string,
      pattern: RegExp,
      fn: (ctx: Record<string, unknown>, ...captures: string[]) => void | Promise<void>
    ): void {
      definitions.push({ type, pattern, fn });
    },

    resolve(type: string, text: string): { fn: (ctx: Record<string, unknown>, ...captures: string[]) => void | Promise<void>; captures: string[] } | undefined {
      for (const def of definitions) {
        if (def.type !== type) continue;
        const match = text.match(def.pattern);
        if (match) {
          return { fn: def.fn, captures: match.slice(1) };
        }
      }
      return undefined;
    },

    async execute(type: string, text: string, context: Record<string, unknown>): Promise<void> {
      const match = this.resolve(type, text);
      if (!match) throw new Error(`No step definition found for [${type}] "${text}"`);
      await match.fn(context, ...match.captures);
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 5 — TDD outside-in: UserRegistration
// -----------------------------------------------------------------------------

interface User {
  id: string;
  email: string;
  name: string;
}

interface UserRepository {
  save(user: User): void;
  findByEmail(email: string): User | undefined;
}

interface EmailValidator {
  isValid(email: string): boolean;
}

let _idCounter = 0;

export function createUserRegistration(repo: UserRepository, validator: EmailValidator) {
  return {
    register(email: string, name: string): User {
      if (!validator.isValid(email)) {
        throw new Error(`invalid email: ${email}`);
      }

      const existing = repo.findByEmail(email);
      if (existing) {
        throw new Error(`Email already taken: ${email}`);
      }

      const user: User = {
        id: `user-${++_idCounter}`,
        email,
        name,
      };

      repo.save(user);
      return user;
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 6 — Bowling score calculator
// -----------------------------------------------------------------------------

export function bowlingScore(rolls: number[]): number {
  let score = 0;
  let rollIndex = 0;

  for (let frame = 0; frame < 10; frame++) {
    if (rolls[rollIndex] === 10) {
      // Strike
      score += 10 + (rolls[rollIndex + 1] || 0) + (rolls[rollIndex + 2] || 0);
      rollIndex++;
    } else if ((rolls[rollIndex] || 0) + (rolls[rollIndex + 1] || 0) === 10) {
      // Spare
      score += 10 + (rolls[rollIndex + 2] || 0);
      rollIndex += 2;
    } else {
      score += (rolls[rollIndex] || 0) + (rolls[rollIndex + 1] || 0);
      rollIndex += 2;
    }
  }

  return score;
}

// =============================================================================
// Tests
// =============================================================================

async function main() {
  const { test, assert, assertEqual, assertThrows, run } = createTestRunner('Lab 15 — TDD & BDD Patterns');

  // --- Exercice 1 ---
  await test('Ex1: Stack — new stack is empty', () => {
    const s = new Stack<number>();
    assert(s.isEmpty());
    assertEqual(s.size(), 0);
  });

  await test('Ex1: Stack — push, peek, pop', () => {
    const s = new Stack<number>();
    s.push(1);
    s.push(2);
    assertEqual(s.peek(), 2);
    assertEqual(s.size(), 2);
    assertEqual(s.pop(), 2);
    assertEqual(s.pop(), 1);
    assert(s.isEmpty());
  });

  await test('Ex1: Stack — pop/peek on empty throws', () => {
    const s = new Stack<number>();
    assertThrows(() => s.pop());
    assertThrows(() => s.peek());
  });

  // --- Exercice 2 ---
  await test('Ex2: toRoman — basic numerals', () => {
    assertEqual(toRoman(1), 'I');
    assertEqual(toRoman(5), 'V');
    assertEqual(toRoman(10), 'X');
    assertEqual(toRoman(50), 'L');
    assertEqual(toRoman(100), 'C');
    assertEqual(toRoman(500), 'D');
    assertEqual(toRoman(1000), 'M');
  });

  await test('Ex2: toRoman — subtractive notation', () => {
    assertEqual(toRoman(4), 'IV');
    assertEqual(toRoman(9), 'IX');
    assertEqual(toRoman(40), 'XL');
    assertEqual(toRoman(90), 'XC');
    assertEqual(toRoman(400), 'CD');
    assertEqual(toRoman(900), 'CM');
    assertEqual(toRoman(1994), 'MCMXCIV');
    assertEqual(toRoman(3999), 'MMMCMXCIX');
  });

  // --- Exercice 3 ---
  await test('Ex3: BDD scenario — passing scenario', async () => {
    const scenario = createScenario('User logs in');
    scenario
      .given('a registered user', (ctx) => { ctx.user = { email: 'a@b.com' }; })
      .when('they submit valid credentials', (ctx) => { ctx.loggedIn = true; })
      .then('they are authenticated', (ctx) => {
        if (!ctx.loggedIn) throw new Error('Not logged in');
      });
    const result = await scenario.run();
    assertEqual(result.status, 'passed');
    assertEqual(result.steps.length, 3);
    assertEqual(result.steps[0].type, 'given');
    assertEqual(result.steps[2].type, 'then');
  });

  await test('Ex3: BDD scenario — failing step', async () => {
    const scenario = createScenario('Failing test');
    scenario
      .given('initial state', () => {})
      .when('action fails', () => { throw new Error('boom'); })
      .then('never reached', () => {});
    const result = await scenario.run();
    assertEqual(result.status, 'failed');
    assertEqual(result.steps[1].status, 'failed');
  });

  // --- Exercice 4 ---
  await test('Ex4: step registry — define and execute steps', async () => {
    const registry = createStepRegistry();
    let capturedAmount = 0;
    registry.defineStep('given', /a user with (\d+) credits/, (_ctx, amount) => {
      capturedAmount = Number(amount);
    });
    const ctx = {};
    await registry.execute('given', 'a user with 100 credits', ctx);
    assertEqual(capturedAmount, 100);
  });

  await test('Ex4: step registry — resolve returns match info', () => {
    const registry = createStepRegistry();
    registry.defineStep('when', /they buy "(.+)" for (\d+)/, () => {});
    const match = registry.resolve('when', 'they buy "widget" for 50');
    assert(match !== undefined);
    assertEqual(match!.captures[0], 'widget');
    assertEqual(match!.captures[1], '50');
  });

  // --- Exercice 5 ---
  await test('Ex5: UserRegistration — success', () => {
    const users: User[] = [];
    const repo: UserRepository = {
      save(user) { users.push(user); },
      findByEmail(email) { return users.find(u => u.email === email); },
    };
    const validator: EmailValidator = { isValid: (e) => e.includes('@') };
    const registration = createUserRegistration(repo, validator);
    const user = registration.register('alice@test.com', 'Alice');
    assertEqual(user.email, 'alice@test.com');
    assertEqual(user.name, 'Alice');
    assert(user.id.length > 0);
    assertEqual(users.length, 1);
  });

  await test('Ex5: UserRegistration — validation errors', () => {
    const repo: UserRepository = {
      save() {},
      findByEmail() { return undefined; },
    };
    const validator: EmailValidator = { isValid: (e) => e.includes('@') };
    const registration = createUserRegistration(repo, validator);
    assertThrows(() => registration.register('invalid', 'Bob'), 'invalid email');
  });

  await test('Ex5: UserRegistration — duplicate email', () => {
    const users: User[] = [{ id: '1', email: 'a@b.com', name: 'Existing' }];
    const repo: UserRepository = {
      save(user) { users.push(user); },
      findByEmail(email) { return users.find(u => u.email === email); },
    };
    const validator: EmailValidator = { isValid: () => true };
    const registration = createUserRegistration(repo, validator);
    assertThrows(() => registration.register('a@b.com', 'Dup'), 'already');
  });

  // --- Exercice 6 ---
  await test('Ex6: bowlingScore — all gutters', () => {
    assertEqual(bowlingScore(new Array(20).fill(0)), 0);
  });

  await test('Ex6: bowlingScore — all ones', () => {
    assertEqual(bowlingScore(new Array(20).fill(1)), 20);
  });

  await test('Ex6: bowlingScore — one spare', () => {
    const rolls = [5, 5, 3, ...new Array(17).fill(0)];
    assertEqual(bowlingScore(rolls), 16);
  });

  await test('Ex6: bowlingScore — one strike', () => {
    const rolls = [10, 3, 4, ...new Array(16).fill(0)];
    assertEqual(bowlingScore(rolls), 24);
  });

  await test('Ex6: bowlingScore — perfect game', () => {
    assertEqual(bowlingScore(new Array(12).fill(10)), 300);
  });

  run();
}

main();
