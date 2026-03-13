// =============================================================================
// Lab 15 — TDD Kata and BDD Patterns (exercise)
// =============================================================================
// Instructions : implementez chaque fonction TODO puis lancez les tests.
// Commande : npx tsx labs/lab-15-tdd-bdd/exercise.ts
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// -----------------------------------------------------------------------------
// Exercice 1 — TDD Stack (push, pop, peek, isEmpty, size)
// -----------------------------------------------------------------------------

export class Stack<T> {
  // TODO: Implementez une stack generique
  // - push(item): ajouter un element
  // - pop(): retirer et retourner le dernier element (throw si vide)
  // - peek(): retourner le dernier element sans le retirer (throw si vide)
  // - isEmpty(): true si la stack est vide
  // - size(): nombre d'elements

  push(_item: T): void {
    throw new Error('Not implemented');
  }

  pop(): T {
    throw new Error('Not implemented');
  }

  peek(): T {
    throw new Error('Not implemented');
  }

  isEmpty(): boolean {
    throw new Error('Not implemented');
  }

  size(): number {
    throw new Error('Not implemented');
  }
}

// -----------------------------------------------------------------------------
// Exercice 2 — TDD RomanNumerals converter
// -----------------------------------------------------------------------------

export function toRoman(num: number): string {
  // TODO: Convertir un entier en chiffres romains
  // 1=I, 4=IV, 5=V, 9=IX, 10=X, 40=XL, 50=L, 90=XC, 100=C,
  // 400=CD, 500=D, 900=CM, 1000=M
  throw new Error('Not implemented');
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
  // TODO: Retourner un builder avec :
  // - given(description, fn): ajouter une etape Given
  // - when(description, fn): ajouter une etape When
  // - then(description, fn): ajouter une etape Then
  // - run(): executer toutes les etapes et retourner ScenarioResult
  // Le contexte est un objet partage entre toutes les etapes
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 4 — Step definitions registry
// -----------------------------------------------------------------------------

export function createStepRegistry() {
  // TODO: Retourner un objet avec :
  // - defineStep(type, pattern, fn): enregistrer un step avec un pattern regex
  // - resolve(type, text): trouver le step correspondant et extraire les captures
  // - execute(type, text, context): resoudre et executer le step
  throw new Error('Not implemented');
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

export function createUserRegistration(repo: UserRepository, validator: EmailValidator) {
  // TODO: Retourner un objet avec :
  // - register(email, name): enregistrer un utilisateur
  //   - Valider l'email avec validator.isValid
  //   - Verifier que l'email n'est pas deja pris (repo.findByEmail)
  //   - Creer l'utilisateur avec un ID unique et le sauvegarder
  //   - Retourner l'utilisateur cree
  //   - Throw si email invalide ou deja pris
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 6 — Bowling score calculator
// -----------------------------------------------------------------------------

export function bowlingScore(rolls: number[]): number {
  // TODO: Calculer le score d'une partie de bowling
  // - 10 frames
  // - Spare (/ = 10 pins en 2 lancers): bonus = prochain lancer
  // - Strike (X = 10 pins en 1 lancer): bonus = 2 prochains lancers
  // - 10e frame: jusqu'a 3 lancers si strike ou spare
  throw new Error('Not implemented');
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
    // Spare in frame 1: 5+5, then 3, then all 0
    const rolls = [5, 5, 3, ...new Array(17).fill(0)];
    assertEqual(bowlingScore(rolls), 16); // (10+3) + 3
  });

  await test('Ex6: bowlingScore — one strike', () => {
    // Strike in frame 1: 10, then 3+4, then all 0
    const rolls = [10, 3, 4, ...new Array(16).fill(0)];
    assertEqual(bowlingScore(rolls), 24); // (10+3+4) + 3 + 4
  });

  await test('Ex6: bowlingScore — perfect game', () => {
    // 12 strikes = 300
    assertEqual(bowlingScore(new Array(12).fill(10)), 300);
  });

  run();
}

main();
