// =============================================================================
// Lab 16 — Contract Testing Patterns (exercise)
// =============================================================================
// Instructions : implementez chaque fonction TODO puis lancez les tests.
// Commande : npx tsx labs/lab-16-contract-testing/exercise.ts
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
  // TODO: Creer un contrat avec les champs normalises
  // - Si required n'est pas specifie, defaut = true
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 2 — validateResponse
// -----------------------------------------------------------------------------

export function validateResponse(
  response: Record<string, unknown>,
  contract: Contract
): ValidationResult {
  // TODO: Valider que la reponse respecte le contrat
  // - Verifier que chaque champ requis est present
  // - Verifier que les types correspondent
  // - Retourner { valid, errors[] }
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 3 — detectBreakingChange
// -----------------------------------------------------------------------------

export function detectBreakingChange(
  oldContract: Contract,
  newContract: Contract
): BreakingChange[] {
  // TODO: Comparer deux contrats et identifier les breaking changes:
  // - Champ supprime (qui etait dans old mais plus dans new)
  // - Type change (meme champ, type different)
  // - Champ devenu required (etait optional, maintenant required)
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 4 — Consumer test (pact generation)
// -----------------------------------------------------------------------------

export function createConsumerPact(consumer: string, provider: string) {
  // TODO: Retourner un builder avec :
  // - addInteraction(description, request, expectedResponse): ajouter une interaction
  // - toPact(): generer le pact complet
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 5 — Provider verification
// -----------------------------------------------------------------------------

export function verifyProvider(
  pact: Pact,
  handler: (req: { method: string; path: string }) => { status: number; body: Record<string, unknown> }
): { success: boolean; results: Array<{ description: string; passed: boolean; error?: string }> } {
  // TODO: Verifier que le provider satisfait chaque interaction du pact
  // - Pour chaque interaction, appeler le handler avec la requete
  // - Verifier que le status et les champs du body correspondent
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 6 — Full contract flow
// -----------------------------------------------------------------------------

export function createContractFlow() {
  // TODO: Retourner un objet avec :
  // - registerContract(name, contract): enregistrer un contrat versionne
  // - publishPact(pact): enregistrer un pact consumer
  // - verify(providerName, handler): verifier tous les pacts du provider
  // - checkCompatibility(name, newContract): detecter les breaking changes
  throw new Error('Not implemented');
}

// =============================================================================
// Tests
// =============================================================================

async function main() {
  const { test, assert, assertEqual, assertDeepEqual, run } = createTestRunner('Lab 16 — Contract Testing');

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
    assertEqual(contract.fields[0].required, true);  // default
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
    assert(result.errors.length >= 2); // wrong type for id + missing active
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
    const handler = () => ({ status: 200, body: { id: 1 } }); // missing name
    const result = verifyProvider(pact, handler);
    assertEqual(result.success, false);
    assertEqual(result.results[0].passed, false);
  });

  // --- Exercice 6 ---
  await test('Ex6: full contract flow', () => {
    const flow = createContractFlow();

    // Register provider contract
    const contract = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
    ]);
    flow.registerContract('user-service', contract);

    // Consumer publishes pact
    const builder = createConsumerPact('frontend', 'user-service');
    builder.addInteraction('get user', { method: 'GET', path: '/api/users/1' }, { status: 200, body: { id: 1, name: 'Alice' } });
    flow.publishPact(builder.toPact());

    // Verify provider
    const handler = () => ({ status: 200, body: { id: 1, name: 'Alice' } });
    const verification = flow.verify('user-service', handler);
    assertEqual(verification.success, true);

    // Check compatibility with new contract
    const newContract = defineContract('/api/users', 'GET', [
      { name: 'id', type: 'string' }, // breaking: type changed
      { name: 'name', type: 'string' },
    ]);
    const compat = flow.checkCompatibility('user-service', newContract);
    assertEqual(compat.compatible, false);
    assert(compat.breakingChanges.length > 0);
  });

  run();
}

main();
