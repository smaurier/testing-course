// =============================================================================
// Lab 01 — Pourquoi tester ? (Exercices)
// =============================================================================

import { createTestRunner } from "../test-utils.ts";

// =============================================================================
// Exercise 1: Calculateur de cout des bugs
// Implementez bugCostCalculator(phase, hourlyRate) qui retourne le cout
// d'un bug selon la phase : requirements(1x), design(5x), coding(10x),
// testing(15x), production(100x)
// =============================================================================

type Phase = "requirements" | "design" | "coding" | "testing" | "production";

function bugCostCalculator(_phase: Phase, _hourlyRate: number): number {
  switch (_phase) {
    case "requirements":
      return _hourlyRate;
    case "design":
      return _hourlyRate * 5;
    case "coding":
      return _hourlyRate * 10;
    case "testing":
      return _hourlyRate * 15;
    case "production":
      return _hourlyRate * 100;
    default:
      throw new Error("Not implemented");
  }
}

// =============================================================================
// Exercise 2: Distribution de la pyramide de tests
// Implementez testPyramidDistribution(total, ratios) qui distribue un
// nombre total de tests selon les ratios {unit, integration, e2e}
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

function testPyramidDistribution(
  _total: number,
  _ratios: PyramidRatios,
): PyramidDistribution {
  return {
    unit: (_total * _ratios.unit) / 100,
    integration: (_total * _ratios.integration) / 100,
    e2e: (_total * _ratios.e2e) / 100,
  };
}

// =============================================================================
// Exercise 3: Classification des tests
// Implementez classifyTest(description) qui classe un test en "unit",
// "integration" ou "e2e" selon les mots-cles dans la description
// =============================================================================

type TestType = "unit" | "integration" | "e2e";

function classifyTest(_description: string): TestType {
  if (_description.includes("browser") || _description.includes("flow")) {
    return "e2e";
  } else if (_description.includes("database")) {
    return "integration";
  } else {
    return "unit";
  }
}

// =============================================================================
// Exercise 4: Faut-il tester ?
// Implementez shouldWeTest(codeType, complexity, criticalityScore)
// Retourne true si : complexity >= 'medium' OU criticalityScore >= 7
// OU codeType est 'business-logic' ou 'security'
// =============================================================================

type CodeType = "business-logic" | "security" | "ui" | "utility" | "config";
type Complexity = "low" | "medium" | "high";

function shouldWeTest(
  _codeType: CodeType,
  _complexity: Complexity,
  _criticalityScore: number,
): boolean {
  return (
    _codeType === "business-logic" ||
    _codeType === "security" ||
    _complexity === "medium" ||
    _complexity === "high" ||
    _criticalityScore >= 7
  );
}

// =============================================================================
// Exercise 5: Calcul du ROI des tests
// ROI = (timeSaved - investmentCost) / investmentCost * 100
// timeSaved = bugs * debugTime
// investmentCost = testWriteTime + testMaintainTime
// =============================================================================

function calculateTestROI(
  _bugs: number,
  _debugTime: number,
  _testWriteTime: number,
  _testMaintainTime: number,
): number {
  const timeSaved = _bugs * _debugTime;
  const investmentCost = _testWriteTime + _testMaintainTime;
  return ((timeSaved - investmentCost) / investmentCost) * 100;
}

// =============================================================================
// Exercise 6: Priorisation des tests
// Trie les features par (risk * frequency) decroissant
// =============================================================================

interface Feature {
  name: string;
  risk: number;
  frequency: number;
}

function prioritizeTests(_features: Feature[]): Feature[] {
  // Trie les features par (risk * frequency) decroissant
  const tempFeatures = [..._features];
  return tempFeatures.sort(
    (a, b) => b.risk * b.frequency - a.risk * a.frequency,
  );
}

// =============================================================================
// Tests
// =============================================================================

const { test, assertEqual, assertDeepEqual, assert, run } = createTestRunner(
  "Lab 01 — Pourquoi tester ?",
);

// --- Exercise 1 ---
await test("Ex1: requirements phase costs 1x hourly rate", () => {
  assertEqual(bugCostCalculator("requirements", 50), 50);
});
await test("Ex1: design phase costs 5x hourly rate", () => {
  assertEqual(bugCostCalculator("design", 50), 250);
});
await test("Ex1: production phase costs 100x hourly rate", () => {
  assertEqual(bugCostCalculator("production", 100), 10000);
});

// --- Exercise 2 ---
await test("Ex2: distributes 100 tests with 70/20/10 ratio", () => {
  const result = testPyramidDistribution(100, {
    unit: 70,
    integration: 20,
    e2e: 10,
  });
  assertDeepEqual(result, { unit: 70, integration: 20, e2e: 10 });
});
await test("Ex2: distributes 50 tests with 60/30/10 ratio", () => {
  const result = testPyramidDistribution(50, {
    unit: 60,
    integration: 30,
    e2e: 10,
  });
  assertEqual(result.unit + result.integration + result.e2e, 50);
});

// --- Exercise 3 ---
await test('Ex3: classifies "should add two numbers" as unit', () => {
  assertEqual(classifyTest("should add two numbers"), "unit");
});
await test('Ex3: classifies "should connect to database and fetch" as integration', () => {
  assertEqual(
    classifyTest("should connect to database and fetch"),
    "integration",
  );
});
await test('Ex3: classifies "user completes checkout flow in browser" as e2e', () => {
  assertEqual(classifyTest("user completes checkout flow in browser"), "e2e");
});

// --- Exercise 4 ---
await test("Ex4: business-logic should always be tested", () => {
  assert(shouldWeTest("business-logic", "low", 1));
});
await test("Ex4: high complexity should be tested", () => {
  assert(shouldWeTest("ui", "high", 1));
});
await test("Ex4: high criticality should be tested", () => {
  assert(shouldWeTest("config", "low", 8));
});
await test("Ex4: low-value config may be skipped", () => {
  assert(!shouldWeTest("config", "low", 2));
});

// --- Exercise 5 ---
await test("Ex5: positive ROI when bugs are expensive", () => {
  const roi = calculateTestROI(10, 120, 200, 100);
  assert(roi > 0, `Expected positive ROI, got ${roi}`);
});
await test("Ex5: ROI calculation is correct", () => {
  // timeSaved = 10 * 120 = 1200, investment = 200 + 100 = 300
  // ROI = (1200 - 300) / 300 * 100 = 300%
  assertEqual(calculateTestROI(10, 120, 200, 100), 300);
});

// --- Exercise 6 ---
await test("Ex6: sorts features by risk*frequency descending", () => {
  const features: Feature[] = [
    { name: "login", risk: 9, frequency: 7 },
    { name: "settings", risk: 2, frequency: 3 },
    { name: "checkout", risk: 10, frequency: 8 },
  ];
  const sorted = prioritizeTests(features);
  assertEqual(sorted[0].name, "checkout");
  assertEqual(sorted[1].name, "login");
  assertEqual(sorted[2].name, "settings");
});
await test("Ex6: does not mutate original array", () => {
  const features: Feature[] = [
    { name: "a", risk: 1, frequency: 1 },
    { name: "b", risk: 5, frequency: 5 },
  ];
  const sorted = prioritizeTests(features);
  assertEqual(features[0].name, "a");
  assertEqual(sorted[0].name, "b");
});

run();
