# Lab 12 — Couverture et mutation testing

> **Outcome :** à la fin, tu sais configurer la couverture Vitest (provider v8), lire un rapport branches/stmts/funcs/lines, identifier ce que la couverture ne voit pas, lancer Stryker sur une logique domaine, lire le score de mutation et corriger les tests pour tuer les mutants survivants — en **Vitest + Stryker réels**.
> **Vrai outil :** Vitest coverage v8 + Stryker JS (`@stryker-mutator/vitest-runner`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

On part de la logique d'invitation TribuZen. Code de départ (**ne le modifie pas avant l'étape 5**) :

```ts
// src/invitation/invitation.domain.ts
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface Invitation {
  status: InvitationStatus;
  expiresAt: Date;
}

export function isInvitationValid(invitation: Invitation, now: Date): boolean {
  if (invitation.status !== 'pending') return false;
  return invitation.expiresAt > now;
}
```

Tests de départ :

```ts
// src/invitation/invitation.domain.test.ts
import { describe, it, expect } from 'vitest';
import { isInvitationValid } from './invitation.domain';

const NOW = new Date('2026-07-01T12:00:00Z');

describe('isInvitationValid', () => {
  it('retourne true pour une invitation pending non expirée', () => {
    const inv = { status: 'pending' as const, expiresAt: new Date('2026-07-02T00:00:00Z') };
    expect(isInvitationValid(inv, NOW)).toBe(true);
  });

  it('retourne false pour une invitation acceptée', () => {
    const inv = { status: 'accepted' as const, expiresAt: new Date('2026-07-02T00:00:00Z') };
    expect(isInvitationValid(inv, NOW)).toBe(false);
  });
});
```

Ta mission : parcourir le cycle complet coverage → rapport → Stryker → mutants survivants → tests corrigés.

## Étapes (en friction)

1. **Installer et configurer la couverture.** Installe `@vitest/coverage-v8`. Dans `vitest.config.ts`, configure `coverage.provider: 'v8'`, `include: ['src/**/*.ts']`, les exclusions habituelles, `reporter: ['text', 'html']`, et des `thresholds` à `{ statements: 80, branches: 80, functions: 80, lines: 80 }`.

2. **Premier run de couverture.** Lance `pnpm vitest run --coverage`. Lis le tableau texte. Note les métriques exactes — notamment le % branches. Ouvre `coverage/index.html` pour visualiser les lignes/branches non couvertes. Question : quelle(s) branche(s) manque(nt) ?

3. **Ajouter le cas manquant pour la couverture.** Écris le test qui fait passer la branche branches à 100 % — invitation expirée. Relance la couverture et vérifie que tous les seuils sont verts.

4. **Installer Stryker.** Installe `@stryker-mutator/core @stryker-mutator/vitest-runner`. Crée `stryker.config.mjs` avec `testRunner: 'vitest'`, `plugins: ['@stryker-mutator/vitest-runner']`, `mutate: ['src/invitation/invitation.domain.ts']`, `coverageAnalysis: 'perTest'`, `thresholds: { high: 80, low: 60, break: 50 }`.

5. **Premier run Stryker.** Lance `pnpm stryker run`. Lis le rapport `clear-text`. Note les mutants survivants : quel opérateur est muté, sur quelle ligne, pourquoi il survit ?

6. **Tuer les mutants survivants.** Pour chaque mutant survivant, écris le test qui le tue (cas limite, frontière exacte, valeur contraire). Relance Stryker et vérifie que le score atteint 100 % sur ce fichier.

7. **Discipline CI.** Ajoute deux scripts dans `package.json` : `"test:coverage": "vitest run --coverage"` et `"test:mutation": "stryker run"`. Vérifie que `test:coverage` sort avec code 0 (seuils atteints) et que `test:mutation` sort avec code 0 (score > break threshold).

## Corrigé complet commenté

### Configuration couverture

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      enabled: false,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts',
        'src/**/types.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### Rapport après les 2 tests initiaux

```
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered
------------------------|---------|----------|---------|---------|----------
invitation.domain.ts    |     100 |    66.67 |     100 |     100 | —
```

Branches : 66 % — la branche `expiresAt > now` → false (invitation expirée) n'a jamais été prise. Stmts et Lines à 100 % car les lignes ont été exécutées — mais jamais dans ce chemin.

### Tests complétés — couverture 100 %

```ts
// src/invitation/invitation.domain.test.ts
import { describe, it, expect } from 'vitest';
import { isInvitationValid } from './invitation.domain';

const NOW = new Date('2026-07-01T12:00:00Z');

describe('isInvitationValid', () => {
  it('retourne true pour une invitation pending non expirée', () => {
    // branche status === 'pending' : true
    // branche expiresAt > now : true
    const inv = { status: 'pending' as const, expiresAt: new Date('2026-07-02T00:00:00Z') };
    expect(isInvitationValid(inv, NOW)).toBe(true);
  });

  it('retourne false pour une invitation acceptée (statut non-pending)', () => {
    // branche status !== 'pending' : true → return false immédiat
    const inv = { status: 'accepted' as const, expiresAt: new Date('2026-07-02T00:00:00Z') };
    expect(isInvitationValid(inv, NOW)).toBe(false);
  });

  it('retourne false pour une invitation pending expirée', () => {
    // branche status === 'pending' : true
    // branche expiresAt > now : false ← NOUVELLE BRANCHE COUVERTE
    const inv = { status: 'pending' as const, expiresAt: new Date('2026-06-30T00:00:00Z') };
    expect(isInvitationValid(inv, NOW)).toBe(false);
  });
});
```

