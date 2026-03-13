// =============================================================================
// Lab 01 — Pourquoi tester ? (Solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// =============================================================================
// Exercise 1: Calculateur de cout des bugs
// =============================================================================

type Phase = 'requirements' | 'design' | 'coding' | 'testing' | 'production';

const PHASE_MULTIPLIERS: Record<Phase, number> = {
  requirements: 1,
  design: 5,
  coding: 10,
  testing: 15,
  production: 100,
};

function bugCostCalculator(phase: Phase, hourlyRate: number): number {
  return hourlyRate * PHASE_MULTIPLIERS[phase];
}

// =============================================================================
// Exercise 2: Distribution de la pyramide de tests
// =============================================================================

interface PyramidRatios {
  unit: number;
  integration: number;
  e2e: number;
}

interface PyramidDistribution {
  unit: number;
  integration: number;
  e2e: number;
}

function testPyramidDistribution(total: number, ratios: PyramidRatios): PyramidDistribution {
  const sum = ratios.unit + ratios.integration + ratios.e2e;
  const unit = Math.round(total * ratios.unit / sum);
  const integration = Math.round(total * ratios.integration / sum);
  const e2e = total - unit - integration;
  return { unit, integration, e2e };
}

// =============================================================================
// Exercise 3: Classification des tests
// =============================================================================

type TestType = 'unit' | 'integration' | 'e2e';

function classifyTest(description: string): TestType {
  const lower = description.toLowerCase();
  const e2eKeywords = ['browser', 'flow', 'user journey', 'end-to-end', 'e2e', 'checkout flow', 'page', 'navigate'];
  const integrationKeywords = ['database', 'api', 'connect', 'http', 'fetch from', 'service', 'integration', 'server'];

  if (e2eKeywords.some(kw => lower.includes(kw))) return 'e2e';
  if (integrationKeywords.some(kw => lower.includes(kw))) return 'integration';
  return 'unit';
}

// =============================================================================
// Exercise 4: Faut-il tester ?
// =============================================================================

type CodeType = 'business-logic' | 'security' | 'ui' | 'utility' | 'config';
type Complexity = 'low' | 'medium' | 'high';

function shouldWeTest(codeType: CodeType, complexity: Complexity, criticalityScore: number): boolean {
  if (codeType === 'business-logic' || codeType === 'security') return true;
  if (complexity === 'medium' || complexity === 'high') return true;
  if (criticalityScore >= 7) return true;
  return false;
}

// =============================================================================
// Exercise 5: Calcul du ROI des tests
// =============================================================================

function calculateTestROI(
  bugs: number,
  debugTime: number,
  testWriteTime: number,
  testMaintainTime: number,
): number {
  const timeSaved = bugs * debugTime;
  const investmentCost = testWriteTime + testMaintainTime;
  return (timeSaved - investmentCost) / investmentCost * 100;
}

// =============================================================================
// Exercise 6: Priorisation des tests
// =============================================================================

interface Feature {
  name: string;
  risk: number;
  frequency: number;
}

function prioritizeTests(features: Feature[]): Feature[] {
  return [...features].sort((a, b) => (b.risk * b.frequency) - (a.risk * a.frequency));
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assertDeepEqual, assert, run } = createTestRunner('Lab 01 — Pourquoi tester ?');

// --- Exercise 1 ---
await test('Ex1: requirements phase costs 1x hourly rate', () => {
  assertEqual(bugCostCalculator('requirements', 50), 50);
});
await test('Ex1: design phase costs 5x hourly rate', () => {
  assertEqual(bugCostCalculator('design', 50), 250);
});
await test('Ex1: production phase costs 100x hourly rate', () => {
  assertEqual(bugCostCalculator('production', 100), 10000);
});
await test('Ex1: coding phase costs 10x hourly rate', () => {
  assertEqual(bugCostCalculator('coding', 80), 800);
});
await test('Ex1: testing phase costs 15x hourly rate', () => {
  assertEqual(bugCostCalculator('testing', 60), 900);
});

