---
titre: Vitest fondamentaux
cours: 06-testing
notions: [configuration vitest.config, matchers toBe toEqual toContain toThrow toMatchObject, test.each data-driven, hooks lifecycle beforeAll afterEach, watch mode, filtrage only skip todo, coverage v8 en survol, environnement jsdom vs node]
outcomes: [configurer Vitest pour un projet TypeScript, utiliser les matchers courants avec la bonne intention, exécuter et filtrer des tests, lire un rapport de coverage]
prerequis: [02-anatomie-dun-test]
next: 04-mocking-et-test-doubles
libs: [{ name: vitest, version: ^4.1.9 }]
tribuzen: suite de tests unitaires des règles domaine TribuZen (invitation, RBAC)
last-reviewed: 2026-07
---

# Vitest fondamentaux

> **Outcomes — tu sauras FAIRE :** configurer Vitest pour un projet TypeScript, choisir le bon matcher selon l'intention du test, exécuter et filtrer des tests, lire un rapport de coverage v8.
> **Difficulté :** :star::star:

## 1. Cas concret d'abord

Dans TribuZen, seuls les membres `owner` ou `admin` d'une famille peuvent en inviter d'autres. Tu viens d'écrire la règle domaine :

```typescript
// src/domain/rbac.ts
export type Role = 'owner' | 'admin' | 'member' | 'guest';

export function canInvite(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}
```

Tu veux tester les quatre rôles et produire un rapport de coverage. Mais rien n'est encore configuré : pas de Vitest, pas de `vitest.config.ts`, pas de matchers ni de boucle sur les cas. Comment passer de zéro à une suite verte qui couvre toutes les branches et ne casse pas en CI ?

Ce module répond exactement à ça.

## 2. Théorie complète, concise

### Configuration Vitest v4

Installe Vitest et le provider coverage en dev-dependencies :

```bash
pnpm add -D vitest @vitest/coverage-v8
```

Crée `vitest.config.ts` à la racine du projet :

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Expose describe/it/expect sans import dans chaque fichier de test
    globals: true,

    // 'node' = défaut, pour la logique pure (règles domaine, services)
    // 'jsdom' = DOM simulé (window, document, localStorage)
    // 'happy-dom' = jsdom allégé, moins fidèle mais plus rapide
    environment: 'node',

    // Fichiers de test découverts automatiquement
    include: ['src/**/*.{test,spec}.ts'],

    // Exécuté avant chaque fichier de test (polyfills, reset globaux)
    setupFiles: ['./src/test-setup.ts'],

    // Timeouts
    testTimeout: 5000,
    hookTimeout: 10000,

    // Coverage v8 : fourni par le moteur V8 de Node.js, sans instrumentation
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
})
```

Pour que TypeScript reconnaisse les globals `describe`, `it`, `expect` sans import, ajouter dans `tsconfig.json` :

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

#### `environment` — node vs jsdom

| Besoin | Valeur | Raison |
|--------|--------|--------|
| Logique métier pure, règles domaine, calculs | `node` | Pas de DOM à simuler, démarrage plus rapide |
| Composants accédant à `document`, `window`, `localStorage` | `jsdom` | JSDOM implémente le DOM dans Node.js |
| DOM requis, vitesse prioritaire | `happy-dom` | Implémentation allégée de JSDOM |

Surcharge par fichier : ajouter `// @vitest-environment jsdom` en première ligne du fichier.

### Matchers courants — intention avant signature

Choisir le bon matcher exprime **pourquoi** le test passe et produit un message d'échec lisible.

#### `toBe` — identité stricte (`Object.is`)

```typescript
// Pour les primitives : boolean, number, string, null, undefined
expect(canInvite('owner')).toBe(true)
expect(canInvite('guest')).toBe(false)
expect(2 + 2).toBe(4)
// NE PAS utiliser sur des objets : deux littéraux sont deux références différentes
// expect({ id: 1 }).toBe({ id: 1 }) → ÉCHOUE même si les valeurs sont identiques
```

#### `toEqual` — égalité profonde récursive

```typescript
// Pour les objets et tableaux — compare les valeurs, pas les références
expect({ role: 'admin', active: true }).toEqual({ role: 'admin', active: true })
expect([1, 2, 3]).toEqual([1, 2, 3])
// NOTE : toEqual IGNORE les propriétés à valeur undefined
expect({ a: 1, b: undefined }).toEqual({ a: 1 }) // PASSE
```

