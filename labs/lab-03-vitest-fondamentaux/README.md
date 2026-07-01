# Lab 03 — Vitest fondamentaux

> **Outcome :** à la fin, tu sais configurer Vitest sur un projet TypeScript, écrire des assertions avec les bons matchers, paramétrer des cas avec `test.each`, et lire un rapport de coverage v8 — en **Vitest réel**.
> **Vrai outil :** Vitest (`defineConfig`, matchers natifs, `it.each`, `--coverage`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu travailles sur le domaine TribuZen. Voici le code de départ — **ne le modifie pas**, tu écris uniquement les tests :

```typescript
// src/domain/rbac.ts
export type Role = 'owner' | 'admin' | 'member' | 'guest';

export function canInvite(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}

export function canKick(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === 'owner') return targetRole !== 'owner';
  if (actorRole === 'admin') return targetRole === 'member' || targetRole === 'guest';
  return false;
}
```

```typescript
// src/domain/invitation-rules.ts
import { canInvite, type Role } from './rbac'

export interface InvitationDraft {
  familyId: string
  email: string
  status: 'pending'
  invitedBy: Role
}

export function buildInvitation(
  familyId: string,
  email: string,
  role: Role,
): InvitationDraft {
  if (!canInvite(role)) throw new Error('UNAUTHORIZED')
  return { familyId, email, status: 'pending', invitedBy: role }
}
```

Ta mission : écrire `rbac.test.ts` et `invitation-rules.test.ts` qui couvrent tout le comportement **avec les bons matchers et sans duplication**.

## Étapes (en friction)

1. **Config.** Crée `vitest.config.ts` avec `globals: true`, `environment: 'node'`, `coverage.provider: 'v8'` et `thresholds` à 80% sur toutes les métriques. Ajoute `"types": ["vitest/globals"]` dans `tsconfig.json`. Lance `pnpm vitest run` — vérifie que Vitest démarre, même sans tests.

2. **`canInvite` data-driven.** Écris un seul `it.each` avec les 4 rôles (`owner`, `admin`, `member`, `guest`). Utilise la syntaxe tableau-d'objets avec template de nom `$role → $expected`. Assertion : `toBe` (pas `toBeTruthy`). Ajoute un cas "rôle inconnu" (`'superuser' as Role`) pour forcer la branche `false`.

3. **`canKick` data-driven.** Raisonne sur les combinaisons acteur × cible : un `owner` peut-il kick un `owner` ? un `admin` peut-il kick un `admin` ? Écris un `it.each` avec au moins 6 cas qui couvrent les branches importantes. Utilise `toBe`.

4. **`buildInvitation`.** Écris deux tests : (a) le cas nominal avec un `owner` — utilise `toMatchObject` pour n'asserter que les champs qui comptent (pas besoin de connaître d'éventuels champs futurs) ; (b) le cas erreur avec un `member` — utilise `toThrow('UNAUTHORIZED')` avec le bon wrapper. Utilise `beforeEach` pour générer un `familyId` frais à chaque test.

5. **Coverage.** Lance `pnpm vitest run --coverage`. Lis le rapport dans le terminal : toutes les colonnes doivent être vertes (≥ 80%). Si la colonne Branch de `rbac.ts` est sous 100%, identifie quelle branche manque et ajoute le cas manquant.

6. **Filtrage.** Ajoute un `it.todo('canInvite après expiration temporaire du rôle')` dans `rbac.test.ts`. Lance `pnpm vitest run -t "canInvite"` et vérifie que seuls les tests de `canInvite` s'exécutent. Lance `pnpm vitest run -t "canKick"` et vérifie l'isolation.

## Corrigé complet commenté

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,           // describe/it/expect disponibles sans import
    environment: 'node',     // logique pure — pas de DOM
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
})
```

```typescript
// src/domain/rbac.test.ts
import { describe, it, expect } from 'vitest'
import { canInvite, canKick, type Role } from './rbac'

describe('canInvite', () => {
  // test.each — 4 cas en un bloc, noms lisibles dans le rapport
  it.each([
    { role: 'owner' as Role, expected: true },
    { role: 'admin' as Role, expected: true },
    { role: 'member' as Role, expected: false },
    { role: 'guest' as Role, expected: false },
  ])('canInvite($role) → $expected', ({ role, expected }) => {
    // toBe et non toBeTruthy : le contrat retourne boolean, pas juste "truthy"
    expect(canInvite(role)).toBe(expected)
  })

  it('retourne false pour un rôle inconnu (défensif)', () => {
    // couvre la branche else implicite pour les valeurs hors enum
    expect(canInvite('superuser' as Role)).toBe(false)
  })

  // placeholder visible dans le rapport, pas d'échec
  it.todo('canInvite après expiration temporaire du rôle')
})