// --- Exercise 2 ---
await test('Ex2: distributes 100 tests with 70/20/10 ratio', () => {
  const result = testPyramidDistribution(100, { unit: 70, integration: 20, e2e: 10 });
  assertDeepEqual(result, { unit: 70, integration: 20, e2e: 10 });
});
await test('Ex2: distributes 50 tests with 60/30/10 ratio', () => {
  const result = testPyramidDistribution(50, { unit: 60, integration: 30, e2e: 10 });
  assertEqual(result.unit + result.integration + result.e2e, 50);
});
await test('Ex2: handles uneven distribution gracefully', () => {
  const result = testPyramidDistribution(10, { unit: 70, integration: 20, e2e: 10 });
  assertEqual(result.unit + result.integration + result.e2e, 10);
  assert(result.unit >= result.integration, 'Unit should be >= integration');
});

// --- Exercise 3 ---
await test('Ex3: classifies "should add two numbers" as unit', () => {
  assertEqual(classifyTest('should add two numbers'), 'unit');
});
await test('Ex3: classifies "should connect to database and fetch" as integration', () => {
  assertEqual(classifyTest('should connect to database and fetch'), 'integration');
});
await test('Ex3: classifies "user completes checkout flow in browser" as e2e', () => {
  assertEqual(classifyTest('user completes checkout flow in browser'), 'e2e');
});
await test('Ex3: classifies pure logic tests as unit', () => {
  assertEqual(classifyTest('should calculate discount correctly'), 'unit');
});

// --- Exercise 4 ---
await test('Ex4: business-logic should always be tested', () => {
  assert(shouldWeTest('business-logic', 'low', 1));
});
await test('Ex4: security code should always be tested', () => {
  assert(shouldWeTest('security', 'low', 1));
});
await test('Ex4: high complexity should be tested', () => {
  assert(shouldWeTest('ui', 'high', 1));
});
await test('Ex4: medium complexity should be tested', () => {
  assert(shouldWeTest('utility', 'medium', 3));
});
await test('Ex4: high criticality should be tested', () => {
  assert(shouldWeTest('config', 'low', 8));
});
await test('Ex4: low-value config may be skipped', () => {
  assert(!shouldWeTest('config', 'low', 2));
});

// --- Exercise 5 ---
await test('Ex5: positive ROI when bugs are expensive', () => {
  const roi = calculateTestROI(10, 120, 200, 100);
  assert(roi > 0, `Expected positive ROI, got ${roi}`);
});
await test('Ex5: ROI calculation is correct (300%)', () => {
  assertEqual(calculateTestROI(10, 120, 200, 100), 300);
});
await test('Ex5: negative ROI when tests cost more than bugs', () => {
  const roi = calculateTestROI(1, 10, 500, 500);
  assert(roi < 0, `Expected negative ROI, got ${roi}`);
});

// --- Exercise 6 ---
await test('Ex6: sorts features by risk*frequency descending', () => {
  const features: Feature[] = [
    { name: 'login', risk: 9, frequency: 7 },
    { name: 'settings', risk: 2, frequency: 3 },
    { name: 'checkout', risk: 10, frequency: 8 },
  ];
  const sorted = prioritizeTests(features);
  assertEqual(sorted[0].name, 'checkout');  // 10*8=80
  assertEqual(sorted[1].name, 'login');     // 9*7=63
  assertEqual(sorted[2].name, 'settings');  // 2*3=6
});
await test('Ex6: does not mutate original array', () => {
  const features: Feature[] = [
    { name: 'a', risk: 1, frequency: 1 },
    { name: 'b', risk: 5, frequency: 5 },
  ];
  const sorted = prioritizeTests(features);
  assertEqual(features[0].name, 'a');
  assertEqual(sorted[0].name, 'b');
});
await test('Ex6: handles empty array', () => {
  assertDeepEqual(prioritizeTests([]), []);
});

run();
