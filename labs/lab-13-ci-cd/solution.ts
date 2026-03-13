// =============================================================================
// Lab 13 — CI/CD Pipeline Patterns (solution)
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
      const results: StageResult[] = [];
      const pipelineStart = Date.now();
      let failed = false;

      for (const stage of stages) {
        if (failed) break;

        const start = Date.now();
        try {
          await stage.run();
          results.push({
            name: stage.name,
            status: 'success',
            duration: Date.now() - start,
          });
        } catch (err) {
          failed = true;
          results.push({
            name: stage.name,
            status: 'failure',
            duration: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return {
        stages: results,
        status: failed ? 'failure' : 'success',
        totalDuration: Date.now() - pipelineStart,
      };
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 2 — parallelStages (concurrent execution)
// -----------------------------------------------------------------------------

export async function parallelStages(
  tasks: Array<{ name: string; run: StageFn }>
): Promise<StageResult[]> {
  const promises = tasks.map(async (task) => {
    const start = Date.now();
    try {
      await task.run();
      return {
        name: task.name,
        status: 'success' as const,
        duration: Date.now() - start,
      };
    } catch (err) {
      return {
        name: task.name,
        status: 'failure' as const,
        duration: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  return Promise.all(promises);
}

// -----------------------------------------------------------------------------
// Exercice 3 — matrixBuild (generate combinations)
// -----------------------------------------------------------------------------

export function matrixBuild(nodeVersions: string[], osList: string[]): MatrixEntry[] {
  const matrix: MatrixEntry[] = [];
  for (const node of nodeVersions) {
    for (const os of osList) {
      matrix.push({ node, os });
    }
  }
  return matrix;
}

// -----------------------------------------------------------------------------
// Exercice 4 — cacheManager (memoization)
// -----------------------------------------------------------------------------

export function createCacheManager() {
  const cache = new Map<string, unknown>();

  return {
    async get<T>(key: string, compute: () => Promise<T>): Promise<T> {
      if (cache.has(key)) {
        return cache.get(key) as T;
      }
      const value = await compute();
      cache.set(key, value);
      return value;
    },
    has(key: string): boolean {
      return cache.has(key);
    },
    invalidate(key: string): void {
      cache.delete(key);
    },
    clear(): void {
      cache.clear();
    },
    size(): number {
      return cache.size;
    },
  };
}

// -----------------------------------------------------------------------------
// Exercice 5 — artifactCollector
// -----------------------------------------------------------------------------

export function createArtifactCollector() {
  const artifacts: Artifact[] = [];

  return {
    addTestResult(name: string, passed: number, failed: number): void {
      artifacts.push({
        type: 'test-result',
        name,
        data: { passed, failed, total: passed + failed },
      });
    },
    addCoverage(name: string, percentage: number): void {
      artifacts.push({
        type: 'coverage',
        name,
        data: { percentage },
      });
    },
    getReport(): ArtifactReport {
      let totalTests = 0;
      let totalPassed = 0;
      let totalFailed = 0;
      const coverages: number[] = [];

      for (const artifact of artifacts) {
        if (artifact.type === 'test-result') {
          totalPassed += artifact.data.passed as number;
          totalFailed += artifact.data.failed as number;
          totalTests += artifact.data.total as number;
        } else if (artifact.type === 'coverage') {
          coverages.push(artifact.data.percentage as number);
        }
      }

      const avgCoverage = coverages.length > 0
        ? coverages.reduce((a, b) => a + b, 0) / coverages.length
        : 0;

      return {
        totalTests,
        passed: totalPassed,
        failed: totalFailed,
        coverage: avgCoverage,
        artifacts: [...artifacts],
      };
    },
    getArtifacts(): Artifact[] {
      return [...artifacts];
    },
  };
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
  return createPipeline([
    { name: 'lint', run: config.lintFn },
    { name: 'test:unit', run: config.unitFn },
    { name: 'test:integration', run: config.integrationFn },
    { name: 'test:e2e', run: config.e2eFn },
    { name: 'deploy', run: config.deployFn },
  ]);
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
