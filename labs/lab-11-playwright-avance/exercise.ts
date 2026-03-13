// =============================================================================
// Lab 11 — Playwright avance (Exercice)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, assertDeepEqual, run } =
  createTestRunner('Lab 11 — Playwright avance');

// =============================================================================
// Exercice 1 : Page Object Model
// Implementez BasePage, LoginPage et DashboardPage.
// =============================================================================

// TODO: Implementez les Page Objects
// class BasePage {
//   protected currentUrl: string = '';
//   protected elements: Map<string, { value?: string; visible: boolean; items?: string[] }> = new Map();
//   get url(): string { return this.currentUrl; }
//   navigate(url: string): void { ... }
//   isVisible(name: string): boolean { ... }
// }
//
// class LoginPage extends BasePage {
//   constructor() { super(); this.navigate('/login'); ... }
//   fillUsername(value: string): void { ... }
//   fillPassword(value: string): void { ... }
//   submit(): { success: boolean; redirectTo?: string } { ... }
// }
//
// class DashboardPage extends BasePage {
//   constructor() { super(); this.navigate('/dashboard'); ... }
//   getItems(): string[] { ... }
//   addItem(title: string): void { ... }
//   editItem(index: number, newTitle: string): void { ... }
//   deleteItem(index: number): void { ... }
// }

// =============================================================================
// Exercice 2 : Fixtures
// Creez des helpers pour preparer l'etat des tests.
// =============================================================================

// TODO: Implementez createAuthContext et createTestData

// =============================================================================
// Exercice 3 : Network interception
// Simulez l'interception des appels reseau.
// =============================================================================

// TODO: Implementez createNetworkInterceptor
// function createNetworkInterceptor(): {
//   interceptRoute: (url: string, response: { status: number; body: unknown }) => void;
//   fetch: (url: string) => { status: number; body: unknown };
//   getInterceptions: () => string[];
//   reset: () => void;
// }

// =============================================================================
// Exercice 4 : Screenshot comparison
// Capturez et comparez les etats d'une page.
// =============================================================================

// TODO: Implementez createScreenshotManager
// function createScreenshotManager(): {
//   capture: (name: string, state: Record<string, unknown>) => void;
//   getSnapshot: (name: string) => Record<string, unknown> | undefined;
//   assertUnchanged: (name: string, current: Record<string, unknown>) => boolean;
//   getSnapshots: () => string[];
// }

// =============================================================================
// Exercice 5 : Test tagging
// Systeme de tags pour filtrer les tests.
// =============================================================================

// TODO: Implementez createTaggedTestSuite
// function createTaggedTestSuite(): {
//   addTest: (name: string, tags: string[], fn: () => boolean) => void;
//   runByTag: (tag: string) => { passed: number; failed: number; skipped: number };
//   runAll: () => { passed: number; failed: number };
//   getTestsByTag: (tag: string) => string[];
// }

// =============================================================================
// Exercice 6 : POM complet — LoginPage -> DashboardPage CRUD
// =============================================================================

// TODO: Scenario complet avec Page Objects

// =============================================================================
// Tests
// =============================================================================

/* Decommentez les tests au fur et a mesure

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

await test('Ex3: network interception — mock une route', () => {
  const net = createNetworkInterceptor();
  net.interceptRoute('/api/users', { status: 200, body: [{ id: 1, name: 'Alice' }] });
  const res = net.fetch('/api/users');
  assertEqual(res.status, 200);
  assertEqual((res.body as any[]).length, 1);
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

*/

run();
