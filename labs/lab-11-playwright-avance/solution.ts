// =============================================================================
// Lab 11 — Playwright avance (Solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, assertDeepEqual, run } =
  createTestRunner('Lab 11 — Playwright avance');

// =============================================================================
// Exercice 1 : Page Object Model
// =============================================================================

class BasePage {
  protected currentUrl: string = '';
  protected elements: Map<string, { value?: string; visible: boolean; items?: string[] }> = new Map();

  get url(): string {
    return this.currentUrl;
  }

  navigate(url: string): void {
    this.currentUrl = url;
  }

  isVisible(name: string): boolean {
    const el = this.elements.get(name);
    return el?.visible ?? false;
  }
}

class LoginPage extends BasePage {
  private username = '';
  private password = '';

  constructor() {
    super();
    this.navigate('/login');
    this.elements.set('username', { value: '', visible: true });
    this.elements.set('password', { value: '', visible: true });
    this.elements.set('submit', { visible: true });
  }

  fillUsername(value: string): void {
    this.username = value;
    this.elements.get('username')!.value = value;
  }

  fillPassword(value: string): void {
    this.password = value;
    this.elements.get('password')!.value = value;
  }

  submit(): { success: boolean; redirectTo?: string } {
    if (this.username && this.password) {
      return { success: true, redirectTo: '/dashboard' };
    }
    return { success: false };
  }
}

class DashboardPage extends BasePage {
  private items: string[] = [];

  constructor() {
    super();
    this.navigate('/dashboard');
    this.elements.set('itemList', { visible: true, items: this.items });
    this.elements.set('addButton', { visible: true });
  }

  getItems(): string[] {
    return [...this.items];
  }

  addItem(title: string): void {
    this.items.push(title);
  }

  editItem(index: number, newTitle: string): void {
    if (index >= 0 && index < this.items.length) {
      this.items[index] = newTitle;
    }
  }

  deleteItem(index: number): void {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
    }
  }
}

// =============================================================================
// Exercice 2 : Fixtures
// =============================================================================

function createAuthContext(options: { username: string; role: string }) {
  return {
    isAuthenticated: true,
    user: { username: options.username, role: options.role },
    token: `token-${options.username}-${Date.now()}`,
  };
}

function createTestData(options: { itemCount: number }) {
  const items = Array.from({ length: options.itemCount }, (_, i) => ({
    id: i + 1,
    title: `Test Item ${i + 1}`,
    description: `Description for item ${i + 1}`,
  }));
  return { items };
}

// =============================================================================
// Exercice 3 : Network interception
// =============================================================================

function createNetworkInterceptor() {
  const routes = new Map<string, { status: number; body: unknown }>();
  const interceptions: string[] = [];

  function interceptRoute(url: string, response: { status: number; body: unknown }): void {
    routes.set(url, response);
  }

  function fetch(url: string): { status: number; body: unknown } {
    if (routes.has(url)) {
      interceptions.push(url);
      return routes.get(url)!;
    }
    return { status: 404, body: { error: 'Not found' } };
  }

  function getInterceptions(): string[] {
    return [...interceptions];
  }

  function reset(): void {
    routes.clear();
    interceptions.length = 0;
  }

  return { interceptRoute, fetch, getInterceptions, reset };
}

// =============================================================================
// Exercice 4 : Screenshot comparison
// =============================================================================

function createScreenshotManager() {
  const snapshots = new Map<string, string>();

  function capture(name: string, state: Record<string, unknown>): void {
    snapshots.set(name, JSON.stringify(state));
  }

  function getSnapshot(name: string): Record<string, unknown> | undefined {
    const data = snapshots.get(name);
    return data ? JSON.parse(data) : undefined;
  }

  function assertUnchanged(name: string, current: Record<string, unknown>): boolean {
    const saved = snapshots.get(name);
    if (!saved) return false;
    return saved === JSON.stringify(current);
  }

  function getSnapshots(): string[] {
    return [...snapshots.keys()];
  }

  return { capture, getSnapshot, assertUnchanged, getSnapshots };
}

// =============================================================================
// Exercice 5 : Test tagging
// =============================================================================

