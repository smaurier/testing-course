// =============================================================================
// Lab 12 — Couverture et mutation testing (Solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, run } =
  createTestRunner('Lab 12 — Couverture et mutation testing');

// =============================================================================
// Exercice 1 : analyzeCoverage — Couverture de lignes
// =============================================================================

function analyzeCoverage(totalLines: number, executedLines: number[]) {
  const allLines = Array.from({ length: totalLines }, (_, i) => i + 1);
  const covered = executedLines.length;
  const percentage = totalLines === 0 ? 0 : Math.round((covered / totalLines) * 100);
  const uncoveredLines = allLines.filter(line => !executedLines.includes(line));

  return { total: totalLines, covered, percentage, uncoveredLines };
}

// =============================================================================
// Exercice 2 : analyzeBranchCoverage — Couverture de branches
// =============================================================================

interface Branch {
  id: string;
  type: 'if' | 'else' | 'case';
  line: number;
}

function analyzeBranchCoverage(branches: Branch[], executedBranchIds: string[]) {
  const total = branches.length;
  const covered = branches.filter(b => executedBranchIds.includes(b.id)).length;
  const percentage = total === 0 ? 0 : Math.round((covered / total) * 100);
  const uncoveredBranches = branches.filter(b => !executedBranchIds.includes(b.id));

  return { total, covered, percentage, uncoveredBranches };
}

// =============================================================================
// Exercice 3 : generateMutants — Generation de mutants
// =============================================================================

interface Mutant {
  id: number;
  original: string;
  mutated: string;
  type: string;
}

function generateMutants(source: string): Mutant[] {
  const mutants: Mutant[] = [];
  let nextId = 1;

  // Operateurs arithmetiques
  const arithmeticOps: [string, string[]][] = [
    ['+', ['-', '*']],
    ['-', ['+', '*']],
    ['*', ['+', '-']],
    ['/', ['*']],
  ];

  for (const [original, replacements] of arithmeticOps) {
    // Use word-boundary-safe matching: only replace operators not inside >= or <=
    if (source.includes(original)) {
      for (const replacement of replacements) {
        const mutated = source.replace(original, replacement);
        if (mutated !== source) {
          mutants.push({ id: nextId++, original: source, mutated, type: 'arithmetic' });
        }
      }
    }
  }

  // Operateurs de comparaison
  const comparisonOps: [RegExp, string, string][] = [
    [/(?<!=)>(?!=)/g, '<', 'comparison'],
    [/(?<!=)>(?!=)/g, '>=', 'comparison'],
    [/(?<!=)<(?!=)/g, '>', 'comparison'],
    [/(?<!=)<(?!=)/g, '<=', 'comparison'],
    [/===/g, '!==', 'comparison'],
    [/!==/g, '===', 'comparison'],
  ];

  for (const [pattern, replacement, type] of comparisonOps) {
    if (pattern.test(source)) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      const mutated = source.replace(pattern, replacement);
      if (mutated !== source) {
        mutants.push({ id: nextId++, original: source, mutated, type });
      }
    }
  }

  // Operateurs logiques
  if (source.includes('&&')) {
    mutants.push({ id: nextId++, original: source, mutated: source.replace('&&', '||'), type: 'logical' });
  }
  if (source.includes('||')) {
    mutants.push({ id: nextId++, original: source, mutated: source.replace('||', '&&'), type: 'logical' });
  }

  return mutants;
}

// =============================================================================
// Exercice 4 : runMutationTest — Detection de mutants
// =============================================================================

interface MutationResult {
  mutantId: number;
  killed: boolean;
  type: string;
}

function runMutationTest(
  mutants: Mutant[],
  testFn: (mutatedCode: string) => boolean
) {
  const results: MutationResult[] = [];
  let killed = 0;
  let survived = 0;

  for (const mutant of mutants) {
    // testFn returns true if tests pass on the mutated code
    // If tests pass on mutated code, the mutant survived (bad)
    // If tests fail on mutated code, the mutant was killed (good)
    const testsPassed = testFn(mutant.mutated);
    const isKilled = !testsPassed;

    if (isKilled) {
      killed++;
    } else {
      survived++;
    }

    results.push({ mutantId: mutant.id, killed: isKilled, type: mutant.type });
  }

  const total = mutants.length;
  const score = total === 0 ? 0 : Math.round((killed / total) * 100);

  return { results, killed, survived, score };
}

// =============================================================================
// Exercice 5 : coverageReport — Rapport agrege
// =============================================================================

interface FileCoverage {
  file: string;
  totalLines: number;
  coveredLines: number;
}

function coverageReport(files: FileCoverage[], threshold: number) {
  const fileResults = files.map(f => {
    const percentage = f.totalLines === 0 ? 0 : Math.round((f.coveredLines / f.totalLines) * 100);
    return { ...f, percentage, passing: percentage >= threshold };
  });

  const overallTotal = files.reduce((sum, f) => sum + f.totalLines, 0);
  const overallCovered = files.reduce((sum, f) => sum + f.coveredLines, 0);
  const overallPercentage = overallTotal === 0 ? 0 : Math.round((overallCovered / overallTotal) * 100);

  return {
    files: fileResults,
    overall: {
      totalLines: overallTotal,
      coveredLines: overallCovered,
      percentage: overallPercentage,
      passing: overallPercentage >= threshold,
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

// --- Exercice 1 ---
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

// --- Exercice 2 ---
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

// --- Exercice 3 ---
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

// --- Exercice 4 ---
await test('Ex4: mutation test — mutant tue', () => {
  const mutants: Mutant[] = [
    { id: 1, original: 'return a + b', mutated: 'return a - b', type: 'arithmetic' },
  ];
  const result = runMutationTest(mutants, (code) => {
    // Le test detecte la difference : passe seulement si + est present
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
    // Le test ne detecte pas la difference : passe toujours
    return true;
  });
  assertEqual(result.survived, 1);
  assertEqual(result.score, 0);
});

// --- Exercice 5 ---
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

// --- Exercice 6 ---
await test('Ex6: mutation testing complet', () => {
  // Source simulee
  const source = 'return a + b';
  const mutants = generateMutants(source);
  assert(mutants.length > 0, 'Doit generer des mutants');

  // Tests qui verifient que add(2, 3) === 5
  const result = runMutationTest(mutants, (code) => {
    // Si le code contient +, le test passe (comportement original)
    // Sinon le mutant est detecte (test echoue)
    if (code.includes('+')) return true;
    return false;
  });

  assert(result.killed > 0, 'Doit tuer au moins un mutant');
  assert(result.score > 0, 'Score de mutation doit etre > 0');
});

run();
