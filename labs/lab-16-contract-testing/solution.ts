// =============================================================================
// Lab 16 — Contract Testing Patterns (solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface FieldSchema {
  name: string;
  type: FieldType;
  required: boolean;
}

interface Contract {
  endpoint: string;
  method: string;
  fields: FieldSchema[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface BreakingChange {
  type: 'removed_field' | 'type_changed' | 'made_required';
  field: string;
  details: string;
}

interface Pact {
  consumer: string;
  provider: string;
  interactions: PactInteraction[];
}

interface PactInteraction {
  description: string;
  request: { method: string; path: string };
  response: { status: number; body: Record<string, unknown> };
}

// -----------------------------------------------------------------------------
// Exercice 1 — defineContract
// -----------------------------------------------------------------------------

export function defineContract(
  endpoint: string,
  method: string,
  fields: Array<{ name: string; type: FieldType; required?: boolean }>
): Contract {
  return {
    endpoint,
    method,
    fields: fields.map(f => ({
      name: f.name,
      type: f.type,
      required: f.required !== undefined ? f.required : true,
    })),
  };
}

// -----------------------------------------------------------------------------
// Exercice 2 — validateResponse
// -----------------------------------------------------------------------------

function getFieldType(value: unknown): FieldType {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'object';
  return typeof value as FieldType;
}

export function validateResponse(
  response: Record<string, unknown>,
  contract: Contract
): ValidationResult {
  const errors: string[] = [];

  for (const field of contract.fields) {
    const value = response[field.name];

    if (value === undefined) {
      if (field.required) {
        errors.push(`Missing required field: ${field.name}`);
      }
      continue;
    }

    const actualType = getFieldType(value);
    if (actualType !== field.type) {
      errors.push(`Field "${field.name}": expected ${field.type}, got ${actualType}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// -----------------------------------------------------------------------------
// Exercice 3 — detectBreakingChange
// -----------------------------------------------------------------------------

export function detectBreakingChange(
  oldContract: Contract,
  newContract: Contract
): BreakingChange[] {
  const changes: BreakingChange[] = [];
  const newFieldMap = new Map(newContract.fields.map(f => [f.name, f]));

  for (const oldField of oldContract.fields) {
    const newField = newFieldMap.get(oldField.name);

    if (!newField) {
      changes.push({
        type: 'removed_field',
        field: oldField.name,
        details: `Field "${oldField.name}" was removed`,
      });
      continue;
    }

    if (oldField.type !== newField.type) {
      changes.push({
        type: 'type_changed',
        field: oldField.name,
        details: `Field "${oldField.name}" changed from ${oldField.type} to ${newField.type}`,
      });
    }

    if (!oldField.required && newField.required) {
      changes.push({
        type: 'made_required',
        field: oldField.name,
        details: `Field "${oldField.name}" was optional, now required`,
      });
    }
  }

  return changes;
}

// -----------------------------------------------------------------------------
// Exercice 4 — Consumer test (pact generation)
// -----------------------------------------------------------------------------

export function createConsumerPact(consumer: string, provider: string) {
  const interactions: PactInteraction[] = [];

  return {
    addInteraction(
      description: string,
      request: { method: string; path: string },
      response: { status: number; body: Record<string, unknown> }
    ): void {
      interactions.push({ description, request, response });
    },
    toPact(): Pact {
      return { consumer, provider, interactions: [...interactions] };
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 5 — Provider verification
// -----------------------------------------------------------------------------

export function verifyProvider(
  pact: Pact,
  handler: (req: { method: string; path: string }) => { status: number; body: Record<string, unknown> }
): { success: boolean; results: Array<{ description: string; passed: boolean; error?: string }> } {
  const results: Array<{ description: string; passed: boolean; error?: string }> = [];

  for (const interaction of pact.interactions) {
    const actual = handler(interaction.request);
    const errors: string[] = [];

    if (actual.status !== interaction.response.status) {
      errors.push(`Expected status ${interaction.response.status}, got ${actual.status}`);
    }

    // Check that all expected body fields are present with correct values
    for (const [key, expectedValue] of Object.entries(interaction.response.body)) {
      if (!(key in actual.body)) {
        errors.push(`Missing field "${key}" in response body`);
      } else if (JSON.stringify(actual.body[key]) !== JSON.stringify(expectedValue)) {
        errors.push(`Field "${key}": expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual.body[key])}`);
      }
    }

    results.push({
      description: interaction.description,
      passed: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });
  }

  return {
    success: results.every(r => r.passed),
    results,
  };
}

// -----------------------------------------------------------------------------
// Exercice 6 — Full contract flow
// -----------------------------------------------------------------------------

export function createContractFlow() {
  const contracts = new Map<string, Contract>();
  const pacts: Pact[] = [];

  return {
    registerContract(name: string, contract: Contract): void {
      contracts.set(name, contract);
    },

    publishPact(pact: Pact): void {
      pacts.push(pact);
    },

    verify(
      providerName: string,
      handler: (req: { method: string; path: string }) => { status: number; body: Record<string, unknown> }
    ): { success: boolean; results: Array<{ description: string; passed: boolean; error?: string }> } {
      const providerPacts = pacts.filter(p => p.provider === providerName);
      const allResults: Array<{ description: string; passed: boolean; error?: string }> = [];

      for (const pact of providerPacts) {
        const verification = verifyProvider(pact, handler);
        allResults.push(...verification.results);
      }

      return {
        success: allResults.every(r => r.passed),
        results: allResults,
      };
    },

    checkCompatibility(
      name: string,
      newContract: Contract
    ): { compatible: boolean; breakingChanges: BreakingChange[] } {
      const existing = contracts.get(name);
      if (!existing) return { compatible: true, breakingChanges: [] };

      const breakingChanges = detectBreakingChange(existing, newContract);
      return {
        compatible: breakingChanges.length === 0,
        breakingChanges,
      };
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

async function main() {
  const { test, assert, assertEqual, run } = createTestRunner('Lab 16 — Contract Testing');

  // --- Exercice 1 ---
  await test('Ex1: defineContract creates a contract with fields', () => {
    const contract = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string', required: true },
      { name: 'avatar', type: 'string', required: false },
    ]);
    assertEqual(contract.endpoint, '/api/users');
    assertEqual(contract.method, 'GET');
    assertEqual(contract.fields.length, 4);
    assertEqual(contract.fields[0].required, true);
    assertEqual(contract.fields[3].required, false);
  });

  await test('Ex1: defineContract defaults required to true', () => {
    const contract = defineContract('/api/items', 'POST', [
      { name: 'title', type: 'string' },
    ]);
    assertEqual(contract.fields[0].required, true);
  });

  // --- Exercice 2 ---
  await test('Ex2: validateResponse passes valid response', () => {
    const contract = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
    ]);
    const result = validateResponse({ id: 1, name: 'Alice' }, contract);
    assertEqual(result.valid, true);
    assertEqual(result.errors.length, 0);
  });

  await test('Ex2: validateResponse detects missing and wrong-type fields', () => {
    const contract = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'active', type: 'boolean' },
    ]);
    const result = validateResponse({ id: 'not-a-number', name: 'Alice' }, contract);
    assertEqual(result.valid, false);
    assert(result.errors.length >= 2);
  });

  await test('Ex2: validateResponse allows missing optional fields', () => {
    const contract = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'number' },
      { name: 'bio', type: 'string', required: false },
    ]);
    const result = validateResponse({ id: 1 }, contract);
    assertEqual(result.valid, true);
  });

  // --- Exercice 3 ---
  await test('Ex3: detectBreakingChange finds removed fields', () => {
    const old = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
    ]);
    const next = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'number' },
    ]);
    const changes = detectBreakingChange(old, next);
    assertEqual(changes.length, 1);
    assertEqual(changes[0].type, 'removed_field');
    assertEqual(changes[0].field, 'name');
  });

  await test('Ex3: detectBreakingChange finds type changes and made-required', () => {
    const old = defineContract('/api/items', 'GET', [
      { name: 'id', type: 'number' },
      { name: 'tags', type: 'string', required: false },
    ]);
    const next = defineContract('/api/items', 'GET', [
      { name: 'id', type: 'string' },
      { name: 'tags', type: 'string', required: true },
    ]);
    const changes = detectBreakingChange(old, next);
    assertEqual(changes.length, 2);
    assert(changes.some(c => c.type === 'type_changed' && c.field === 'id'));
    assert(changes.some(c => c.type === 'made_required' && c.field === 'tags'));
  });

  // --- Exercice 4 ---
  await test('Ex4: consumer pact generation', () => {
    const builder = createConsumerPact('frontend', 'user-service');
    builder.addInteraction(
      'get user by id',
      { method: 'GET', path: '/api/users/1' },
      { status: 200, body: { id: 1, name: 'Alice' } }
    );
    builder.addInteraction(
      'user not found',
      { method: 'GET', path: '/api/users/999' },
      { status: 404, body: { error: 'Not found' } }
    );
    const pact = builder.toPact();
    assertEqual(pact.consumer, 'frontend');
    assertEqual(pact.provider, 'user-service');
    assertEqual(pact.interactions.length, 2);
  });

  // --- Exercice 5 ---
  await test('Ex5: provider verification passes', () => {
    const pact: Pact = {
      consumer: 'frontend',
      provider: 'user-service',
      interactions: [
        {
          description: 'get user',
          request: { method: 'GET', path: '/api/users/1' },
          response: { status: 200, body: { id: 1, name: 'Alice' } },
        },
      ],
    };
    const handler = () => ({ status: 200, body: { id: 1, name: 'Alice', extra: true } });
    const result = verifyProvider(pact, handler);
    assertEqual(result.success, true);
    assertEqual(result.results[0].passed, true);
  });

  await test('Ex5: provider verification fails on missing field', () => {
    const pact: Pact = {
      consumer: 'frontend',
      provider: 'user-service',
      interactions: [
        {
          description: 'get user',
          request: { method: 'GET', path: '/api/users/1' },
          response: { status: 200, body: { id: 1, name: 'Alice' } },
        },
      ],
    };
    const handler = () => ({ status: 200, body: { id: 1 } });
    const result = verifyProvider(pact, handler);
    assertEqual(result.success, false);
    assertEqual(result.results[0].passed, false);
  });

  // --- Exercice 6 ---
  await test('Ex6: full contract flow', () => {
    const flow = createContractFlow();

    const contract = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
    ]);
    flow.registerContract('user-service', contract);

    const builder = createConsumerPact('frontend', 'user-service');
    builder.addInteraction('get user', { method: 'GET', path: '/api/users/1' }, { status: 200, body: { id: 1, name: 'Alice' } });
    flow.publishPact(builder.toPact());

    const handler = () => ({ status: 200, body: { id: 1, name: 'Alice' } });
    const verification = flow.verify('user-service', handler);
    assertEqual(verification.success, true);

    const newContract = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
    ]);
    const compat = flow.checkCompatibility('user-service', newContract);
    assertEqual(compat.compatible, false);
    assert(compat.breakingChanges.length > 0);
  });

  run();
}

main();
