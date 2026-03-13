// =============================================================================
// Lab 07 — Tests de composants (Solution)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, assertDeepEqual, run } =
  createTestRunner('Lab 07 — Tests de composants');

// =============================================================================
// Exercice 1 : createComponent — Rendu avec props
// =============================================================================

function createComponent(template: string, props: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in props ? String(props[key]) : match;
  });
}

// =============================================================================
// Exercice 2 : simulateClick — Gestionnaire d'evenements
// =============================================================================

interface SimulatedElement {
  onClick: (() => void) | null;
  textContent: string;
}

function createElement(text: string): SimulatedElement {
  return { onClick: null, textContent: text };
}

function simulateClick(el: SimulatedElement): void {
  if (el.onClick) {
    el.onClick();
  }
}

function createClickTracker(): { handler: () => void; count: number } {
  const tracker = { handler: () => { tracker.count++; }, count: 0 };
  return tracker;
}

// =============================================================================
// Exercice 3 : renderList — Liste avec classes conditionnelles
// =============================================================================

interface ListItem {
  id: number;
  label: string;
  active?: boolean;
  disabled?: boolean;
}

function renderList(items: ListItem[], template: (item: ListItem) => string): string {
  const inner = items.map(item => template(item)).join('');
  return `<ul>${inner}</ul>`;
}

// =============================================================================
// Exercice 4 : testFormValidation — Formulaire avec regles de validation
// =============================================================================

type ValidationRule =
  | { type: 'required' }
  | { type: 'minLength'; value: number }
  | { type: 'pattern'; value: RegExp; message: string };

interface FormField {
  name: string;
  value: string;
  rules: ValidationRule[];
}

function createForm(fields: FormField[]) {
  const fieldMap = new Map<string, FormField>();
  fields.forEach(f => fieldMap.set(f.name, { ...f }));

  function setFieldValue(name: string, value: string): void {
    const field = fieldMap.get(name);
    if (field) field.value = value;
  }

  function validate(): boolean {
    let valid = true;
    for (const field of fieldMap.values()) {
      const errs = validateField(field);
      if (errs.length > 0) valid = false;
    }
    return valid;
  }

  function validateField(field: FormField): string[] {
    const errors: string[] = [];
    for (const rule of field.rules) {
      switch (rule.type) {
        case 'required':
          if (!field.value.trim()) errors.push(`${field.name} est requis`);
          break;
        case 'minLength':
          if (field.value.length < rule.value)
            errors.push(`${field.name} doit avoir au moins ${rule.value} caracteres`);
          break;
        case 'pattern':
          if (!rule.value.test(field.value)) errors.push(rule.message);
          break;
      }
    }
    return errors;
  }

  function getErrors(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    for (const field of fieldMap.values()) {
      const errs = validateField(field);
      if (errs.length > 0) errors[field.name] = errs;
    }
    return errors;
  }

  function submit(): { success: boolean; data?: Record<string, string>; errors?: Record<string, string[]> } {
    if (validate()) {
      const data: Record<string, string> = {};
      for (const field of fieldMap.values()) {
        data[field.name] = field.value;
      }
      return { success: true, data };
    }
    return { success: false, errors: getErrors() };
  }

  return { setFieldValue, validate, getErrors, submit };
}

// =============================================================================
// Exercice 5 : asyncComponentLoader — Chargement asynchrone
// =============================================================================

function createAsyncComponent<T>(loader: () => Promise<T>) {
  const comp = {
    state: 'idle' as 'idle' | 'loading' | 'success' | 'error',
    data: null as T | null,
    error: null as Error | null,

    async load(): Promise<void> {
      comp.state = 'loading';
      comp.error = null;
      try {
        comp.data = await loader();
        comp.state = 'success';
      } catch (err) {
        comp.error = err instanceof Error ? err : new Error(String(err));
        comp.state = 'error';
      }
    },

    reset(): void {
      comp.state = 'idle';
      comp.data = null;
      comp.error = null;
    },
  };
  return comp;
}

