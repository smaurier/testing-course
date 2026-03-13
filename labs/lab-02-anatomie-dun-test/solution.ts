// =============================================================================
// Lab 02 — Anatomie d'un test (Solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Calculator class
// =============================================================================

class Calculator {
  private history: string[] = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(`${a} + ${b} = ${result}`);
    return result;
  }

  subtract(a: number, b: number): number {
    const result = a - b;
    this.history.push(`${a} - ${b} = ${result}`);
    return result;
  }

  multiply(a: number, b: number): number {
    const result = a * b;
    this.history.push(`${a} * ${b} = ${result}`);
    return result;
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero');
    const result = a / b;
    this.history.push(`${a} / ${b} = ${result}`);
    return result;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}

// =============================================================================
// Exercise 2: StringUtils class
// =============================================================================

class StringUtils {
  capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
  }
}

// =============================================================================
// Exercise 3: TemperatureConverter
// =============================================================================

class TemperatureConverter {
  celsiusToFahrenheit(celsius: number): number {
    this.validateCelsius(celsius);
    return celsius * 9 / 5 + 32;
  }

  fahrenheitToCelsius(fahrenheit: number): number {
    const celsius = (fahrenheit - 32) * 5 / 9;
    this.validateCelsius(celsius);
    return celsius;
  }

  celsiusToKelvin(celsius: number): number {
    this.validateCelsius(celsius);
    return celsius + 273.15;
  }

  kelvinToCelsius(kelvin: number): number {
    if (kelvin < 0) throw new Error('Temperature below absolute zero');
    return kelvin - 273.15;
  }

  private validateCelsius(celsius: number): void {
    if (celsius < -273.15) throw new Error('Temperature below absolute zero');
  }
}

// =============================================================================
// Exercise 4: DateRange class
// =============================================================================