Rapport après ce troisième test : 100 % sur toutes les métriques, seuils verts en CI.

### Configuration Stryker

```js
// stryker.config.mjs
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: [
    'src/invitation/invitation.domain.ts',
  ],
  reporters: ['html', 'clear-text', 'progress'],
  logLevel: 'info',
  coverageAnalysis: 'perTest',  // rejoue uniquement les tests liés au mutant → beaucoup plus rapide
  timeoutMS: 10000,
  timeoutFactor: 1.5,
  concurrency: 4,
  thresholds: {
    high: 80,
    low: 60,
    break: 50,  // fait échouer le process CI si score < 50 %
  },
};
```

### Premier run Stryker — mutants survivants identifiés

```
src/invitation/invitation.domain.ts
  Mutation score: 50.00 %
  Killed:   2
  Survived: 2

  [SURVIVED] ConditionalExpression (line 8)
    original  : invitation.expiresAt > now
    mutant    : invitation.expiresAt >= now
    → Aucun test ne vérifie expiresAt === now

  [SURVIVED] BooleanSubstitution (line 7)
    original  : invitation.status !== 'pending'
    mutant    : true
    → Aucun test ne vérifie qu'un statut 'expired' est aussi refusé
```

**Analyse :**
- Mutant 1 (`>` → `>=`) : les tests utilisent `2026-07-02` (clairement futur) et `2026-06-30` (clairement passé). La frontière exacte `now` n'est pas testée.
- Mutant 2 (condition → `true`) : deux statuts sont non-pending (`accepted` + `expired`) ; le test ne couvre que `accepted`.

### Tests finaux — mutants tués, score 100 %

```ts
// src/invitation/invitation.domain.test.ts
import { describe, it, expect } from 'vitest';
import { isInvitationValid } from './invitation.domain';

const NOW = new Date('2026-07-01T12:00:00Z');

describe('isInvitationValid', () => {
  it('retourne true pour une invitation pending non expirée', () => {
    const inv = { status: 'pending' as const, expiresAt: new Date('2026-07-02T00:00:00Z') };
    expect(isInvitationValid(inv, NOW)).toBe(true);
  });

  it('retourne false pour une invitation acceptée', () => {
    const inv = { status: 'accepted' as const, expiresAt: new Date('2026-07-02T00:00:00Z') };
    expect(isInvitationValid(inv, NOW)).toBe(false);
  });

  it('retourne false pour une invitation expired', () => {
    // TUE le mutant BooleanSubstitution : 'expired' est aussi non-pending
    const inv = { status: 'expired' as const, expiresAt: new Date('2026-07-02T00:00:00Z') };
    expect(isInvitationValid(inv, NOW)).toBe(false);
  });

  it('retourne false pour une invitation pending expirée (date passée)', () => {
    const inv = { status: 'pending' as const, expiresAt: new Date('2026-06-30T00:00:00Z') };
    expect(isInvitationValid(inv, NOW)).toBe(false);
  });

  it('retourne false quand expiresAt est exactement now (frontière stricte)', () => {
    // TUE le mutant ConditionalExpression > → >=
    // Si le code était >= : this test renverrait true au lieu de false → test échoue → mutant tué
    const inv = { status: 'pending' as const, expiresAt: NOW };
    expect(isInvitationValid(inv, NOW)).toBe(false);
  });
});
```

Deuxième run Stryker :

```
Mutation score: 100.00 %
Killed:   4
Survived: 0
```

Points de validation par le coach : (a) couverture branches 100 % après le 3e test ; (b) Stryker identifie 2 mutants survivants avec les tests initiaux ; (c) deux tests supplémentaires (frontière exacte + statut `expired`) tuent les mutants ; (d) score de mutation 100 % ; (e) seuils CI verts sur les deux commandes.

## Variante J+30 (fading)

Reprends sans relire le corrigé. Ajoute à `invitation.domain.ts` une deuxième règle :

```ts
export function canReinvite(invitation: Invitation, now: Date): boolean {
  if (invitation.status !== 'expired') return false;
  // On ne peut réinviter que si l'invitation est expirée depuis moins de 30 jours
  const thirtyDays = 30 * 24 * 3600 * 1000;
  return now.getTime() - invitation.expiresAt.getTime() < thirtyDays;
}
```

Objectif : atteindre un mutation score de 100 % sur cette nouvelle fonction en partant de zéro. Contrainte : 25 minutes maximum. Discrimine à voix haute avant d'écrire le premier test : combien de branches ? Quelles frontières ? Quels mutants Stryker va-t-il générer ?

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Copie `invitation.domain.ts` dans `src/invitation/` du repo TribuZen.
2. Configure la couverture dans `vitest.config.ts` avec un seuil plus strict sur `src/invitation/**` (`branches: 90`).
3. Lance le cycle complet (coverage → Stryker) et documente les mutants survivants dans un commentaire de commit.
4. Commit : `test(invitation): 100% mutation score sur isInvitationValid — coverage + Stryker`.
