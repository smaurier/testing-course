// =============================================================================
// Lab 07 — Tests de composants (Exercice)
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assert, assertEqual, assertDeepEqual, assertThrows, run } =
  createTestRunner('Lab 07 — Tests de composants');

// =============================================================================
// Exercice 1 : createComponent — Rendu avec props
// Implementez une fonction qui prend un template HTML et des props,
// et retourne le HTML avec les {{propName}} remplaces par les valeurs.
// =============================================================================

// TODO: Implementez createComponent
// function createComponent(template: string, props: Record<string, string | number>): string { ... }

// =============================================================================
// Exercice 2 : simulateClick — Gestionnaire d'evenements
// Implementez un element simulé avec un onClick handler et un tracker.
// =============================================================================

// TODO: Implementez createElement et simulateClick
// interface SimulatedElement {
//   onClick: (() => void) | null;
//   textContent: string;
// }
// function createElement(text: string): SimulatedElement { ... }
// function simulateClick(el: SimulatedElement): void { ... }
// function createClickTracker(): { handler: () => void; count: number; } { ... }

// =============================================================================
// Exercice 3 : renderList — Liste avec classes conditionnelles
// Implementez renderList qui genere du HTML a partir d'un tableau d'items.
// =============================================================================

// TODO: Implementez renderList
// interface ListItem { id: number; label: string; active?: boolean; disabled?: boolean; }
// function renderList(items: ListItem[], template: (item: ListItem) => string): string { ... }

// =============================================================================
// Exercice 4 : testFormValidation — Formulaire avec regles de validation
// Implementez un formulaire avec des regles de validation.
// =============================================================================

// TODO: Implementez createForm
// type ValidationRule = { type: 'required' } | { type: 'minLength'; value: number } | { type: 'pattern'; value: RegExp; message: string };
// interface FormField { name: string; value: string; rules: ValidationRule[]; }
// function createForm(fields: FormField[]): {
//   setFieldValue: (name: string, value: string) => void;
//   validate: () => boolean;
//   getErrors: () => Record<string, string[]>;
//   submit: () => { success: boolean; data?: Record<string, string>; errors?: Record<string, string[]> };
// }

// =============================================================================
// Exercice 5 : asyncComponentLoader — Chargement asynchrone
// Implementez un loader de composant avec etats loading/success/error.
// =============================================================================

// TODO: Implementez createAsyncComponent
// function createAsyncComponent<T>(loader: () => Promise<T>): {
//   state: 'idle' | 'loading' | 'success' | 'error';
//   data: T | null;
//   error: Error | null;
//   load: () => Promise<void>;
//   reset: () => void;
// }

// =============================================================================
// Exercice 6 : SearchableList — Composant complet
// Implementez un composant SearchableList avec filtre, selection et affichage.
// =============================================================================

// TODO: Implementez createSearchableList
// interface SearchableItem { id: number; label: string; description: string; }
// function createSearchableList(items: SearchableItem[]): {
//   filter: (query: string) => void;
//   select: (id: number) => void;
//   deselect: () => void;
//   getDisplayed: () => SearchableItem[];
//   getSelected: () => SearchableItem | null;
//   getQuery: () => string;
// }

// =============================================================================
// Tests — Exercice 1
// =============================================================================

/* Decommentez les tests au fur et a mesure de votre implementation

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

// Tests — Exercice 2

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

// Tests — Exercice 3

await test('Ex3: renderList genere le HTML pour chaque item', () => {
  const items = [
    { id: 1, label: 'Item 1' },
    { id: 2, label: 'Item 2' },
  ];
  const html = renderList(items, (item) => `<li>${item.label}</li>`);
  assertEqual(html, '<ul><li>Item 1</li><li>Item 2</li></ul>');
});

await test('Ex3: renderList ajoute la classe active', () => {
  const items = [
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

// Tests — Exercice 4

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

// Tests — Exercice 5

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

// Tests — Exercice 6

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
  assertEqual(list.getDisplayed().length, 2); // Pomme + Poire
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

*/

run();