describe('canKick', () => {
  it.each([
    // owner peut kick tout le monde sauf un autre owner
    { actor: 'owner' as Role, target: 'admin' as Role, expected: true },
    { actor: 'owner' as Role, target: 'owner' as Role, expected: false },
    // admin peut kick member et guest
    { actor: 'admin' as Role, target: 'member' as Role, expected: true },
    { actor: 'admin' as Role, target: 'guest' as Role, expected: true },
    // admin ne peut pas kick admin ni owner
    { actor: 'admin' as Role, target: 'admin' as Role, expected: false },
    { actor: 'admin' as Role, target: 'owner' as Role, expected: false },
    // member ne peut rien faire
    { actor: 'member' as Role, target: 'guest' as Role, expected: false },
  ])('canKick($actor, $target) → $expected', ({ actor, target, expected }) => {
    expect(canKick(actor, target)).toBe(expected)
  })
})
```

```typescript
// src/domain/invitation-rules.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildInvitation } from './invitation-rules'

describe('buildInvitation', () => {
  let familyId: string

  beforeEach(() => {
    // familyId frais par test : isolation sans couplage entre les cas
    familyId = 'fam-' + Math.random().toString(36).slice(2)
  })

  it('crée un InvitationDraft valide pour un owner', () => {
    const draft = buildInvitation(familyId, 'bob@tribu.fr', 'owner')

    // toMatchObject : tolère les champs futurs (id, createdAt) sans casser le test
    expect(draft).toMatchObject({
      familyId,
      email: 'bob@tribu.fr',
      status: 'pending',
      invitedBy: 'owner',
    })
  })

  it('lève UNAUTHORIZED pour un rôle insuffisant (member)', () => {
    // arrow function : sans elle, l'erreur est levée AVANT que expect la reçoive
    // 'UNAUTHORIZED' : substring du message — discrimine ce cas précis d'erreur
    expect(() => buildInvitation(familyId, 'bob@tribu.fr', 'member')).toThrow('UNAUTHORIZED')
  })

  it.each(['member', 'guest'] as const)(
    '%s ne peut pas inviter',
    (role) => {
      expect(() => buildInvitation(familyId, 'x@tribu.fr', role)).toThrow('UNAUTHORIZED')
    },
  )
})
```

Points de validation par le coach : (a) `toBe` et non `toBeTruthy` sur les retours booléens ; (b) `toMatchObject` et non `toEqual` sur `buildInvitation` — le test survit à l'ajout d'un champ `id` ou `createdAt` ; (c) `toThrow` avec wrapper arrow — tester sans wrapper et observer l'erreur ; (d) `beforeEach` génère un `familyId` frais — pas de couplage entre cas ; (e) coverage `Branch` = 100% sur `rbac.ts` grâce au cas "rôle inconnu".

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 20 minutes**, et ajoute la règle suivante à `rbac.ts` :

```typescript
export function canPost(role: Role, isArchived: boolean): boolean {
  if (isArchived) return false;
  return role !== 'guest';
}
```

Écris les tests de `canPost` : utilise `test.each` avec deux dimensions (rôle × isArchived), couvre toutes les branches. Ensuite, remplace le `familyId` généré par `Math.random()` dans `invitation-rules.test.ts` par une constante déterministe dans un `beforeAll` — justifie à voix haute : est-ce que `beforeAll` ou `beforeEach` est plus approprié ici et pourquoi ?

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `src/domain/rbac.ts` avec `canInvite`, `canKick`, et le type `Role` à partir des types existants dans `types/index.ts`.
2. Ajoute `vitest.config.ts` avec `environment: 'node'`, `coverage.provider: 'v8'`, et les seuils à 80%.
3. Écris `src/domain/rbac.test.ts` et `src/domain/invitation-rules.test.ts` en Vitest réel (`pnpm vitest run` ou `npm test`).
4. Lance `pnpm vitest run --coverage` — screenshot le rapport HTML `coverage/index.html` montrant 100% de branches sur `rbac.ts`.
5. Commit `smaurier/tribuzen` : `test(rbac): suite Vitest fondamentaux — canInvite/canKick data-driven, coverage 100% branches`.