#### `toStrictEqual` — égalité profonde stricte

```typescript
// Comme toEqual + vérifie : propriétés undefined, type de classe, sparse arrays
expect({ a: 1, b: undefined }).toStrictEqual({ a: 1 }) // ÉCHOUE

class Invitation { constructor(public id: string) {} }
expect(new Invitation('i-1')).toEqual({ id: 'i-1' })       // PASSE (même forme)
expect(new Invitation('i-1')).toStrictEqual({ id: 'i-1' }) // ÉCHOUE (classe ≠ littéral)
```

Règle : `toEqual` pour les DTO/POJO, `toStrictEqual` quand le type de classe fait partie du contrat.

#### `toContain` — appartenance

```typescript
// Sous-chaîne :
expect('ALREADY_INVITED').toContain('INVITED')
// Élément de tableau (strict === , pas deep equality) :
expect(['owner', 'admin']).toContain('admin')
// Pour un objet dans un tableau, utiliser toContainEqual :
expect([{ id: 'i-1' }, { id: 'i-2' }]).toContainEqual({ id: 'i-1' })
```

#### `toThrow` — erreur synchrone

```typescript
// Toujours envelopper dans une arrow function
// Sans wrapper, l'erreur est levée AVANT que expect la reçoive
expect(() => validate(-1)).toThrow()                  // une erreur quelconque
expect(() => validate(-1)).toThrow('Age invalide')    // message exact (substring)
expect(() => validate(-1)).toThrow(/invalide/)        // regex sur le message
expect(() => validate(-1)).toThrow(RangeError)        // type d'erreur

// Pour les promesses, utiliser .rejects (+ await obligatoire) :
await expect(service.invite('fam', 'bob')).rejects.toThrow('ALREADY_INVITED')
```

#### `toMatchObject` — correspondance partielle d'objet

```typescript
// Vérifie que l'objet CONTIENT les propriétés attendues ; le reste est ignoré
const invitation = { id: 'inv-1', familyId: 'fam-1', email: 'bob@tribu.fr', createdAt: new Date() }
expect(invitation).toMatchObject({ familyId: 'fam-1', email: 'bob@tribu.fr' })
// Idéal quand le résultat contient des champs générés (id, timestamp) inconnus à l'avance
```

### `test.each` — tests data-driven

Évite la duplication de tests quasi-identiques en itérant sur un tableau de cas.

```typescript
// Syntaxe tableau-d'objets (recommandée — auto-nommage via $clé)
it.each([
  { role: 'owner' as Role, expected: true,  label: 'peut inviter' },
  { role: 'admin' as Role, expected: true,  label: 'peut inviter' },
  { role: 'member' as Role, expected: false, label: 'ne peut pas inviter' },
  { role: 'guest' as Role, expected: false,  label: 'ne peut pas inviter' },
])('canInvite($role) → $expected ($label)', ({ role, expected }) => {
  expect(canInvite(role)).toBe(expected)
})

// Syntaxe tableau-de-tableaux (plus concise, nommage via %s/%i/%p)
it.each([
  ['owner', true],
  ['admin', true],
  ['member', false],
  ['guest', false],
])('canInvite("%s") → %s', (role, expected) => {
  expect(canInvite(role as Role)).toBe(expected)
})
```

`describe.each` permet de paramétrer un bloc entier — utile pour tester plusieurs configurations ou environnements.

### Hooks de lifecycle

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'

describe('Suite RBAC', () => {
  let context: Map<string, Role>

  // Exécuté UNE FOIS avant tous les tests du describe
  // Usage : setup lourd (connexion, chargement de fixtures volumineuses)
  beforeAll(() => {
    context = new Map([['user-1', 'owner'], ['user-2', 'member']])
  })

  // Exécuté avant CHAQUE test
  // Usage : construire des objets frais, vider l'état mutable
  beforeEach(() => {
    // reset ou construction légère
  })

  // Exécuté après CHAQUE test
  // Usage : nettoyage léger, reset des mocks (ou via clearMocks: true en config)
  afterEach(() => {
    // cleanup
  })

  // Exécuté UNE FOIS après tous les tests
  // Usage : fermeture de connexions (DB, serveur HTTP)
  afterAll(() => {
    context.clear()
  })

  it('owner peut inviter', () => {
    expect(canInvite(context.get('user-1')!)).toBe(true)
  })
})
```

Ordre d'exécution : `beforeAll` → (`beforeEach` → test → `afterEach`) × N → `afterAll`. Les hooks d'un `describe` imbriqué s'exécutent après ceux du parent.

Règle : `beforeAll`/`afterAll` pour l'infra lourde ; `beforeEach`/`afterEach` pour l'état par-test.

### Watch mode et filtrage CLI

```bash
# Watch mode (défaut) — re-exécute les tests impactés par les changements de fichiers
pnpm vitest

