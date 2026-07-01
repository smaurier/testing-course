---
titre: Anatomie d'un test
cours: 06-testing
notions: [describe it test, structure Arrange-Act-Assert, expect et matchers de base, nommage explicite d'un test, isolation des tests, une assertion logique par test, hooks beforeEach afterEach]
outcomes: [structurer un test en Arrange-Act-Assert, nommer clairement un test, garder les tests isolés, choisir le bon matcher pour l'intention]
prerequis: [01-pourquoi-tester]
next: 03-vitest-fondamentaux
libs: [{ name: vitest, version: ^4.1.9 }]
tribuzen: premier test de la règle d'invitation (refus si déjà membre) en Vitest réel
last-reviewed: 2026-07
---

# Anatomie d'un test

> **Outcomes — tu sauras FAIRE :** structurer un test en Arrange-Act-Assert, nommer clairement un test, garder les tests isolés, choisir le bon matcher pour l'intention.
> **Difficulté :** :star::star:

## 1. Cas concret d'abord

Dans TribuZen, une famille peut inviter quelqu'un par email. La règle métier est simple : si cette personne est **déjà membre**, on lève une erreur `ALREADY_MEMBER`. Tu veux prouver automatiquement que cette règle tient.

```typescript
// src/family/invite.ts
export type Member = { email: string };
export type Family = { id: string; members: Member[] };

export function inviteToFamily(family: Family, email: string): void {
  if (family.members.some(m => m.email === email)) {
    throw new Error('ALREADY_MEMBER');
  }
  family.members.push({ email });
}
```

Problème : comment écrire un test Vitest qui prouve (a) que l'invitation fonctionne sur un email inconnu et (b) que la fonction **lève bien** `ALREADY_MEMBER` si l'email est déjà présent ? Et comment s'assurer que les deux cas ne se contaminent pas ? C'est ce que ce module résout.

## 2. Théorie complète, concise

### `describe`, `it`, `test` — les blocs de structure

`describe` regroupe des tests liés à une même unité (fonction, classe, composant). `it` (ou son alias `test`) déclare un cas de test individuel. L'imbrication forme une hiérarchie lisible dans le rapport.

```typescript
import { describe, it, expect } from 'vitest';

describe('inviteToFamily', () => {
  it('ajoute un email absent à la famille', () => {
    // ...
  });

  it('lève ALREADY_MEMBER si l'email est déjà membre', () => {
    // ...
  });
});
```

Règle : **un `it` = un comportement testé**, pas une branche de code. `describe` peut être imbriqué (max 3 niveaux).

### Structure Arrange-Act-Assert (AAA)

AAA est le squelette universel d'un test unitaire :

- **Arrange** — préparer l'état initial (instances, données, contexte).
- **Act** — appeler le code sous test, une seule fois.
- **Assert** — vérifier que le résultat correspond à l'attendu.

```typescript
it('ajoute un email absent à la famille', () => {
  // ARRANGE
  const family: Family = { id: 'fam-1', members: [] };

  // ACT
  inviteToFamily(family, 'alice@tribu.fr');

  // ASSERT
  expect(family.members).toContainEqual({ email: 'alice@tribu.fr' });
});
```

Cette séparation rend la lecture immédiate : ce qui est préparé, ce qui est déclenché, ce qui est vérifié.

### `expect` et matchers de base

`expect(valeur)` crée une assertion. On chaîne un **matcher** qui exprime l'intention.

**Égalité :**

```typescript
expect(42).toBe(42);                           // identité stricte (===) — primitives
expect({ a: 1 }).toEqual({ a: 1 });            // égalité profonde — objets/tableaux
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }); // correspondance partielle
```

**Contenu :**

```typescript
expect([1, 2, 3]).toContain(2);
expect([{ email: 'a@b.fr' }]).toContainEqual({ email: 'a@b.fr' });
expect([1, 2, 3]).toHaveLength(3);
expect('hello world').toContain('world');
```

**Vérité / nullité :**

```typescript
expect(true).toBeTruthy();
expect(0).toBeFalsy();
expect(null).toBeNull();
expect(undefined).toBeUndefined();
expect('hello').toBeDefined();
```

**Nombres :**

```typescript
expect(5).toBeGreaterThan(4);
expect(0.1 + 0.2).toBeCloseTo(0.3, 5); // flottants
```

**Exceptions — synchrone :**

```typescript
expect(() => inviteToFamily(family, 'alice@tribu.fr')).toThrow('ALREADY_MEMBER');
expect(() => divide(1, 0)).toThrow(Error);
expect(() => divide(1, 0)).toThrow(/zero/);
```

**Exceptions — asynchrone :**

```typescript
await expect(fetchUser(-1)).rejects.toThrow('NOT_FOUND');
await expect(fetchUser(1)).resolves.toEqual({ id: 1 });
```

**Négation :**

```typescript
expect(result).not.toBeNull();
expect(arr).not.toContain(99);
```

### Nommage explicite d'un test

Le nom du `it` doit lire comme une spécification : un lecteur qui ne connaît pas le code comprend ce que le système **fait** dans ce cas.

```typescript
// ❌ Trop vague
it('should work')
it('test email')
it('handles error')

// ❌ Décrit l'implémentation, pas le comportement
it('should call push with the email object')

// ✓ Décrit le comportement attendu
it('ajoute le membre quand l'email est absent de la famille')
it('lève ALREADY_MEMBER si l'email est déjà membre')
it('retourne undefined si l'invitation réussit')
```

Patron courant : **"[verbe d'action] [condition/contexte]"** — concis, en français ou anglais selon la convention du projet, cohérent dans tout le fichier.

### Une assertion logique par test

Chaque `it` ne doit prouver qu'**une seule proposition**. Plusieurs `expect` peuvent coexister **si** ils vérifient la même proposition (ex. : un objet retourné a les bons champs). Mais mélanger deux comportements distincts dans un `it` masque lequel échoue.

```typescript
// ❌ Deux comportements dans un seul test
it('devrait gérer les cas limite', () => {
  expect(inviteToFamily(emptyFamily, 'a@b.fr')).toBeUndefined();
  expect(() => inviteToFamily(fullFamily, 'a@b.fr')).toThrow('ALREADY_MEMBER');
});

// ✓ Un comportement par test
it('retourne undefined si l'invitation réussit', () => {
  const family: Family = { id: 'f', members: [] };
  expect(inviteToFamily(family, 'a@b.fr')).toBeUndefined();
});

it('lève ALREADY_MEMBER si l'email est déjà membre', () => {
  const family: Family = { id: 'f', members: [{ email: 'a@b.fr' }] };
  expect(() => inviteToFamily(family, 'a@b.fr')).toThrow('ALREADY_MEMBER');
});
```

### Isolation des tests

Chaque test doit pouvoir **s'exécuter seul, dans n'importe quel ordre**, et obtenir le même résultat. Un état partagé entre tests (variable déclarée en dehors de `beforeEach`) crée une dépendance silencieuse : un test qui passe seul échoue quand un autre le précède.

```typescript
// ❌ État partagé — les tests sont ordonnés et fragiles
describe('inviteToFamily', () => {
  const family: Family = { id: 'f', members: [] }; // PARTAGÉ

  it('ajoute alice', () => {
    inviteToFamily(family, 'alice@tribu.fr');
    expect(family.members).toHaveLength(1); // passe
  });

  it('échoue pour alice déjà présente', () => {
    // Passe uniquement si le test précédent a tourné !
    expect(() => inviteToFamily(family, 'alice@tribu.fr')).toThrow('ALREADY_MEMBER');
  });
});
```

### Hooks `beforeEach` et `afterEach`

`beforeEach` s'exécute **avant chaque `it`** du `describe` courant : c'est l'endroit pour reconstruire l'état frais. `afterEach` s'exécute **après chaque `it`** : nettoyage (fermer une connexion, restaurer des mocks).

```typescript
describe('inviteToFamily', () => {
  let family: Family;

  beforeEach(() => {
    // Nouvelle famille isolée pour chaque test
    family = { id: 'fam-1', members: [] };
  });

  it('ajoute alice quand la famille est vide', () => {
    inviteToFamily(family, 'alice@tribu.fr');
    expect(family.members).toContainEqual({ email: 'alice@tribu.fr' });
  });

  it('lève ALREADY_MEMBER si alice est déjà membre', () => {
    family.members.push({ email: 'alice@tribu.fr' }); // ARRANGE local
    expect(() => inviteToFamily(family, 'alice@tribu.fr')).toThrow('ALREADY_MEMBER');
  });
});
```

Hiérarchie des hooks (hooks imbriqués dans plusieurs `describe`) :

```
beforeEach du describe parent
  beforeEach du describe enfant
    it(...)
  afterEach du describe enfant
afterEach du describe parent
```

`beforeAll`/`afterAll` s'exécutent une seule fois pour tout le `describe`. Réservés aux ressources coûteuses à créer (serveur, connexion DB) — attention au partage d'état entre tests.

## 3. Worked examples

### Exemple A — test AAA complet sur `inviteToFamily`

Objectif : prouver le cas nominal (email absent → invitation ajoutée) et le cas d'erreur (email présent → lève `ALREADY_MEMBER`). Logique pure, aucun mock nécessaire.

```typescript
// src/family/invite.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { inviteToFamily, type Family } from './invite';

describe('inviteToFamily', () => {
  let family: Family;

  beforeEach(() => {
    // ARRANGE partagé — famille fraîche avant chaque test
    family = { id: 'fam-1', members: [] };
  });

  it('ajoute le membre quand l\'email est absent de la famille', () => {
    // ARRANGE local (complète le beforeEach si besoin)
    // ici : rien à ajouter, family est déjà vide

    // ACT
    inviteToFamily(family, 'alice@tribu.fr');

    // ASSERT
    expect(family.members).toContainEqual({ email: 'alice@tribu.fr' });
    expect(family.members).toHaveLength(1);
  });

  it('lève ALREADY_MEMBER si l\'email est déjà membre', () => {
    // ARRANGE local : alice est déjà dans la famille
    family.members.push({ email: 'alice@tribu.fr' });

    // ACT + ASSERT (toThrow englobe l'ACT dans une flèche)
    expect(() => inviteToFamily(family, 'alice@tribu.fr')).toThrow('ALREADY_MEMBER');
  });

  it('n\'ajoute pas de doublon quand l\'invitation est refusée', () => {
    // ARRANGE
    family.members.push({ email: 'alice@tribu.fr' });
    const countBefore = family.members.length;

    // ACT (capturé dans un try/catch pour asserter après)
    try { inviteToFamily(family, 'alice@tribu.fr'); } catch { /* attendu */ }

    // ASSERT : la liste n'a pas changé
    expect(family.members).toHaveLength(countBefore);
  });
});
```

Pas-à-pas :
1. `beforeEach` recrée `family` → les trois tests sont totalement isolés.
2. Le premier test vérifie la **présence** du membre ajouté (`toContainEqual`) et la **taille** de la liste — même proposition, deux `expect` légitimes.
3. Le deuxième test utilise la flèche `() => inviteToFamily(...)` pour capturer l'exception sans try/catch.
4. Le troisième discrimine : l'erreur est bien levée **et** la liste reste inchangée — preuve qu'il n'y a pas d'effet partiel.

### Exemple B — `describe` imbriqué + nommage par contexte

Quand une fonction a plusieurs familles de cas, on peut imbriquer les `describe` pour regrouper par contexte.

```typescript
describe('inviteToFamily', () => {
  describe('quand la famille est vide', () => {
    it('ajoute le premier membre', () => { /* ... */ });
    it('retourne undefined', () => {
      const family: Family = { id: 'f', members: [] };
      const result = inviteToFamily(family, 'a@b.fr');
      expect(result).toBeUndefined();
    });
  });

  describe('quand l\'email est déjà membre', () => {
    it('lève ALREADY_MEMBER', () => { /* ... */ });
    it('ne modifie pas la liste des membres', () => { /* ... */ });
  });
});
```

Le rapport Vitest affiche l'arbre complet : `inviteToFamily > quand la famille est vide > ajoute le premier membre`. La cause d'un échec est immédiatement lisible.

## 4. Pièges & misconceptions

- **Test qui teste plusieurs choses.** Un `it` qui enchaîne l'invitation, la vérification du doublon, puis la suppression est un test-roman : quand il échoue, on ne sait pas lequel des trois comportements est cassé. *Correct* : un `it` = une proposition. Plusieurs `expect` sont légitimes s'ils vérifient la **même** proposition (ex. l'objet retourné a tous ses champs).

- **Dépendance entre tests.** État partagé dans la portée du `describe` (créé hors `beforeEach`) → le résultat d'un test dépend de l'ordre d'exécution. Vitest peut paralléliser les fichiers ; en mode aléatoire, ça explose. *Correct* : tout état mutable doit être (re)créé dans `beforeEach` ou directement dans l'`it`.

- **Nom vague.** `it('should work')`, `it('test email')` ou `it('handles error')` ne documentent rien. Si le test échoue à 3h du matin, le nom doit dire **quel comportement** est cassé sans rouvrir le code. *Correct* : `it('lève ALREADY_MEMBER si l'email est déjà présent dans la famille')`.

- **Confondre `toBe` et `toEqual`.** `toBe` utilise `===` : il échoue sur deux objets distincts avec les mêmes propriétés. `toEqual` compare profondément. Utiliser `toBe` pour `{ email: 'a@b.fr' }` → toujours faux. *Correct* : `toContainEqual` ou `toEqual` pour les objets ; `toBe` pour les primitives et les références identiques.

- **Oublier la flèche dans `toThrow`.** `expect(inviteToFamily(family, 'a@b.fr')).toThrow(...)` évalue d'abord l'appel → l'exception est levée **avant** que `expect` puisse l'intercepter → le test plante avec l'erreur brute au lieu d'asserter. *Correct* : toujours envelopper dans `() => ...`.

## 5. Ancrage TribuZen

Couche fil-rouge : **premier test de la règle d'invitation (refus si déjà membre) en Vitest réel** (`smaurier/tribuzen`).

- `inviteToFamily` ci-dessus est la vraie règle métier de TribuZen. Le test du module s'écrit directement dans le repo produit, en Vitest réel.
- `beforeEach` reconstruit une `Family` fraîche : en session, c'est la première fois que tu appliques l'isolation — ancre le réflexe.
- Le matcher `toThrow('ALREADY_MEMBER')` correspond au code d'erreur métier réel. Changer la chaîne dans le code → le test casse immédiatement : le test documente le **contrat**.
- La logique est pure (pas d'I/O) : aucun mock requis ici. Les tests du module 04 (mocking) ajouteront les doubles quand `inviteToFamily` dépendra d'un repo ou d'un notifier.

## 6. Points clés

1. `describe` regroupe des tests liés à une unité ; `it`/`test` déclare un cas individuel ; les deux s'imbriquent pour structurer le rapport.
2. AAA (Arrange-Act-Assert) est le squelette universel : préparer l'état, déclencher l'action, vérifier le résultat.
3. `expect(val).matcher()` — choisir le matcher selon l'intention : `toBe` pour les primitives, `toEqual` pour les objets, `toContainEqual` pour les tableaux d'objets, `toThrow` pour les exceptions (avec la flèche).
4. Le nom du `it` est une spécification lisible : comportement attendu + contexte, sans décrire l'implémentation.
5. Un `it` = une proposition logique. Plusieurs `expect` sont légitimes s'ils prouvent la même chose.
6. Tout état mutable doit être recréé dans `beforeEach` — jamais partagé entre tests à l'état brut.
7. `beforeEach` s'exécute avant chaque `it` (réinitialisation) ; `afterEach` s'exécute après (nettoyage). `beforeAll`/`afterAll` = une fois par `describe`.

## 7. Seeds Anki

```
Quelles sont les 3 phases du pattern AAA ?|Arrange (préparer l'état), Act (déclencher l'action), Assert (vérifier le résultat)
Pourquoi envelopper l'appel dans une flèche pour toThrow ?|Sans flèche, l'exception est levée avant que expect() puisse l'intercepter — le test plante au lieu d'asserter
Différence toBe vs toEqual ?|toBe utilise === (identité) — fail sur deux objets distincts même contenu ; toEqual compare en profondeur
Pourquoi recréer l'état dans beforeEach plutôt qu'une fois ?|Pour que chaque test s'exécute indépendamment dans n'importe quel ordre — isolation totale
Règle du nombre d'assertions par it ?|Une proposition logique par it ; plusieurs expect légitimes s'ils vérifient la même proposition
À quoi sert afterEach ?|Nettoyer l'état après chaque test (fermer connexion, restaurer mocks) pour éviter les fuites entre tests
Comment asserter qu'un tableau contient un objet avec une propriété donnée ?|expect(arr).toContainEqual({ email: 'a@b.fr' }) — égalité profonde sur chaque élément
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-02-anatomie-dun-test/`. Tu y écris, en **Vitest réel**, le premier test de la règle d'invitation TribuZen — AAA, `beforeEach`, matchers — plus une suite sur `validateInviteEmail`. Corrigé complet commenté + variante J+30 dans le README du lab.