// =============================================================================
// Exercice 6 : SearchableList — Composant complet
// =============================================================================

interface SearchableItem {
  id: number;
  label: string;
  description: string;
}

function createSearchableList(items: SearchableItem[]) {
  let query = '';
  let selectedId: number | null = null;

  function filter(q: string): void {
    query = q.toLowerCase();
  }

  function select(id: number): void {
    selectedId = id;
  }

  function deselect(): void {
    selectedId = null;
  }

  function getDisplayed(): SearchableItem[] {
    if (!query) return [...items];
    return items.filter(
      item =>
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    );
  }

  function getSelected(): SearchableItem | null {
    if (selectedId === null) return null;
    return items.find(item => item.id === selectedId) || null;
  }

  function getQuery(): string {
    return query;
  }

  return { filter, select, deselect, getDisplayed, getSelected, getQuery };
}

// =============================================================================
// Tests
// =============================================================================

// --- Exercice 1 ---
await test('Ex1: createComponent interpole les props simples', () => {
  const html = createComponent('<h1>{{title}}</h1>', { title: 'Bonjour' });
  assertEqual(html, '<h1>Bonjour</h1>');
});

await test('Ex1: createComponent interpole plusieurs props', () => {
  const html = createComponent('<div>{{name}} a {{age}} ans</div>', { name: 'Alice', age: 30 });
  assertEqual(html, '<div>Alice a 30 ans</div>');
});

await test('Ex1: createComponent gere les props manquantes', () => {
  const html = createComponent('<p>{{text}}</p>', {});
  assertEqual(html, '<p>{{text}}</p>');
});

// --- Exercice 2 ---
await test('Ex2: simulateClick declenche le handler', () => {
  const tracker = createClickTracker();
  const el = createElement('Cliquez');
  el.onClick = tracker.handler;
  simulateClick(el);
  assertEqual(tracker.count, 1);
});

await test('Ex2: simulateClick sans handler ne plante pas', () => {
  const el = createElement('Inactif');
  simulateClick(el); // ne doit pas throw
});

await test('Ex2: plusieurs clics incrementent le compteur', () => {
  const tracker = createClickTracker();
  const el = createElement('Multi-clic');
  el.onClick = tracker.handler;
  simulateClick(el);
  simulateClick(el);
  simulateClick(el);
  assertEqual(tracker.count, 3);
});

// --- Exercice 3 ---
await test('Ex3: renderList genere le HTML pour chaque item', () => {
  const items: ListItem[] = [
    { id: 1, label: 'Item 1' },
    { id: 2, label: 'Item 2' },
  ];
  const html = renderList(items, (item) => `<li>${item.label}</li>`);
  assertEqual(html, '<ul><li>Item 1</li><li>Item 2</li></ul>');
});

await test('Ex3: renderList ajoute la classe active', () => {
  const items: ListItem[] = [
    { id: 1, label: 'A', active: true },
    { id: 2, label: 'B', active: false },
  ];
  const html = renderList(items, (item) =>
    `<li class="${item.active ? 'active' : ''}">${item.label}</li>`
  );
  assert(html.includes('class="active"'), 'Doit contenir la classe active');
  assert(html.includes('class=""'), 'Item inactif doit avoir classe vide');
});

await test('Ex3: renderList avec liste vide', () => {
  const html = renderList([], (item) => `<li>${item.label}</li>`);
  assertEqual(html, '<ul></ul>');
});

// --- Exercice 4 ---
await test('Ex4: formulaire valide detecte champ requis vide', () => {
  const form = createForm([
    { name: 'email', value: '', rules: [{ type: 'required' }] },
  ]);
  const valid = form.validate();
  assertEqual(valid, false);
  const errors = form.getErrors();
  assert(errors['email'].length > 0, 'Doit avoir une erreur sur email');
});

