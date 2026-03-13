// =============================================================================
// Lab 02 — Anatomie d'un test (Exercices)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Calculator class
// Implementez add, subtract, multiply, divide avec un historique
// =============================================================================

class Calculator {
  // TODO: implementez la classe
  add(_a: number, _b: number): number { throw new Error('Not implemented'); }
  subtract(_a: number, _b: number): number { throw new Error('Not implemented'); }
  multiply(_a: number, _b: number): number { throw new Error('Not implemented'); }
  divide(_a: number, _b: number): number { throw new Error('Not implemented'); }
  getHistory(): string[] { throw new Error('Not implemented'); }
  clearHistory(): void { throw new Error('Not implemented'); }
}

// =============================================================================
// Exercise 2: StringUtils class
// Implementez capitalize, slugify, truncate
// =============================================================================

class StringUtils {
  // TODO: implementez la classe
  capitalize(_str: string): string { throw new Error('Not implemented'); }
  slugify(_str: string): string { throw new Error('Not implemented'); }
  truncate(_str: string, _maxLength: number): string { throw new Error('Not implemented'); }
}

// =============================================================================
// Exercise 3: TemperatureConverter
// Implementez celsiusToFahrenheit, fahrenheitToCelsius, celsiusToKelvin,
// kelvinToCelsius. Lancez une erreur si temperature < zero absolu.
// =============================================================================

class TemperatureConverter {
  // TODO: implementez la classe
  celsiusToFahrenheit(_celsius: number): number { throw new Error('Not implemented'); }
  fahrenheitToCelsius(_fahrenheit: number): number { throw new Error('Not implemented'); }
  celsiusToKelvin(_celsius: number): number { throw new Error('Not implemented'); }
  kelvinToCelsius(_kelvin: number): number { throw new Error('Not implemented'); }
}

// =============================================================================
// Exercise 4: DateRange class
// Implementez contains(date), overlaps(other), durationInDays()
// =============================================================================

class DateRange {
  constructor(public readonly start: Date, public readonly end: Date) {
    // TODO: validez que start < end
  }
  contains(_date: Date): boolean { throw new Error('Not implemented'); }
  overlaps(_other: DateRange): boolean { throw new Error('Not implemented'); }
  durationInDays(): number { throw new Error('Not implemented'); }
}

// =============================================================================
// Exercise 5: PasswordValidator
// Au moins 8 caracteres, 1 majuscule, 1 chiffre, 1 caractere special
// Retourne { valid: boolean, errors: string[] }
// =============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

class PasswordValidator {
  // TODO: implementez la classe
  validate(_password: string): ValidationResult { throw new Error('Not implemented'); }
}

// =============================================================================
// Exercise 6: PaginationHelper
// Implementez totalPages, currentItems, isFirstPage, isLastPage
// =============================================================================

class PaginationHelper<T> {
  constructor(private _items: T[], private _itemsPerPage: number) {}
  // TODO: implementez la classe
  totalPages(): number { throw new Error('Not implemented'); }
  currentItems(_page: number): T[] { throw new Error('Not implemented'); }
  isFirstPage(_page: number): boolean { throw new Error('Not implemented'); }
  isLastPage(_page: number): boolean { throw new Error('Not implemented'); }
  totalItems(): number { throw new Error('Not implemented'); }
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assertDeepEqual, assert, assertThrows, run } = createTestRunner('Lab 02 — Anatomie d\'un test');

// --- Exercise 1: Calculator ---
await test('Ex1: add returns sum', () => {
  const calc = new Calculator();
  assertEqual(calc.add(2, 3), 5);
});
await test('Ex1: divide throws on zero', () => {
  const calc = new Calculator();
  assertThrows(() => calc.divide(10, 0));
});
await test('Ex1: history records operations', () => {
  const calc = new Calculator();
  calc.add(1, 2);
  calc.multiply(3, 4);
  assertEqual(calc.getHistory().length, 2);
});

// --- Exercise 2: StringUtils ---
await test('Ex2: capitalize first letter', () => {
  const utils = new StringUtils();
  assertEqual(utils.capitalize('hello'), 'Hello');
});
await test('Ex2: slugify converts to kebab-case', () => {
  const utils = new StringUtils();
  assertEqual(utils.slugify('Hello World Test'), 'hello-world-test');
});
await test('Ex2: truncate adds ellipsis', () => {
  const utils = new StringUtils();
  assertEqual(utils.truncate('Hello World', 5), 'Hello...');
});

// --- Exercise 3: TemperatureConverter ---
await test('Ex3: celsius to fahrenheit', () => {
  const conv = new TemperatureConverter();
  assertEqual(conv.celsiusToFahrenheit(0), 32);
  assertEqual(conv.celsiusToFahrenheit(100), 212);
});
await test('Ex3: throws below absolute zero', () => {
  const conv = new TemperatureConverter();
  assertThrows(() => conv.celsiusToKelvin(-274));
});

// --- Exercise 4: DateRange ---
await test('Ex4: contains date within range', () => {
  const range = new DateRange(new Date('2024-01-01'), new Date('2024-12-31'));
  assert(range.contains(new Date('2024-06-15')));
  assert(!range.contains(new Date('2025-01-01')));
});
await test('Ex4: overlaps with another range', () => {
  const r1 = new DateRange(new Date('2024-01-01'), new Date('2024-06-30'));
  const r2 = new DateRange(new Date('2024-03-01'), new Date('2024-12-31'));
  assert(r1.overlaps(r2));
});

// --- Exercise 5: PasswordValidator ---
await test('Ex5: valid password passes all rules', () => {
  const v = new PasswordValidator();
  const result = v.validate('Str0ng!Pass');
  assert(result.valid);
  assertEqual(result.errors.length, 0);
});
await test('Ex5: short password fails', () => {
  const v = new PasswordValidator();
  const result = v.validate('Ab1!');
  assert(!result.valid);
  assert(result.errors.length > 0);
});

// --- Exercise 6: PaginationHelper ---
await test('Ex6: totalPages calculation', () => {
  const helper = new PaginationHelper([1,2,3,4,5], 2);
  assertEqual(helper.totalPages(), 3);
});
await test('Ex6: currentItems returns correct slice', () => {
  const helper = new PaginationHelper([1,2,3,4,5], 2);
  assertDeepEqual(helper.currentItems(1), [1, 2]);
  assertDeepEqual(helper.currentItems(3), [5]);
});
await test('Ex6: isFirstPage and isLastPage', () => {
  const helper = new PaginationHelper([1,2,3,4,5], 2);
  assert(helper.isFirstPage(1));
  assert(!helper.isFirstPage(2));
  assert(helper.isLastPage(3));
  assert(!helper.isLastPage(1));
});

run();
