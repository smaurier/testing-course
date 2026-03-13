// =============================================================================
// Lab 10 — Playwright fondamentaux (Exercice)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, assertDeepEqual, assertThrows, run } =
  createTestRunner('Lab 10 — Playwright fondamentaux');

// =============================================================================
// Exercice 1 : createPage — Page simulee
// Implementez une page qui simule les APIs Playwright de base.
// =============================================================================

// TODO: Implementez createPage
// interface PageElement {
//   role?: string;
//   text: string;
//   value?: string;
//   visible: boolean;
//   enabled: boolean;
//   tag?: string;
//   children?: PageElement[];
// }
// interface Page {
//   goto: (url: string) => void;
//   url: () => string;
//   getByRole: (role: string, options?: { name?: string }) => PageElement | null;
//   getByText: (text: string) => PageElement | null;
//   getAllByRole: (role: string) => PageElement[];
//   click: (element: PageElement) => void;
//   fill: (element: PageElement, value: string) => void;
//   content: () => PageElement[];
//   addElement: (el: PageElement) => void;
// }

// =============================================================================
// Exercice 2 : Auto-wait
// Les actions doivent lancer une erreur si l'element n'est pas visible/enabled.
// =============================================================================

// TODO: Ajoutez la logique d'auto-wait dans click et fill

// =============================================================================
// Exercice 3 : Tests de formulaire
// =============================================================================

// TODO: Testez un formulaire avec fill et click

// =============================================================================
// Exercice 4 : Tests de navigation
// =============================================================================

// TODO: Testez que goto change l'URL et le contenu

// =============================================================================
// Exercice 5 : Assertions helpers
// =============================================================================

// TODO: Implementez expect(element)
// function expect(element: PageElement | PageElement[] | null): {
//   toBeVisible: () => void;
//   toHaveText: (expected: string) => void;
//   toHaveValue: (expected: string) => void;
//   toHaveCount: (expected: number) => void;
//   toBeEnabled: () => void;
//   toBeDisabled: () => void;
// }

// =============================================================================
// Exercice 6 : Scenario complet — login -> dashboard -> create -> verify
// =============================================================================

// TODO: Implementez createTestApp qui simule une app multi-pages

// =============================================================================
// Tests
// =============================================================================