class DateRange {
  constructor(public readonly start: Date, public readonly end: Date) {
    if (start >= end) throw new Error('Start date must be before end date');
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  overlaps(other: DateRange): boolean {
    return this.start <= other.end && this.end >= other.start;
  }

  durationInDays(): number {
    const diffMs = this.end.getTime() - this.start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}

// =============================================================================
// Exercise 5: PasswordValidator
// =============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

class PasswordValidator {
  validate(password: string): ValidationResult {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one digit');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
  }
}

// =============================================================================
// Exercise 6: PaginationHelper
// =============================================================================

class PaginationHelper<T> {
  constructor(private items: T[], private itemsPerPage: number) {}

  totalPages(): number {
    return Math.ceil(this.items.length / this.itemsPerPage);
  }

  currentItems(page: number): T[] {
    const start = (page - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.items.slice(start, end);
  }

  isFirstPage(page: number): boolean {
    return page === 1;
  }

  isLastPage(page: number): boolean {
    return page === this.totalPages();
  }

  totalItems(): number {
    return this.items.length;
  }
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assertDeepEqual, assert, assertThrows, run } = createTestRunner('Lab 02 — Anatomie d\'un test');

// --- Exercise 1: Calculator (AAA pattern) ---
await test('Ex1: add returns sum', () => {
  // Arrange
  const calc = new Calculator();
  // Act
  const result = calc.add(2, 3);
  // Assert
  assertEqual(result, 5);
});

await test('Ex1: subtract returns difference', () => {
  const calc = new Calculator();
  assertEqual(calc.subtract(10, 4), 6);
});

await test('Ex1: multiply returns product', () => {
  const calc = new Calculator();
  assertEqual(calc.multiply(3, 7), 21);
});

await test('Ex1: divide returns quotient', () => {
  const calc = new Calculator();
  assertEqual(calc.divide(10, 2), 5);
});

await test('Ex1: divide throws on zero', () => {
  const calc = new Calculator();
  assertThrows(() => calc.divide(10, 0), 'Division by zero');
});

await test('Ex1: history records operations', () => {
  const calc = new Calculator();
  calc.add(1, 2);
  calc.multiply(3, 4);
  const history = calc.getHistory();
  assertEqual(history.length, 2);
  assertEqual(history[0], '1 + 2 = 3');
  assertEqual(history[1], '3 * 4 = 12');
});

await test('Ex1: clearHistory empties history', () => {
  const calc = new Calculator();
  calc.add(1, 1);
  calc.clearHistory();
  assertEqual(calc.getHistory().length, 0);
});

// --- Exercise 2: StringUtils (AAA focus) ---
await test('Ex2: capitalize first letter', () => {
  // Arrange
  const utils = new StringUtils();
  // Act
  const result = utils.capitalize('hello');
  // Assert
  assertEqual(result, 'Hello');
});

await test('Ex2: capitalize empty string returns empty', () => {
  const utils = new StringUtils();
  assertEqual(utils.capitalize(''), '');
});

await test('Ex2: slugify converts to kebab-case', () => {
  const utils = new StringUtils();
  assertEqual(utils.slugify('Hello World Test'), 'hello-world-test');
});

await test('Ex2: slugify handles special characters', () => {
  const utils = new StringUtils();
  assertEqual(utils.slugify('Hello, World!'), 'hello-world');
});

await test('Ex2: truncate adds ellipsis when too long', () => {
  const utils = new StringUtils();
  assertEqual(utils.truncate('Hello World', 5), 'Hello...');
});

await test('Ex2: truncate keeps short strings unchanged', () => {
  const utils = new StringUtils();
  assertEqual(utils.truncate('Hi', 10), 'Hi');
});

// --- Exercise 3: TemperatureConverter ---
await test('Ex3: celsius to fahrenheit (freezing)', () => {
  const conv = new TemperatureConverter();
  assertEqual(conv.celsiusToFahrenheit(0), 32);
});

await test('Ex3: celsius to fahrenheit (boiling)', () => {
  const conv = new TemperatureConverter();
  assertEqual(conv.celsiusToFahrenheit(100), 212);
});

await test('Ex3: fahrenheit to celsius', () => {
  const conv = new TemperatureConverter();
  assertEqual(conv.fahrenheitToCelsius(32), 0);
});

await test('Ex3: celsius to kelvin', () => {
  const conv = new TemperatureConverter();
  assertEqual(conv.celsiusToKelvin(0), 273.15);
});

await test('Ex3: kelvin to celsius', () => {
  const conv = new TemperatureConverter();
  assertEqual(conv.kelvinToCelsius(273.15), 0);
});

await test('Ex3: throws below absolute zero (celsius)', () => {
  const conv = new TemperatureConverter();
  assertThrows(() => conv.celsiusToKelvin(-274));
});

await test('Ex3: throws below absolute zero (kelvin)', () => {
  const conv = new TemperatureConverter();
  assertThrows(() => conv.kelvinToCelsius(-1));
});

// --- Exercise 4: DateRange ---
await test('Ex4: contains date within range', () => {
  const range = new DateRange(new Date('2024-01-01'), new Date('2024-12-31'));
  assert(range.contains(new Date('2024-06-15')));
});

await test('Ex4: does not contain date outside range', () => {
  const range = new DateRange(new Date('2024-01-01'), new Date('2024-12-31'));
  assert(!range.contains(new Date('2025-01-01')));
});

await test('Ex4: contains boundary dates', () => {
  const range = new DateRange(new Date('2024-01-01'), new Date('2024-12-31'));
  assert(range.contains(new Date('2024-01-01')));
  assert(range.contains(new Date('2024-12-31')));
});

await test('Ex4: overlaps with another range', () => {
  const r1 = new DateRange(new Date('2024-01-01'), new Date('2024-06-30'));
  const r2 = new DateRange(new Date('2024-03-01'), new Date('2024-12-31'));
  assert(r1.overlaps(r2));
  assert(r2.overlaps(r1));
});

await test('Ex4: no overlap with disjoint range', () => {
  const r1 = new DateRange(new Date('2024-01-01'), new Date('2024-03-31'));
  const r2 = new DateRange(new Date('2024-06-01'), new Date('2024-12-31'));
  assert(!r1.overlaps(r2));
});

await test('Ex4: durationInDays calculation', () => {
  const range = new DateRange(new Date('2024-01-01'), new Date('2024-01-31'));
  assertEqual(range.durationInDays(), 30);
});

await test('Ex4: throws if start >= end', () => {
  assertThrows(() => new DateRange(new Date('2024-12-31'), new Date('2024-01-01')));
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
  assert(result.errors.some(e => e.toLowerCase().includes('8')));
});

await test('Ex5: missing uppercase fails', () => {
  const v = new PasswordValidator();
  const result = v.validate('str0ng!pass');
  assert(!result.valid);
  assert(result.errors.some(e => e.toLowerCase().includes('uppercase')));
});

await test('Ex5: missing digit fails', () => {
  const v = new PasswordValidator();
  const result = v.validate('Strong!Pass');
  assert(!result.valid);
  assert(result.errors.some(e => e.toLowerCase().includes('digit')));
});

await test('Ex5: missing special char fails', () => {
  const v = new PasswordValidator();
  const result = v.validate('Str0ngPass1');
  assert(!result.valid);
  assert(result.errors.some(e => e.toLowerCase().includes('special')));
});

await test('Ex5: multiple failures reported', () => {
  const v = new PasswordValidator();
  const result = v.validate('abc');
  assert(!result.valid);
  assert(result.errors.length >= 3, `Expected at least 3 errors, got ${result.errors.length}`);
});

// --- Exercise 6: PaginationHelper ---
await test('Ex6: totalPages calculation', () => {
  const helper = new PaginationHelper([1, 2, 3, 4, 5], 2);
  assertEqual(helper.totalPages(), 3);
});

await test('Ex6: totalPages with exact fit', () => {
  const helper = new PaginationHelper([1, 2, 3, 4], 2);
  assertEqual(helper.totalPages(), 2);
});

await test('Ex6: currentItems returns correct slice', () => {
  const helper = new PaginationHelper([1, 2, 3, 4, 5], 2);
  assertDeepEqual(helper.currentItems(1), [1, 2]);
  assertDeepEqual(helper.currentItems(2), [3, 4]);
  assertDeepEqual(helper.currentItems(3), [5]);
});

await test('Ex6: isFirstPage and isLastPage', () => {
  const helper = new PaginationHelper([1, 2, 3, 4, 5], 2);
  assert(helper.isFirstPage(1));
  assert(!helper.isFirstPage(2));
  assert(helper.isLastPage(3));
  assert(!helper.isLastPage(1));
});

await test('Ex6: totalItems returns count', () => {
  const helper = new PaginationHelper([1, 2, 3], 2);
  assertEqual(helper.totalItems(), 3);
});

await test('Ex6: empty collection', () => {
  const helper = new PaginationHelper([], 10);
  assertEqual(helper.totalPages(), 0);
  assertEqual(helper.totalItems(), 0);
  assertDeepEqual(helper.currentItems(1), []);
});

run();
