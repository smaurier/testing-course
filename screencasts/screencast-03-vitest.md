# Screencast 03 — Vitest fondamentaux

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/03-vitest-fondamentaux.md`
- **Lab associe** : Lab 03
- **Prérequis** : Screencast 02

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal intégré ouvert
- [ ] Projet de demo avec Vitest installe
- [ ] Fichier `modules/03-vitest-fondamentaux.md` ouvert

## Script

### [00:00-02:00] Introduction — Pourquoi Vitest remplace Jest

> Jest a ete le standard pendant des annees, mais il a ete concu pour CommonJS. Avec l'adoption massive d'ESM, TypeScript et Vite, Vitest offre une experience bien superieure : zero config avec Vite, support ESM natif, et une vitesse de démarrage beaucoup plus rapide.

**Action** : Afficher la comparaison.

```
CRITERE                    | JEST              | VITEST
---------------------------|-------------------|------------------
Support ESM natif          | Partiel           | Natif via Vite
Vitesse demarrage          | Lent (Babel)      | Rapide (esbuild)
Config TypeScript          | ts-jest requis    | Zero config
Watch mode                 | Re-execute tout   | HMR intelligent
API                        | Reference         | Compatible Jest
```

### [02:00-05:30] Configuration — vitest.config.ts

> Configurons Vitest correctement pour un projet TypeScript.

**Action** : Créer `vitest.config.ts`.

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,           // describe, it, expect sans import
    environment: 'node',     // ou 'jsdom' pour le DOM
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/**/*.d.ts'],
    },
  },
});
```

**Action** : Ajouter les scripts dans `package.json`.

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### [05:30-09:00] Matchers — L'arsenal complet

> Les matchers sont les assertions de Vitest. Vous en connaissez déjà `toBe` et `toEqual`, mais il y en a beaucoup plus.

**Action** : Créer `src/matchers-demo.test.ts`.

```typescript
describe('Matchers essentiels', () => {
  // Egalite
  it('toBe — egalite stricte (===)', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toBe('hello');
  });

  it('toEqual — egalite profonde (objets/tableaux)', () => {
    expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } });
    expect([1, 2, 3]).toEqual([1, 2, 3]);
  });

  // Veracite
  it('truthiness', () => {
    expect(null).toBeNull();
    expect(undefined).toBeUndefined();
    expect('hello').toBeTruthy();
    expect(0).toBeFalsy();
  });

  // Nombres
  it('numbers', () => {
    expect(0.1 + 0.2).toBeCloseTo(0.3); // floating point !
    expect(10).toBeGreaterThan(5);
    expect(10).toBeLessThanOrEqual(10);
  });

  // Strings
  it('strings', () => {
    expect('Hello World').toContain('World');
    expect('hello@test.com').toMatch(/^[\w.]+@[\w.]+$/);
  });

  // Tableaux et objets
  it('arrays and objects', () => {
    expect([1, 2, 3]).toContain(2);
    expect([{ id: 1 }, { id: 2 }]).toContainEqual({ id: 1 });
    expect({ name: 'Alice', age: 30 }).toHaveProperty('name', 'Alice');
  });

  // Exceptions
  it('exceptions', () => {
    expect(() => { throw new Error('oops'); }).toThrow('oops');
    expect(() => { throw new Error('oops'); }).toThrow(Error);
  });
});
```

**Action** : Exécuter et montrer le rapport.

```bash
npx vitest run src/matchers-demo.test.ts
```

### [09:00-11:30] Modificateurs — .only, .skip, .todo, .each

> Les modificateurs controlent quels tests s'executent.

**Action** : Demontrer chaque modificateur.

```typescript
describe('Modificateurs', () => {
  it.only('seul ce test s execute', () => {
    expect(true).toBe(true);
  });

  it.skip('ce test est ignore', () => {
    expect(true).toBe(false); // ne s'execute pas
  });

  it.todo('implementer la validation email');

  // .each — tests parametrises
  it.each([
    { input: 'hello', expected: 5 },
    { input: '',      expected: 0 },
    { input: 'hi',    expected: 2 },
  ])('length of "$input" should be $expected', ({ input, expected }) => {
    expect(input.length).toBe(expected);
  });
});
```

> `.each` est particulierement puissant : un seul bloc de test pour N cas. C'est ideal pour les fonctions pures avec de nombreux cas de bord.

### [11:30-14:00] Snapshots — Inline et fichier

> Les snapshots capturent la sortie d'une valeur et la comparent aux executions suivantes.

**Action** : Demontrer les deux types de snapshots.

```typescript
describe('Snapshots', () => {
  // Snapshot fichier — stocke dans __snapshots__/
  it('should match file snapshot', () => {
    const user = { id: 1, name: 'Alice', createdAt: '2024-01-01' };
    expect(user).toMatchSnapshot();
  });

  // Snapshot inline — stocke directement dans le test
  it('should match inline snapshot', () => {
    const greeting = `Hello, ${'Alice'}!`;
    expect(greeting).toMatchInlineSnapshot(`"Hello, Alice!"`);
  });
});
```

> Les snapshots inline sont preferables : le test est auto-documente. Les snapshots fichier sont utiles pour les grosses structures (HTML, JSON volumineux).

### [14:00-16:30] Watch mode et UI mode

> Le watch mode est l'outil de productivite numéro un. Il re-exécuté automatiquement les tests impactes par vos modifications.

**Action** : Lancer le watch mode.

```bash
npx vitest
```

> Vitest détecté les fichiers modifies et ne re-exécuté que les tests concernes grace au HMR de Vite. C'est beaucoup plus rapide que Jest qui doit recalculer le graphe de dépendances.

**Action** : Lancer le UI mode.

```bash
npx vitest --ui
```

> Le UI mode ouvre un navigateur avec une interface graphique. Vous voyez l'arbre des tests, les résultats, le code source et les erreurs. C'est ideal pour le debugging.

### [16:30-18:30] Récapitulatif

> Recapitulons. Vitest offre une config zero-effort avec Vite. Les matchers couvrent tous les cas : egalite, nombres, strings, exceptions. Les modificateurs `.only`, `.skip`, `.todo`, `.each` controlent l'exécution. Les snapshots capturent la sortie pour détecter les regressions. Et le watch mode accelere le workflow.

**Action** : Afficher le récapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Vitest = Jest API + Vite speed + ESM natif
2. toEqual pour les objets, toBe pour les primitives
3. toBeCloseTo pour les flottants (0.1 + 0.2)
4. .each pour les tests parametrises
5. Watch mode + UI mode = productivite maximale

PROCHAINE ETAPE :
→ Screencast 04 : Mocking et test doubles
```

## Points d'attention pour l'enregistrement
- La comparaison Jest/Vitest est importante pour les développeurs venant de Jest
- Montrer toBeCloseTo avec 0.1 + 0.2 — c'est un piege classique
- Le `.each` est sous-utilise — insister sur son utilite
- Le watch mode doit etre montre en live avec des modifications en temps réel
- Le UI mode est visuellement impressionnant — lui donner du temps d'ecran