/* Decommentez les tests au fur et a mesure

await test('Ex1: createPage initialise une page vide', () => {
  const page = createPage();
  assertEqual(page.url(), '');
  assertEqual(page.content().length, 0);
});

await test('Ex1: goto change l\'URL', () => {
  const page = createPage();
  page.goto('https://example.com');
  assertEqual(page.url(), 'https://example.com');
});

await test('Ex1: getByRole trouve un element', () => {
  const page = createPage();
  page.addElement({ role: 'button', text: 'Submit', visible: true, enabled: true });
  const btn = page.getByRole('button', { name: 'Submit' });
  assert(btn !== null, 'Doit trouver le bouton');
  assertEqual(btn!.text, 'Submit');
});

await test('Ex1: getByText trouve un element', () => {
  const page = createPage();
  page.addElement({ role: 'heading', text: 'Bienvenue', visible: true, enabled: true });
  const heading = page.getByText('Bienvenue');
  assert(heading !== null, 'Doit trouver le heading');
});

await test('Ex2: click sur element invisible leve une erreur', () => {
  const page = createPage();
  const el: PageElement = { role: 'button', text: 'Hidden', visible: false, enabled: true };
  page.addElement(el);
  assertThrows(() => page.click(el), 'not visible');
});

await test('Ex2: click sur element disabled leve une erreur', () => {
  const page = createPage();
  const el: PageElement = { role: 'button', text: 'Disabled', visible: true, enabled: false };
  page.addElement(el);
  assertThrows(() => page.click(el), 'not enabled');
});

await test('Ex2: fill sur element invisible leve une erreur', () => {
  const page = createPage();
  const el: PageElement = { role: 'textbox', text: '', value: '', visible: false, enabled: true };
  page.addElement(el);
  assertThrows(() => page.fill(el, 'test'), 'not visible');
});

await test('Ex3: fill modifie la valeur de l\'element', () => {
  const page = createPage();
  const input: PageElement = { role: 'textbox', text: 'Email', value: '', visible: true, enabled: true };
  page.addElement(input);
  page.fill(input, 'alice@test.com');
  assertEqual(input.value, 'alice@test.com');
});

await test('Ex3: scenario formulaire complet', () => {
  const page = createPage();
  const nameInput: PageElement = { role: 'textbox', text: 'Name', value: '', visible: true, enabled: true };
  const emailInput: PageElement = { role: 'textbox', text: 'Email', value: '', visible: true, enabled: true };
  let submitted = false;
  const submitBtn: PageElement = { role: 'button', text: 'Submit', visible: true, enabled: true };
  page.addElement(nameInput);
  page.addElement(emailInput);
  page.addElement(submitBtn);

  page.fill(nameInput, 'Alice');
  page.fill(emailInput, 'alice@test.com');
  page.click(submitBtn);

  assertEqual(nameInput.value, 'Alice');
  assertEqual(emailInput.value, 'alice@test.com');
});

await test('Ex4: navigation change le contenu de la page', () => {
  const page = createPage();
  const routes: Record<string, PageElement[]> = {
    '/': [{ role: 'heading', text: 'Accueil', visible: true, enabled: true }],
    '/about': [{ role: 'heading', text: 'A propos', visible: true, enabled: true }],
  };

  page.goto('/');
  routes['/'].forEach(el => page.addElement(el));
  assertEqual(page.getByText('Accueil')!.text, 'Accueil');
});

await test('Ex5: expect().toBeVisible', () => {
  const el: PageElement = { text: 'Hello', visible: true, enabled: true };
  expect(el).toBeVisible();
});

await test('Ex5: expect().toHaveText', () => {
  const el: PageElement = { text: 'Hello World', visible: true, enabled: true };
  expect(el).toHaveText('Hello World');
});

await test('Ex5: expect().toHaveValue', () => {
  const el: PageElement = { text: 'Input', value: 'test', visible: true, enabled: true };
  expect(el).toHaveValue('test');
});

await test('Ex5: expect([]).toHaveCount', () => {
  const els: PageElement[] = [
    { text: 'A', visible: true, enabled: true },
    { text: 'B', visible: true, enabled: true },
  ];
  expect(els).toHaveCount(2);
});

await test('Ex5: expect().toBeDisabled', () => {
  const el: PageElement = { text: 'Btn', visible: true, enabled: false };
  expect(el).toBeDisabled();
});

await test('Ex6: scenario complet — login, dashboard, create, verify', () => {
  const app = createTestApp();

  // Login
  app.goto('/login');
  assertEqual(app.page.url(), '/login');
  const username = app.page.getByRole('textbox', { name: 'Username' })!;
  const password = app.page.getByRole('textbox', { name: 'Password' })!;
  const loginBtn = app.page.getByRole('button', { name: 'Login' })!;
  app.page.fill(username, 'admin');
  app.page.fill(password, 'secret');
  app.page.click(loginBtn);

  // Dashboard
  assertEqual(app.page.url(), '/dashboard');
  const heading = app.page.getByRole('heading')!;
  assertEqual(heading.text, 'Dashboard');

  // Create
  const addBtn = app.page.getByRole('button', { name: 'Add Item' })!;
  app.page.click(addBtn);
  assertEqual(app.page.url(), '/create');
  const titleInput = app.page.getByRole('textbox', { name: 'Title' })!;
  const saveBtn = app.page.getByRole('button', { name: 'Save' })!;
  app.page.fill(titleInput, 'New Item');
  app.page.click(saveBtn);

  // Verify — back on dashboard with new item
  assertEqual(app.page.url(), '/dashboard');
  const items = app.page.getAllByRole('listitem');
  assert(items.length >= 1, 'Doit avoir au moins un item');
  assert(items.some(i => i.text === 'New Item'), 'Doit contenir le nouvel item');
});

*/

run();
