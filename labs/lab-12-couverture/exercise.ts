// =============================================================================
// Lab 12 — Couverture et mutation testing (Exercice)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, run } =
  createTestRunner('Lab 12 — Couverture et mutation testing');

// =============================================================================
// Exercice 1 : analyzeCoverage — Couverture de lignes
// Calculez le pourcentage de lignes executees par rapport au total.
// =============================================================================

// TODO: Implementez analyzeCoverage
// function analyzeCoverage(totalLines: number, executedLines: number[]): {
//   total: number;
//   covered: number;
//   percentage: number;
//   uncoveredLines: number[];
// }

// =============================================================================
// Exercice 2 : analyzeBranchCoverage — Couverture de branches
// Calculez le pourcentage de branches parcourues.
// =============================================================================

// TODO: Implementez analyzeBranchCoverage
// interface Branch { id: string; type: 'if' | 'else' | 'case'; line: number; }
// function analyzeBranchCoverage(branches: Branch[], executedBranchIds: string[]): {
//   total: number;
//   covered: number;
//   percentage: number;
//   uncoveredBranches: Branch[];
// }

// =============================================================================
// Exercice 3 : generateMutants — Generation de mutants
// Creez des mutations simples du code source.
// =============================================================================

// TODO: Implementez generateMutants
// interface Mutant { id: number; original: string; mutated: string; type: string; }
// function generateMutants(source: string): Mutant[]

// =============================================================================
// Exercice 4 : runMutationTest — Detection de mutants
// Executez une fonction de test sur chaque mutant.
// =============================================================================

// TODO: Implementez runMutationTest
// interface MutationResult { mutantId: number; killed: boolean; type: string; }
// function runMutationTest(
//   mutants: Mutant[],
//   testFn: (mutatedCode: string) => boolean
// ): { results: MutationResult[]; killed: number; survived: number; score: number; }

// =============================================================================
// Exercice 5 : coverageReport — Rapport agrege
// Aggregez la couverture de plusieurs fichiers avec seuils.
// =============================================================================

// TODO: Implementez coverageReport
// interface FileCoverage { file: string; totalLines: number; coveredLines: number; }
// function coverageReport(files: FileCoverage[], threshold: number): {
//   files: (FileCoverage & { percentage: number; passing: boolean })[];
//   overall: { totalLines: number; coveredLines: number; percentage: number; passing: boolean };
// }

// =============================================================================
// Exercice 6 : Mutation testing complet
// Combinez tout : fonction, tests, mutants, score.
// =============================================================================

// TODO: Implementez le scenario complet

// =============================================================================
// Tests
// =============================================================================