function createTaggedTestSuite() {
  const tests: { name: string; tags: string[]; fn: () => boolean }[] = [];

  function addTest(name: string, tags: string[], fn: () => boolean): void {
    tests.push({ name, tags, fn });
  }

  function runByTag(tag: string): { passed: number; failed: number; skipped: number } {
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const t of tests) {
      if (!t.tags.includes(tag)) {
        skipped++;
        continue;
      }
      try {
        const result = t.fn();
        if (result) passed++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return { passed, failed, skipped };
  }

  function runAll(): { passed: number; failed: number } {
    let passed = 0;
    let failed = 0;

    for (const t of tests) {
      try {
        const result = t.fn();
        if (result) passed++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return { passed, failed };
  }

  function getTestsByTag(tag: string): string[] {
    return tests.filter(t => t.tags.includes(tag)).map(t => t.name);
  }

  return { addTest, runByTag, runAll, getTestsByTag };
}

// =============================================================================
// Tests
// =============================================================================

// --- Exercice 1 ---
await test('Ex1: LoginPage — navigation et champs', () => {
  const page = new LoginPage();
  assertEqual(page.url, '/login');
  page.fillUsername('admin');
  page.fillPassword('secret');
  const result = page.submit();
  assertEqual(result.success, true);
  assertEqual(result.redirectTo, '/dashboard');
});

await test('Ex1: LoginPage — echec sans mot de passe', () => {
  const page = new LoginPage();
  page.fillUsername('admin');
  const result = page.submit();
  assertEqual(result.success, false);
});

await test('Ex1: DashboardPage — gestion des items', () => {
  const page = new DashboardPage();
  page.addItem('Item 1');
  page.addItem('Item 2');
  assertEqual(page.getItems().length, 2);
  page.editItem(0, 'Item 1 Updated');
  assertEqual(page.getItems()[0], 'Item 1 Updated');
  page.deleteItem(1);
  assertEqual(page.getItems().length, 1);
});

// --- Exercice 2 ---
await test('Ex2: createAuthContext fournit un utilisateur connecte', () => {
  const ctx = createAuthContext({ username: 'admin', role: 'admin' });
  assertEqual(ctx.isAuthenticated, true);
  assertEqual(ctx.user.username, 'admin');
  assertEqual(ctx.user.role, 'admin');
  assert(ctx.token.length > 0, 'Doit avoir un token');
});

await test('Ex2: createTestData fournit des donnees de test', () => {
  const data = createTestData({ itemCount: 3 });
  assertEqual(data.items.length, 3);
  assert(data.items[0].title.length > 0, 'Items doivent avoir un titre');
});

// --- Exercice 3 ---
await test('Ex3: network interception — mock une route', () => {
  const net = createNetworkInterceptor();
  net.interceptRoute('/api/users', { status: 200, body: [{ id: 1, name: 'Alice' }] });
  const res = net.fetch('/api/users');
  assertEqual(res.status, 200);
  assertEqual((res.body as unknown[]).length, 1);
});

await test('Ex3: network interception — route non interceptee retourne 404', () => {
  const net = createNetworkInterceptor();
  const res = net.fetch('/api/unknown');
  assertEqual(res.status, 404);
});

await test('Ex3: network interception — historique des interceptions', () => {
  const net = createNetworkInterceptor();
  net.interceptRoute('/api/users', { status: 200, body: [] });
  net.fetch('/api/users');
  net.fetch('/api/users');
  assertEqual(net.getInterceptions().length, 2);
});

// --- Exercice 4 ---
await test('Ex4: screenshot — capture et comparaison', () => {
  const screenshots = createScreenshotManager();
  const state1 = { title: 'Home', items: 3, visible: true };
  screenshots.capture('homepage', state1);
  const unchanged = screenshots.assertUnchanged('homepage', state1);
  assertEqual(unchanged, true);
});

await test('Ex4: screenshot — detecte un changement', () => {
  const screenshots = createScreenshotManager();
  screenshots.capture('homepage', { title: 'Home', items: 3 });
  const unchanged = screenshots.assertUnchanged('homepage', { title: 'Home', items: 5 });
  assertEqual(unchanged, false);
});

// --- Exercice 5 ---
await test('Ex5: tagged tests — filtrage par tag', () => {
  const suite = createTaggedTestSuite();
  suite.addTest('login works', ['@smoke', '@regression'], () => true);
  suite.addTest('complex scenario', ['@regression'], () => true);
  suite.addTest('performance check', ['@performance'], () => true);

  const smokeTests = suite.getTestsByTag('@smoke');
  assertEqual(smokeTests.length, 1);
  assertEqual(smokeTests[0], 'login works');

  const regressionTests = suite.getTestsByTag('@regression');
  assertEqual(regressionTests.length, 2);
});

await test('Ex5: tagged tests — execution par tag', () => {
  const suite = createTaggedTestSuite();
  suite.addTest('test1', ['@smoke'], () => true);
  suite.addTest('test2', ['@smoke'], () => false);
  suite.addTest('test3', ['@regression'], () => true);

  const result = suite.runByTag('@smoke');
  assertEqual(result.passed, 1);
  assertEqual(result.failed, 1);
  assertEqual(result.skipped, 1);
});

// --- Exercice 6 ---
await test('Ex6: POM complet — login, ajouter, editer, supprimer', () => {
  // Login
  const loginPage = new LoginPage();
  loginPage.fillUsername('admin');
  loginPage.fillPassword('password');
  const loginResult = loginPage.submit();
  assertEqual(loginResult.success, true);

  // Dashboard — add items
  const dashboard = new DashboardPage();
  dashboard.addItem('Article 1');
  dashboard.addItem('Article 2');
  dashboard.addItem('Article 3');
  assertEqual(dashboard.getItems().length, 3);

  // Edit
  dashboard.editItem(0, 'Article 1 (modifie)');
  assertEqual(dashboard.getItems()[0], 'Article 1 (modifie)');

  // Delete
  dashboard.deleteItem(2);
  assertEqual(dashboard.getItems().length, 2);

  // Verify final state
  assertDeepEqual(dashboard.getItems(), ['Article 1 (modifie)', 'Article 2']);
});

run();
