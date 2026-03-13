// =============================================================================
// Lab 10 — Playwright fondamentaux (Solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, assertThrows, run } =
  createTestRunner('Lab 10 — Playwright fondamentaux');

// =============================================================================
// Exercice 1 : createPage — Page simulee
// =============================================================================

interface PageElement {
  role?: string;
  text: string;
  value?: string;
  visible: boolean;
  enabled: boolean;
  tag?: string;
  children?: PageElement[];
}

function createPage() {
  let currentUrl = '';
  const elements: PageElement[] = [];

  function goto(url: string): void {
    currentUrl = url;
  }

  function url(): string {
    return currentUrl;
  }

  function getByRole(role: string, options?: { name?: string }): PageElement | null {
    return elements.find(el => {
      if (el.role !== role) return false;
      if (options?.name && el.text !== options.name) return false;
      return true;
    }) || null;
  }

  function getByText(text: string): PageElement | null {
    return elements.find(el => el.text.includes(text)) || null;
  }

  function getAllByRole(role: string): PageElement[] {
    return elements.filter(el => el.role === role);
  }

  // Exercice 2 : Auto-wait integre dans click et fill
  function click(element: PageElement): void {
    if (!element.visible) throw new Error(`Element "${element.text}" is not visible`);
    if (!element.enabled) throw new Error(`Element "${element.text}" is not enabled`);
    // Click action simulated (no-op for the element itself)
  }

  function fill(element: PageElement, value: string): void {
    if (!element.visible) throw new Error(`Element "${element.text}" is not visible`);
    if (!element.enabled) throw new Error(`Element "${element.text}" is not enabled`);
    element.value = value;
  }

  function content(): PageElement[] {
    return [...elements];
  }

  function addElement(el: PageElement): void {
    elements.push(el);
  }

  function clearElements(): void {
    elements.length = 0;
  }

  return { goto, url, getByRole, getByText, getAllByRole, click, fill, content, addElement, clearElements };
}

// =============================================================================
// Exercice 5 : Assertions helpers
// =============================================================================

function expect(target: PageElement | PageElement[] | null) {
  return {
    toBeVisible(): void {
      if (!target || Array.isArray(target)) throw new Error('Expected a single element');
      if (!target.visible) throw new Error(`Expected element to be visible`);
    },
    toHaveText(expected: string): void {
      if (!target || Array.isArray(target)) throw new Error('Expected a single element');
      if (target.text !== expected) {
        throw new Error(`Expected text "${expected}", got "${target.text}"`);
      }
    },
    toHaveValue(expected: string): void {
      if (!target || Array.isArray(target)) throw new Error('Expected a single element');
      if (target.value !== expected) {
        throw new Error(`Expected value "${expected}", got "${target.value}"`);
      }
    },
    toHaveCount(expected: number): void {
      if (!Array.isArray(target)) throw new Error('Expected an array of elements');
      if (target.length !== expected) {
        throw new Error(`Expected count ${expected}, got ${target.length}`);
      }
    },
    toBeEnabled(): void {
      if (!target || Array.isArray(target)) throw new Error('Expected a single element');
      if (!target.enabled) throw new Error('Expected element to be enabled');
    },
    toBeDisabled(): void {
      if (!target || Array.isArray(target)) throw new Error('Expected a single element');
      if (target.enabled) throw new Error('Expected element to be disabled');
    },
  };
}

// =============================================================================
// Exercice 6 : createTestApp — App multi-pages simulee
// =============================================================================

function createTestApp() {
  const page = createPage();
  const items: string[] = [];
  let loggedIn = false;

  function loadPage(url: string): void {
    page.clearElements();
    page.goto(url);

    if (url === '/login') {
      page.addElement({ role: 'heading', text: 'Login', visible: true, enabled: true });
      page.addElement({ role: 'textbox', text: 'Username', value: '', visible: true, enabled: true });
      page.addElement({ role: 'textbox', text: 'Password', value: '', visible: true, enabled: true });

      const loginBtn: PageElement = { role: 'button', text: 'Login', visible: true, enabled: true };
      page.addElement(loginBtn);

      // Override click to handle login logic
      const originalClick = page.click.bind(page);
      page.click = (el: PageElement) => {
        originalClick(el);
        if (el === loginBtn) {
          const username = page.getByRole('textbox', { name: 'Username' });
          const password = page.getByRole('textbox', { name: 'Password' });
          if (username?.value && password?.value) {
            loggedIn = true;
            loadPage('/dashboard');
          }
        }
      };
    } else if (url === '/dashboard' && loggedIn) {
      page.addElement({ role: 'heading', text: 'Dashboard', visible: true, enabled: true });
      items.forEach(item => {
        page.addElement({ role: 'listitem', text: item, visible: true, enabled: true });
      });

      const addBtn: PageElement = { role: 'button', text: 'Add Item', visible: true, enabled: true };
      page.addElement(addBtn);

      const originalClick = page.click.bind(page);
      page.click = (el: PageElement) => {
        originalClick(el);
        if (el === addBtn) {
          loadPage('/create');
        }
      };
    } else if (url === '/create' && loggedIn) {
      page.addElement({ role: 'heading', text: 'Create Item', visible: true, enabled: true });
      page.addElement({ role: 'textbox', text: 'Title', value: '', visible: true, enabled: true });

      const saveBtn: PageElement = { role: 'button', text: 'Save', visible: true, enabled: true };
      page.addElement(saveBtn);

      const originalClick = page.click.bind(page);
      page.click = (el: PageElement) => {
        originalClick(el);
        if (el === saveBtn) {
          const titleInput = page.getByRole('textbox', { name: 'Title' });
          if (titleInput?.value) {
            items.push(titleInput.value);
            loadPage('/dashboard');
          }
        }
      };
    }
  }

  function goto(url: string): void {
    loadPage(url);
  }

  return { page, goto };
}

// =============================================================================
// Tests
// =============================================================================

// --- Exercice 1 ---
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

// --- Exercice 2 ---
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

// --- Exercice 3 ---
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

// --- Exercice 4 ---
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

// --- Exercice 5 ---
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

// --- Exercice 6 ---
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

run();