# Exécution unique (CI, scripts)
pnpm vitest run

# Filtrer par fichier ou pattern de chemin
pnpm vitest run src/domain/rbac.test.ts
pnpm vitest run rbac

# Filtrer par nom de test (substring)
pnpm vitest run -t "canInvite"

# Lancer le coverage
pnpm vitest run --coverage

# Interface graphique (arbre de tests, coverage inline, module graph)
pnpm vitest --ui
```

Raccourcis clavier en watch mode : `a` relancer tout, `f` relancer les échoués, `p` filtrer par fichier, `t` filtrer par nom de test, `u` mettre à jour les snapshots, `q` quitter.

### Filtrage dans le code — `only`, `skip`, `todo`

```typescript
// only : seuls ces tests s'exécutent dans le fichier/la suite
it.only('cas critique temporaire', () => { /* ... */ })
describe.only('sous-suite isolée', () => { /* ... */ })
// ⚠ Ne JAMAIS committer .only — configurer ESLint avec eslint-plugin-no-only-tests

// skip : test ignoré (apparaît dans le rapport comme "skipped")
it.skip('bug #42 — reproductible, fix en cours', () => { /* ... */ })
describe.skip('module legacy désactivé', () => { /* ... */ })

// todo : placeholder — visible dans le rapport, ni échec ni skip
it.todo('canInvite après expiration temporaire du rôle')
it.todo('canPost pour les rôles guest sur une famille archivée')
```

### Coverage v8 — lecture rapide

```bash
pnpm vitest run --coverage
```

Sortie console typique :

```
----------|---------|----------|---------|---------|
File      | % Stmts | % Branch | % Funcs | % Lines |
----------|---------|----------|---------|---------|
rbac.ts   |   100   |    75    |   100   |   100   |
----------|---------|----------|---------|---------|
```

- **Stmts / Lines** : chaque instruction visitée.
- **Branch** : chaque branche `if`/`else`/ternaire empruntée (ici 75% = une branche non couverte).
- **Funcs** : chaque fonction appelée au moins une fois.

Le rapport HTML dans `coverage/index.html` surligne les lignes non couvertes. Configurer `thresholds` dans `vitest.config.ts` pour faire échouer le build CI si un seuil n'est pas atteint.

## 3. Worked examples

### Exemple A — config + `test.each` + matchers sur les règles RBAC

```typescript
// src/domain/rbac.test.ts
import { describe, it, expect } from 'vitest'
import { canInvite, type Role } from './rbac'

describe('canInvite — règle RBAC TribuZen', () => {
  // data-driven : 4 rôles couverts en un seul bloc, noms de tests lisibles
  it.each([
    { role: 'owner' as Role, expected: true },
    { role: 'admin' as Role, expected: true },
    { role: 'member' as Role, expected: false },
    { role: 'guest' as Role, expected: false },
  ])('canInvite($role) → $expected', ({ role, expected }) => {
    // toBe est correct : canInvite retourne un boolean (primitif)
    expect(canInvite(role)).toBe(expected)
  })

  it('retourne false pour un rôle inconnu (cas défensif)', () => {
    // TypeScript guard à la compilation ; cette branche couvre le cas runtime
    expect(canInvite('superuser' as Role)).toBe(false)
  })
})
```

Pas-à-pas : (1) `it.each` génère quatre tests nommés `canInvite(owner) → true`, etc. — lisibles dans le rapport ; (2) `toBe` est l'assertion juste pour un retour booléen primitif — `toBeTruthy()` serait plus laxiste et cacherait un bug si la fonction retournait `1` au lieu de `true` ; (3) le cas "rôle inconnu" force la branche `false` qui ne serait pas couverte sinon (coverage 100% branches).

### Exemple B — hooks + `toMatchObject` + `toThrow` sur une règle d'assemblage

```typescript
// src/domain/invitation-rules.ts
import { canInvite, type Role } from './rbac'

