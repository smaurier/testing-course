// =============================================================================
// Lab 13 — CI/CD Pipeline Patterns (exercise)
// =============================================================================
// Instructions : implementez chaque fonction TODO puis lancez les tests.
// Commande : npx tsx labs/lab-13-ci-cd/exercise.ts
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface StageResult {
  name: string;
  status: 'success' | 'failure';
  duration: number;
  error?: string;
}

interface PipelineResult {
  stages: StageResult[];
  status: 'success' | 'failure';
  totalDuration: number;
}

interface MatrixEntry {
  node: string;
  os: string;
}

interface Artifact {
  type: 'test-result' | 'coverage';
  name: string;
  data: Record<string, unknown>;
}

interface ArtifactReport {
  totalTests: number;
  passed: number;
  failed: number;
  coverage: number;
  artifacts: Artifact[];
}

// -----------------------------------------------------------------------------
// Exercice 1 — createPipeline (sequential stages)
// -----------------------------------------------------------------------------

type StageFn = () => Promise<void>;

export function createPipeline(stages: Array<{ name: string; run: StageFn }>) {
  return {
    async execute(): Promise<PipelineResult> {
      // TODO: Executer les stages sequentiellement
      // - Mesurer la duree de chaque stage
      // - S'arreter au premier echec (fail-fast)
      // - Retourner le resultat global
      throw new Error('Not implemented');
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 2 — parallelStages (concurrent execution)
// -----------------------------------------------------------------------------

export async function parallelStages(
  tasks: Array<{ name: string; run: StageFn }>
): Promise<StageResult[]> {
  // TODO: Lancer toutes les taches en parallele
  // - Utiliser Promise.allSettled
  // - Retourner les resultats de chaque tache (succes ou echec)
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 3 — matrixBuild (generate combinations)
// -----------------------------------------------------------------------------

export function matrixBuild(nodeVersions: string[], osList: string[]): MatrixEntry[] {
  // TODO: Generer toutes les combinaisons node x os
  // - Ex: ['18','20'] x ['ubuntu','windows'] => 4 combinaisons
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 4 — cacheManager (memoization)
// -----------------------------------------------------------------------------

export function createCacheManager() {
  // TODO: Retourner un objet avec :
  // - get(key, compute): retourne le cache ou calcule et stocke
  // - has(key): verifie si la cle est en cache
  // - invalidate(key): supprime une entree
  // - clear(): vide le cache
  // - size(): nombre d'entrees
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 5 — artifactCollector
// -----------------------------------------------------------------------------

export function createArtifactCollector() {
  // TODO: Retourner un objet avec :
  // - addTestResult(name, passed, failed): ajouter un resultat de test
  // - addCoverage(name, percentage): ajouter un rapport de couverture
  // - getReport(): generer le rapport agrege (ArtifactReport)
  // - getArtifacts(): retourner tous les artefacts
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Exercice 6 — Full pipeline: lint -> unit -> integration -> e2e -> deploy
// -----------------------------------------------------------------------------

export function createFullPipeline(config: {
  lintFn: StageFn;
  unitFn: StageFn;
  integrationFn: StageFn;
  e2eFn: StageFn;
  deployFn: StageFn;
}) {
  // TODO: Creer un pipeline complet avec fail-fast
  // - Chaque stage depend du succes du precedent
  // - Si un stage echoue, les suivants sont sautes (status 'skipped')
  // - Retourner le resultat detaille
  throw new Error('Not implemented');
}

// =============================================================================
// Tests
// =============================================================================

async function main() {
  const { test, assert, assertEqual, assertDeepEqual, run } = createTestRunner('Lab 13 — CI/CD Pipeline Patterns');

  // --- Exercice 1 ---
  await test('Ex1: pipeline executes stages sequentially', async () => {
    const order: string[] = [];
    const pipeline = createPipeline([
      { name: 'lint', run: async () => { order.push('lint'); } },
      { name: 'test', run: async () => { order.push('test'); } },
      { name: 'build', run: async () => { order.push('build'); } },
    ]);
    const result = await pipeline.execute();
    assertDeepEqual(order, ['lint', 'test', 'build']);
    assertEqual(result.status, 'success');
    assertEqual(result.stages.length, 3);
  });

  await test('Ex1: pipeline stops on first failure', async () => {
    const order: string[] = [];
    const pipeline = createPipeline([
      { name: 'lint', run: async () => { order.push('lint'); } },
      { name: 'test', run: async () => { throw new Error('Test failed'); } },
      { name: 'build', run: async () => { order.push('build'); } },
    ]);
    const result = await pipeline.execute();
    assertEqual(result.status, 'failure');
    assertDeepEqual(order, ['lint']);
    assertEqual(result.stages.length, 2);
    assertEqual(result.stages[1].status, 'failure');
    assert(result.stages[1].error === 'Test failed');
  });

  // --- Exercice 2 ---
  await test('Ex2: parallel stages run concurrently', async () => {
    const start = Date.now();
    const results = await parallelStages([
      { name: 'a', run: () => new Promise(r => setTimeout(r, 50)) },
      { name: 'b', run: () => new Promise(r => setTimeout(r, 50)) },
      { name: 'c', run: () => new Promise(r => setTimeout(r, 50)) },
    ]);
    const elapsed = Date.now() - start;
    assertEqual(results.length, 3);
    assert(elapsed < 150, `Should run in parallel, took ${elapsed}ms`);
    assert(results.every(r => r.status === 'success'));
  });

  await test('Ex2: parallel stages collect all results including failures', async () => {
    const results = await parallelStages([
      { name: 'ok', run: async () => {} },
      { name: 'fail', run: async () => { throw new Error('boom'); } },
    ]);
    assertEqual(results.length, 2);
    const ok = results.find(r => r.name === 'ok')!;
    const fail = results.find(r => r.name === 'fail')!;
    assertEqual(ok.status, 'success');
    assertEqual(fail.status, 'failure');
    assertEqual(fail.error, 'boom');
  });

  // --- Exercice 3 ---
  await test('Ex3: matrixBuild generates all combinations', () => {
    const matrix = matrixBuild(['18', '20'], ['ubuntu', 'windows']);
    assertEqual(matrix.length, 4);
    assertDeepEqual(matrix, [
      { node: '18', os: 'ubuntu' },
      { node: '18', os: 'windows' },
      { node: '20', os: 'ubuntu' },
      { node: '20', os: 'windows' },
    ]);
  });

  await test('Ex3: matrixBuild with 3 versions and 2 OS', () => {
    const matrix = matrixBuild(['18', '20', '22'], ['ubuntu', 'macos']);
    assertEqual(matrix.length, 6);
    assert(matrix.some(m => m.node === '22' && m.os === 'macos'));
  });

  // --- Exercice 4 ---
  await test('Ex4: cacheManager caches computed values', async () => {
    const cache = createCacheManager();
    let computeCount = 0;
    const result1 = await cache.get('key1', async () => { computeCount++; return 42; });
    const result2 = await cache.get('key1', async () => { computeCount++; return 99; });
    assertEqual(result1, 42);
    assertEqual(result2, 42);
    assertEqual(computeCount, 1);
    assertEqual(cache.size(), 1);
  });

  await test('Ex4: cacheManager invalidate and clear', async () => {
    const cache = createCacheManager();
    await cache.get('a', async () => 1);
    await cache.get('b', async () => 2);
    assertEqual(cache.size(), 2);
    assert(cache.has('a'));
    cache.invalidate('a');
    assert(!cache.has('a'));
    assertEqual(cache.size(), 1);
    cache.clear();
    assertEqual(cache.size(), 0);
  });

  // --- Exercice 5 ---
  await test('Ex5: artifactCollector aggregates test results', () => {
    const collector = createArtifactCollector();
    collector.addTestResult('unit', 10, 2);
    collector.addTestResult('integration', 5, 0);
    const report = collector.getReport();
    assertEqual(report.totalTests, 17);
    assertEqual(report.passed, 15);
    assertEqual(report.failed, 2);
  });

  await test('Ex5: artifactCollector computes average coverage', () => {
    const collector = createArtifactCollector();
    collector.addTestResult('unit', 10, 0);
    collector.addCoverage('unit', 80);
    collector.addCoverage('integration', 60);
    const report = collector.getReport();
    assertEqual(report.coverage, 70);
    assertEqual(report.artifacts.length, 3);
  });

  // --- Exercice 6 ---
  await test('Ex6: full pipeline runs all stages on success', async () => {
    const order: string[] = [];
    const pipeline = createFullPipeline({
      lintFn: async () => { order.push('lint'); },
      unitFn: async () => { order.push('unit'); },
      integrationFn: async () => { order.push('integration'); },
      e2eFn: async () => { order.push('e2e'); },
      deployFn: async () => { order.push('deploy'); },
    });
    const result = await pipeline.execute();
    assertDeepEqual(order, ['lint', 'unit', 'integration', 'e2e', 'deploy']);
    assertEqual(result.status, 'success');
    assertEqual(result.stages.length, 5);
  });

  await test('Ex6: full pipeline stops on failure and skips remaining', async () => {
    const order: string[] = [];
    const pipeline = createFullPipeline({
      lintFn: async () => { order.push('lint'); },
      unitFn: async () => { throw new Error('unit tests failed'); },
      integrationFn: async () => { order.push('integration'); },
      e2eFn: async () => { order.push('e2e'); },
      deployFn: async () => { order.push('deploy'); },
    });
    const result = await pipeline.execute();
    assertEqual(result.status, 'failure');
    assertDeepEqual(order, ['lint']);
    assertEqual(result.stages[1].status, 'failure');
    assertEqual(result.stages[1].error, 'unit tests failed');
  });

  run();
}

main();