await test('Ex4: formulaire valide detecte minLength', () => {
  const form = createForm([
    { name: 'password', value: 'ab', rules: [{ type: 'minLength', value: 6 }] },
  ]);
  assertEqual(form.validate(), false);
});

await test('Ex4: formulaire valide avec pattern email', () => {
  const form = createForm([
    { name: 'email', value: 'invalid', rules: [{ type: 'pattern', value: /^[^@]+@[^@]+\.[^@]+$/, message: 'Email invalide' }] },
  ]);
  assertEqual(form.validate(), false);
  const errors = form.getErrors();
  assert(errors['email'].includes('Email invalide'), 'Doit contenir le message personnalise');
});

await test('Ex4: submit retourne les donnees si valide', () => {
  const form = createForm([
    { name: 'name', value: 'Alice', rules: [{ type: 'required' }] },
  ]);
  const result = form.submit();
  assertEqual(result.success, true);
  assertDeepEqual(result.data, { name: 'Alice' });
});

// --- Exercice 5 ---
await test('Ex5: asyncComponent demarre en idle', () => {
  const comp = createAsyncComponent(async () => 'data');
  assertEqual(comp.state, 'idle');
  assertEqual(comp.data, null);
});

await test('Ex5: asyncComponent passe en success apres chargement', async () => {
  const comp = createAsyncComponent(async () => ({ users: ['Alice'] }));
  await comp.load();
  assertEqual(comp.state, 'success');
  assertDeepEqual(comp.data, { users: ['Alice'] });
});

await test('Ex5: asyncComponent passe en error si le loader echoue', async () => {
  const comp = createAsyncComponent(async () => { throw new Error('Echec reseau'); });
  await comp.load();
  assertEqual(comp.state, 'error');
  assertEqual(comp.error!.message, 'Echec reseau');
});

await test('Ex5: asyncComponent reset remet a idle', async () => {
  const comp = createAsyncComponent(async () => 'data');
  await comp.load();
  comp.reset();
  assertEqual(comp.state, 'idle');
  assertEqual(comp.data, null);
});

// --- Exercice 6 ---
await test('Ex6: SearchableList affiche tous les items par defaut', () => {
  const list = createSearchableList([
    { id: 1, label: 'Pomme', description: 'Fruit rouge' },
    { id: 2, label: 'Banane', description: 'Fruit jaune' },
  ]);
  assertEqual(list.getDisplayed().length, 2);
});

await test('Ex6: SearchableList filtre par label', () => {
  const list = createSearchableList([
    { id: 1, label: 'Pomme', description: 'Fruit rouge' },
    { id: 2, label: 'Banane', description: 'Fruit jaune' },
    { id: 3, label: 'Poire', description: 'Fruit vert' },
  ]);
  list.filter('po');
  assertEqual(list.getDisplayed().length, 2);
  assertEqual(list.getQuery(), 'po');
});

await test('Ex6: SearchableList selectionne un item', () => {
  const list = createSearchableList([
    { id: 1, label: 'Pomme', description: 'Fruit rouge' },
    { id: 2, label: 'Banane', description: 'Fruit jaune' },
  ]);
  list.select(2);
  assertEqual(list.getSelected()!.label, 'Banane');
});

await test('Ex6: SearchableList deselectionne', () => {
  const list = createSearchableList([
    { id: 1, label: 'Pomme', description: 'Fruit rouge' },
  ]);
  list.select(1);
  list.deselect();
  assertEqual(list.getSelected(), null);
});

await test('Ex6: SearchableList filtre aussi par description', () => {
  const list = createSearchableList([
    { id: 1, label: 'Pomme', description: 'Fruit rouge' },
    { id: 2, label: 'Tomate', description: 'Legume rouge' },
    { id: 3, label: 'Banane', description: 'Fruit jaune' },
  ]);
  list.filter('rouge');
  assertEqual(list.getDisplayed().length, 2);
});

run();