export interface InvitationDraft {
  familyId: string
  email: string
  status: 'pending'
  invitedBy: Role
}

export function buildInvitation(familyId: string, email: string, role: Role): InvitationDraft {
  if (!canInvite(role)) throw new Error('UNAUTHORIZED')
  return { familyId, email, status: 'pending', invitedBy: role }
}
```

```typescript
// src/domain/invitation-rules.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildInvitation } from './invitation-rules'

describe('buildInvitation', () => {
  let familyId: string

  beforeEach(() => {
    // familyId frais à chaque test : pas de couplage entre les cas
    familyId = 'fam-' + Math.random().toString(36).slice(2)
  })

  it('crée une invitation avec les bonnes propriétés (owner)', () => {
    const draft = buildInvitation(familyId, 'bob@tribu.fr', 'owner')
    // toMatchObject : si buildInvitation ajoute plus tard un champ createdAt ou id,
    // ce test reste vert sans modification
    expect(draft).toMatchObject({
      familyId,
      email: 'bob@tribu.fr',
      status: 'pending',
      invitedBy: 'owner',
    })
  })

  it('lève UNAUTHORIZED pour un rôle insuffisant', () => {
    // arrow function obligatoire : sans elle, l'erreur est levée avant que expect la reçoive
    expect(() => buildInvitation(familyId, 'bob@tribu.fr', 'member')).toThrow('UNAUTHORIZED')
  })

  it.each(['member', 'guest'] as const)('%s ne peut pas inviter', (role) => {
    expect(() => buildInvitation(familyId, 'x@tribu.fr', role)).toThrow('UNAUTHORIZED')
  })
})
```

Pas-à-pas : (1) `beforeEach` génère un `familyId` isolé par test sans setup lourd ; (2) `toMatchObject` tolère les champs futurs (`id`, `createdAt`) — le test ne se casse pas lors d'une évolution de l'interface ; (3) `toThrow('UNAUTHORIZED')` vérifie le message exact (substring) — pas juste `toThrow()` qui laisserait passer n'importe quelle erreur ; (4) `it.each` sur les deux rôles invalides évite la duplication.

## 4. Pièges & misconceptions

- **`toBe` sur un objet.** `expect({ id: 1 }).toBe({ id: 1 })` échoue car `toBe` utilise `Object.is` (comparaison de référence). Deux littéraux d'objet sont deux allocations distinctes. *Correct* : `toEqual` pour la valeur profonde, `toStrictEqual` si le type de classe est partie du contrat.

- **`toEqual` masque les clés `undefined`.** `expect({ a: 1, b: undefined }).toEqual({ a: 1 })` passe. Si une clé `undefined` doit être absente ou présente explicitement (DTO partiel), utiliser `toStrictEqual`. Confondre les deux produit de faux positifs sur les types avec champs optionnels.

- **Environnement mal choisi.** `jsdom` pour de la logique pure ajoute 100-300 ms de démarrage par fichier de test sans raison. `node` pour un composant accédant à `localStorage` lève `ReferenceError: localStorage is not defined`. *Correct* : `node` par défaut, surcharger avec `// @vitest-environment jsdom` uniquement pour les fichiers qui touchent le DOM.

- **Coverage 100% lines ≠ tests corrects.** `expect(canInvite('owner')).toBeTruthy()` couvre la ligne et la branche, mais `toBeTruthy()` accepterait `1`, `'yes'`, ou n'importe quelle valeur truthy. Le contrat dit `boolean` — asserter `toBe(true)`. Une suite avec 100% de coverage et des assertions larges donne une fausse confiance.

- **Oublier `await` avec `.rejects`.** `expect(promise).rejects.toThrow(...)` sans `await` passe toujours vert parce que la promesse de rejet n'est jamais attendue par le runner. *Correct* : `await expect(promise).rejects.toThrow(...)` systématiquement.

- **Données mutables dans `test.each`.** Si les cas sont des objets partagés et qu'un test les modifie (ex. ajout d'une propriété), le cas suivant hérite de l'état corrompu. *Correct* : données immutables dans `each` (primitifs ou littéraux d'objet) ou reconstruction dans `beforeEach`.

## 5. Ancrage TribuZen

