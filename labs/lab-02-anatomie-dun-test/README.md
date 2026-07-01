# Lab 02 — Anatomie d'un test

> **Outcome :** à la fin, tu sais structurer un test en Arrange-Act-Assert, isoler les cas avec `beforeEach`, et choisir le bon matcher — en **Vitest réel**.
> **Vrai outil :** Vitest (`describe`, `it`, `expect`, `beforeEach`, `afterEach`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu travailles sur la règle d'invitation TribuZen. Code de départ (déjà fourni, **ne le modifie pas** — tu écris les tests) :

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

export function validateInviteEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

Ta mission : écrire `src/family/invite.test.ts` qui couvre **tout le comportement observable** — sans base de données, sans réseau, sans mock.

## Étapes (en friction)

1. **Squelette.** Crée `invite.test.ts`. Importe `describe`, `it`, `expect`, `beforeEach` depuis `vitest`. Importe `inviteToFamily`, `validateInviteEmail` et les types depuis `./invite`.

2. **beforeEach.** Dans un `describe('inviteToFamily', ...)`, déclare `let family: Family` hors du `beforeEach`, puis réassigne-la dedans à chaque test avec une famille vide (`id: 'fam-1', members: []`). Vérifie que deux tests consécutifs ne se contaminent pas.

3. **Cas nominal.** Écris un `it` qui invite `'alice@tribu.fr'` et asserte que `family.members` contient l'objet `{ email: 'alice@tribu.fr' }` et a une longueur de 1. Choisis les matchers adaptés (`toContainEqual`, `toHaveLength`).

4. **Cas d'erreur.** Écris un `it` qui place d'abord `alice` dans `family.members`, puis asserte que rappeler `inviteToFamily` avec le même email **lève** l'erreur `'ALREADY_MEMBER'`. Pense à la flèche.

5. **Preuve d'absence d'effet.** Écris un `it` qui vérifie qu'après le refus, la liste des membres n'a pas changé de taille.

6. **Suite `validateInviteEmail`.** Dans un deuxième `describe`, couvre : email valide (`alice@tribu.fr`), sans `@`, sans domaine, chaîne vide, espaces. Un `it` par cas.

7. **Lance les tests.** `npx vitest run src/family/invite.test.ts` — tous verts.

Contrainte : **aucun `vi.fn()` ni `vi.mock()`** ici — la logique est pure. Zéro mock pour ce lab.

## Corrigé complet commenté

```typescript
// src/family/invite.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { inviteToFamily, validateInviteEmail, type Family } from './invite';

// ── inviteToFamily ────────────────────────────────────────────────────────────

describe('inviteToFamily', () => {
  let family: Family;

  beforeEach(() => {
    // État frais avant CHAQUE test — isolation totale.
    // Sans beforeEach, l'état accumulé d'un test fuite dans le suivant.
    family = { id: 'fam-1', members: [] };
  });

  it('ajoute le membre quand l\'email est absent de la famille', () => {
    // ARRANGE : family est déjà vide (fournie par beforeEach)

    // ACT
    inviteToFamily(family, 'alice@tribu.fr');

    // ASSERT
    // toContainEqual : égalité profonde sur chaque élément du tableau
    expect(family.members).toContainEqual({ email: 'alice@tribu.fr' });
    // toHaveLength : même proposition — vérifie qu'il n'y a qu'un seul ajout
    expect(family.members).toHaveLength(1);
  });

  it('lève ALREADY_MEMBER si l\'email est déjà membre', () => {
    // ARRANGE local : alice est déjà dans la famille
    family.members.push({ email: 'alice@tribu.fr' });

    // ACT + ASSERT : la flèche est obligatoire — sans elle, l'exception
    // est levée AVANT que expect() puisse l'intercepter.
    expect(() => inviteToFamily(family, 'alice@tribu.fr')).toThrow('ALREADY_MEMBER');
  });

  it('ne modifie pas la liste quand l\'invitation est refusée', () => {
    // ARRANGE
    family.members.push({ email: 'alice@tribu.fr' });
    const sizeBefore = family.members.length; // = 1

    // ACT (échec attendu — on l'absorbe pour asserter l'effet secondaire)
    try { inviteToFamily(family, 'alice@tribu.fr'); } catch { /* attendu */ }

    // ASSERT : aucune mutation partielle
    expect(family.members).toHaveLength(sizeBefore);
  });

  it('retourne undefined quand l\'invitation réussit', () => {
    // Documenter le contrat de retour explicitement
    const result = inviteToFamily(family, 'bob@tribu.fr');
    expect(result).toBeUndefined();
  });

  it('peut inviter plusieurs membres distincts', () => {
    inviteToFamily(family, 'alice@tribu.fr');
    inviteToFamily(family, 'bob@tribu.fr');
    expect(family.members).toHaveLength(2);
    expect(family.members).toContainEqual({ email: 'bob@tribu.fr' });
  });
});

// ── validateInviteEmail ───────────────────────────────────────────────────────

describe('validateInviteEmail', () => {
  it('accepte un email valide', () => {
    expect(validateInviteEmail('alice@tribu.fr')).toBe(true);
  });

  it('rejette un email sans @', () => {
    // toBe(false) : valeur primitive — toBe convient (pas toEqual)
    expect(validateInviteEmail('alicetribu.fr')).toBe(false);
  });

  it('rejette un email sans domaine après le @', () => {
    expect(validateInviteEmail('alice@')).toBe(false);
  });

  it('rejette une chaîne vide', () => {
    expect(validateInviteEmail('')).toBe(false);
  });

  it('rejette un email avec des espaces', () => {
    expect(validateInviteEmail('ali ce@tribu.fr')).toBe(false);
  });
});
```

Points de validation par le coach :
- (a) `beforeEach` reconstruit `family` → les tests `inviteToFamily` sont indépendants de l'ordre.
- (b) La flèche `() => inviteToFamily(...)` dans le cas d'erreur — sans elle le test planterait.
- (c) `toContainEqual` pour les objets, `toBe` pour les primitives — bon choix de matcher selon l'intention.
- (d) Chaque `it` teste une seule proposition ; les deux `expect` du premier cas vérifient la **même** proposition (l'ajout a eu lieu et rien d'autre n'a été ajouté).
- (e) Aucun mock — logique pure, aucune I/O.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 20 min**, avec une contrainte supplémentaire : `inviteToFamily` doit désormais accepter un troisième paramètre `role: 'admin' | 'member'` (défaut `'member'`). Le membre ajouté a la forme `{ email, role }`. Écris les tests qui couvrent :
- L'ajout avec le rôle par défaut.
- L'ajout avec le rôle `'admin'`.
- Le refus de doublon reste inchangé.
- `validateInviteEmail` est inchangé.

Bonus : discrimine à voix haute quel matcher tu utilises pour chaque assertion et pourquoi (`toBe` vs `toEqual` vs `toContainEqual` vs `toMatchObject`).

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `src/family/invite.ts` avec `inviteToFamily` et `validateInviteEmail` à partir du code ci-dessus (adapte les types si `Family` existe déjà dans `types/index.ts`).
2. Écris `src/family/invite.test.ts` avec les mêmes cas — `npx vitest run` doit passer en vert.
3. Vérifie que `beforeEach` reconstruit bien la famille — pas d'état global partagé.
4. Commit `smaurier/tribuzen` : `test(family): anatomie AAA — inviteToFamily + validateInviteEmail en Vitest réel`.