/* Decommentez les tests au fur et a mesure

await test('Ex1: couverture de lignes 100%', () => {
  const result = analyzeCoverage(5, [1, 2, 3, 4, 5]);
  assertEqual(result.percentage, 100);
  assertEqual(result.uncoveredLines.length, 0);
});

await test('Ex1: couverture de lignes partielle', () => {
  const result = analyzeCoverage(10, [1, 3, 5, 7]);
  assertEqual(result.covered, 4);
  assertEqual(result.percentage, 40);
  assertEqual(result.uncoveredLines.length, 6);
});

await test('Ex1: couverture de lignes 0%', () => {
  const result = analyzeCoverage(5, []);
  assertEqual(result.percentage, 0);
  assertEqual(result.uncoveredLines.length, 5);
});

await test('Ex2: couverture de branches complete', () => {
  const branches: Branch[] = [
    { id: 'b1', type: 'if', line: 5 },
    { id: 'b2', type: 'else', line: 5 },
    { id: 'b3', type: 'if', line: 10 },
  ];
  const result = analyzeBranchCoverage(branches, ['b1', 'b2', 'b3']);
  assertEqual(result.percentage, 100);
});

await test('Ex2: couverture de branches partielle', () => {
  const branches: Branch[] = [
    { id: 'b1', type: 'if', line: 5 },
    { id: 'b2', type: 'else', line: 5 },
    { id: 'b3', type: 'case', line: 15 },
    { id: 'b4', type: 'case', line: 16 },
  ];
  const result = analyzeBranchCoverage(branches, ['b1', 'b3']);
  assertEqual(result.covered, 2);
  assertEqual(result.percentage, 50);
  assertEqual(result.uncoveredBranches.length, 2);
});

await test('Ex3: generation de mutants — operateurs arithmetiques', () => {
  const mutants = generateMutants('return a + b');
  assert(mutants.length > 0, 'Doit generer au moins un mutant');
  assert(mutants.some(m => m.mutated.includes('-')), 'Doit remplacer + par -');
});

await test('Ex3: generation de mutants — operateurs de comparaison', () => {
  const mutants = generateMutants('if (a > b)');
  assert(mutants.some(m => m.mutated.includes('<')), 'Doit remplacer > par <');
  assert(mutants.some(m => m.mutated.includes('>=')), 'Doit remplacer > par >=');
});

await test('Ex3: generation de mutants — operateurs logiques', () => {
  const mutants = generateMutants('if (a && b)');
  assert(mutants.some(m => m.mutated.includes('||')), 'Doit remplacer && par ||');
});

await test('Ex4: mutation test — mutant tue', () => {
  const mutants: Mutant[] = [
    { id: 1, original: 'return a + b', mutated: 'return a - b', type: 'arithmetic' },
  ];
  const result = runMutationTest(mutants, (code) => {
    // Le test detecte la difference : le mutant est tue
    return code.includes('+');
  });
  assertEqual(result.killed, 1);
  assertEqual(result.survived, 0);
  assertEqual(result.score, 100);
});

await test('Ex4: mutation test — mutant survivant', () => {
  const mutants: Mutant[] = [
    { id: 1, original: 'return a + b', mutated: 'return a - b', type: 'arithmetic' },
  ];
  const result = runMutationTest(mutants, (_code) => {
    // Le test ne detecte pas la difference : le mutant survit
    return true;
  });
  assertEqual(result.survived, 1);
  assertEqual(result.score, 0);
});

await test('Ex5: rapport de couverture — tous les fichiers passent', () => {
  const files: FileCoverage[] = [
    { file: 'utils.ts', totalLines: 100, coveredLines: 90 },
    { file: 'service.ts', totalLines: 50, coveredLines: 45 },
  ];
  const report = coverageReport(files, 80);
  assertEqual(report.overall.passing, true);
  assert(report.overall.percentage === 90, 'Overall 135/150 = 90%');
});

await test('Ex5: rapport de couverture — un fichier echoue', () => {
  const files: FileCoverage[] = [
    { file: 'utils.ts', totalLines: 100, coveredLines: 90 },
    { file: 'legacy.ts', totalLines: 100, coveredLines: 50 },
  ];
  const report = coverageReport(files, 80);
  assertEqual(report.files[1].passing, false);
  assertEqual(report.overall.percentage, 70);
  assertEqual(report.overall.passing, false);
});

await test('Ex6: mutation testing complet', () => {
  // Fonction cible : calcul simple
  function add(a: number, b: number): number { return a + b; }
  function subtract(a: number, b: number): number { return a - b; }

  // Source simulee
  const source = 'return a + b';
  const mutants = generateMutants(source);
  assert(mutants.length > 0, 'Doit generer des mutants');

  // Tests qui verrifient add(2, 3) === 5
  const result = runMutationTest(mutants, (code) => {
    // Simule : si le code contient +, le test passe (original)
    // Si le code contient -, le test echoue (mutant tue)
    if (code.includes('+')) return true;  // original passe
    return false;                          // mutant detecte = tue
  });

  assert(result.killed > 0, 'Doit tuer au moins un mutant');
  assert(result.score > 0, 'Score de mutation doit etre > 0');
});

*/

run();