Couche fil-rouge : **suite de tests unitaires des règles domaine TribuZen (invitation, RBAC)** (`smaurier/tribuzen`).

- `canInvite(role)`, `canPost(user, resource)`, `canKick(user, target)` — toutes les règles RBAC s'écrivent en logique pure et se testent avec `toBe` + `test.each` sur les N rôles. Zéro I/O → `environment: 'node'`, exécution < 10 ms par fichier.
- `buildInvitation(familyId, email, role)` — règle qui assemble un DTO invitation : `toMatchObject` tolère l'ajout futur de `id` ou `createdAt` sans casser la suite.
- Les `beforeEach` construisent des fixtures légères (familyId, email) fraîches par test — aucun `beforeAll` lourd à ce niveau (pas de vraie DB encore).
- Le coverage v8 sur ces modules doit atteindre 100% de branches : toutes les combinaisons de rôles sont couvertes par les `test.each`.
- Le `vitest.config.ts` du repo TribuZen utilisera `environment: 'node'` pour tout le domaine ; `jsdom` sera ajouté pour les composants Vue dans un projet séparé.
- En CI, `pnpm vitest run --coverage` fait échouer le build si les seuils ne sont pas atteints — cela protège la suite contre l'ajout de code non testé.

## 6. Points clés

1. `vitest.config.ts` avec `defineConfig` — clés essentielles : `globals`, `environment`, `include`, `setupFiles`, `coverage.provider: 'v8'`.
2. `environment: 'node'` pour la logique pure ; `jsdom` uniquement pour le code qui accède au DOM — ne pas mélanger sans raison.
3. `toBe` = `Object.is` (primitifs) ; `toEqual` = égalité profonde (ignore undefined) ; `toStrictEqual` = toEqual + type de classe + clés undefined.
4. `toContain` = sous-chaîne ou élément strict ; `toMatchObject` = correspondance partielle d'objet (champs supplémentaires ignorés).
5. `toThrow` nécessite un wrapper arrow `() =>` ; pour les promesses, `await expect(...).rejects.toThrow(...)`.
6. `test.each` élimine la duplication et génère des noms de tests lisibles à partir des données.
7. `beforeAll`/`afterAll` pour l'infra lourde (une fois) ; `beforeEach`/`afterEach` pour l'état par-test (frais à chaque test).
8. `only`/`skip`/`todo` pour filtrer en développement — ne jamais committer `only`.
9. Coverage v8 : lire la colonne **Branch**, pas seulement Lines — 100% Lines avec 75% Branch indique des chemins non testés.

## 7. Seeds Anki

```
Différence toBe / toEqual / toStrictEqual ?|toBe = Object.is (référence, primitifs) ; toEqual = égalité profonde (ignore clés undefined) ; toStrictEqual = toEqual + type de classe + clés undefined
Pourquoi toThrow nécessite un wrapper () => ?|Sans wrapper, l'exception est levée AVANT que expect la reçoive — le test plante au lieu d'asserter sur l'erreur
Quand choisir environment jsdom vs node dans Vitest ?|node pour la logique pure (règles domaine, services) ; jsdom quand le code accède à document/window/localStorage
À quoi sert toMatchObject par rapport à toEqual ?|toMatchObject vérifie un sous-ensemble de propriétés — les champs non cités sont ignorés ; toEqual doit correspondre exactement
Comment paramétrer plusieurs cas sans dupliquer un test ?|it.each avec un tableau de cas — Vitest génère un test nommé par cas à partir du template de nom
Différence beforeAll vs beforeEach ?|beforeAll s'exécute UNE fois avant tous les tests du describe (infra lourde) ; beforeEach s'exécute avant CHAQUE test (état frais par-test)
Qu'indique la colonne Branch dans le rapport coverage v8 ?|Le pourcentage de branches if/else/ternaire empruntées — 100% Lines avec 75% Branch signifie des chemins non testés
Comment faire échouer le build CI si le coverage est insuffisant ?|Configurer thresholds dans vitest.config.ts coverage.thresholds — Vitest exit 1 si un seuil n'est pas atteint
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-03-vitest-fondamentaux/`. Tu y configures Vitest sur un projet TypeScript minimal, écris les tests des règles RBAC TribuZen avec les bons matchers, appliques `test.each` pour les quatre rôles, et lis le rapport de coverage v8. Corrigé complet commenté + variante J+30 dans le README du lab.
