---
titre: Couverture et mutation testing
cours: 06-testing
notions: [couverture de code v8 vs istanbul, types de couverture lignes branches fonctions instructions, limites de la couverture, principe du mutation testing, Stryker et score de mutation, mutants tués vs survivants, coverage comme signal pas comme objectif]
outcomes: [configurer et lire un rapport de couverture Vitest, comprendre ce que la couverture ne dit pas, expliquer le mutation testing et lire un score de mutation]
prerequis: [11-playwright-avance]
next: 12b-tests-accessibilite
libs: [{ name: vitest, version: ^4.1.9 }, { name: "@stryker-mutator/core", version: ^8 }]
tribuzen: mesurer la couverture des règles domaine TribuZen + un run de mutation testing sur la logique d'invitation
last-reviewed: 2026-07
---

# Couverture et mutation testing

> **Outcomes — tu sauras FAIRE :** configurer et lire un rapport de couverture Vitest (v8/istanbul), comprendre ce que la couverture ne mesure pas, expliquer le mutation testing et lire un score de mutation Stryker.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, la règle domaine suivante contrôle si une invitation est encore valide :

```ts
// src/invitation/invitation.domain.ts
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface Invitation {
  status: InvitationStatus;
  expiresAt: Date;
}

export function isInvitationValid(invitation: Invitation, now: Date): boolean {
  if (invitation.status !== 'pending') return false;
  return invitation.expiresAt > now;   // BUG SUBTIL : devrait être >=
}
```

Ton équipe écrit deux tests et lance la couverture :

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

Résultat de `vitest run --coverage` :

```
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
invitation.domain.ts      |     100 |      100 |     100 |     100 |
```

**100% partout. Pourtant**, une invitation qui expire exactement à `now` devrait être invalide (`expiresAt === now` → `false`) — mais le test ne le couvre jamais. Le mutant `>` → `>=` **survit** à Stryker. La couverture te dit que chaque ligne a été exécutée ; elle ne te dit pas que ta comparaison est correcte à la frontière.

C'est le problème central de ce module : **coverage mesure l'exécution, pas la vérification**.

## 2. Théorie complète, concise

### 2.1 Les deux providers de couverture Vitest

Vitest délègue l'instrumentation à l'un de deux providers, configuré via `test.coverage.provider` :

| Provider | Mécanisme | Vitesse | Précision | Package |
|----------|-----------|---------|-----------|---------|
| **v8** (défaut) | Instrumentation native du moteur V8 — lit les données de couverture directement depuis le runtime | Rapide | Bonne (quelques edge cases sur les branches optionnelles) | `@vitest/coverage-v8` |
| **istanbul** | Transforme le code source avant exécution — insère des compteurs à chaque nœud AST | Plus lent | Excellente (précision au niveau instruction) | `@vitest/coverage-istanbul` |

**Quand choisir :**
- v8 : la majorité des projets. Moins de configuration, sortie identique à c8.
- istanbul : quand tu as besoin de branches précises sur du code transpilé (decorators, optionals) ou d'un rapport fiable pour une couverture d'audit.

### 2.2 Les quatre types de couverture

```ts
// src/pricing.ts
export function applyDiscount(price: number, vip: boolean): number { // instruction 1 (déclaration)
  let total = price;                    // instruction 2
  if (vip) {                            // branche A (true) + branche B (false) + instruction 3
    total = price * 0.8;               // instruction 4
  }
  return total;                         // instruction 5
}
```

| Métrique | Ce qu'elle mesure | Exemple sur ce code |
|----------|-------------------|---------------------|
| **Instructions** (Stmts) | Chaque expression / assignation / appel exécuté | 5 instructions, 4 si vip jamais false |
| **Branches** | Chaque chemin `if/else`, `switch`, `? :`, `??`, `&&`, `\|\|` | 2 branches (vip true / false) |
| **Fonctions** (Funcs) | Chaque déclaration de fonction appelée au moins une fois | 1 fonction |
| **Lignes** (Lines) | Lignes physiques exécutées — approximation des instructions | similaire à Stmts mais par ligne |

**Branches — le mécanisme le plus révélateur.** Un test qui appelle `applyDiscount(100, true)` donne 100% fonctions, 100% lignes, 100% instructions, mais seulement **50% branches** (la branche `vip === false` n'a jamais été prise).

### 2.3 Configurer la couverture Vitest

```bash
# Installer le provider (choisir l'un ou l'autre)
pnpm add -D @vitest/coverage-v8
pnpm add -D @vitest/coverage-istanbul
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',              // ou 'istanbul'
      enabled: false,              // false = activé seulement avec --coverage en CLI
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts',         // barrels : rien à tester
        'src/**/types.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
        // seuils par glob — logique métier plus exigeante
        'src/invitation/**': { statements: 90, branches: 85, functions: 90, lines: 90 },
      },
    },
  },
});
```

**Lancer :**

```bash
pnpm vitest run --coverage            # one-shot avec rapport
pnpm vitest --coverage                # watch mode, recalcule à chaque save
```

Si un seuil n'est pas atteint, **le process sort avec code 1** — ce qui fait échouer la CI.

**Lire le rapport texte :**

```
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------|---------|----------|---------|---------|------------------
invitation.domain.ts    |   66.67 |    50.00 |     100 |   66.67 | 8,11
```

La colonne `Uncovered Line #s` est ton point d'entrée — mais elle ne dit pas *pourquoi* ces lignes ne sont pas testées ni si leur non-couverture est intentionnelle.

**Ignorer du code intentionnellement :**

```ts
/* istanbul ignore next -- @preserve: code de debug uniquement */
if (process.env.NODE_ENV === 'development') {
  console.log('[DEBUG] invitation', invitation);
}
```

Les deux syntaxes `/* istanbul ignore ... */` et `/* v8 ignore ... */` fonctionnent avec les deux providers depuis Vitest 4.x.

### 2.4 Limites de la couverture

La couverture répond à : **« ce code a-t-il été exécuté ? »**. Elle ne répond pas à :

1. **« Ce comportement est-il vérifié ? »** — un test sans `expect` donne 100% de couverture.
2. **« La logique est-elle correcte aux frontières ? »** — le cas `expiresAt === now` ci-dessus.
3. **« Les assertions sont-elles précises ? »** — `expect(result).toBeDefined()` exécute tout le code sans rien vérifier d'utile.
4. **« Le code non couvert est-il mort ou manquant ? »** — une branche à 0% peut être un bug ou un cas légitimement hors-scope.

**Conséquence directe :** 100% de coverage avec des assertions faibles laisse passer des bugs. C'est exactement ce que détecte le mutation testing.

### 2.5 Principe du mutation testing

Le mutation testing renverse la question : au lieu de mesurer si le code est exécuté, il mesure si **les tests détectent une erreur introduite dans le code**.

**Algorithme :**

1. Le framework crée des **mutants** — copies du code source avec une petite modification (un opérateur changé, une constante modifiée, une condition inversée).
2. Il relance la suite de tests sur chaque mutant.
3. **Mutant tué** : au moins un test échoue → les tests sont suffisamment précis pour détecter ce défaut.
4. **Mutant survivant** : tous les tests passent → les tests sont trop faibles sur cette partie du code.

**Types de mutations courants :**

| Catégorie | Original | Mutant |
|-----------|----------|--------|
| Opérateur arithmétique | `price * 0.8` | `price / 0.8` |
| Opérateur de comparaison | `expiresAt > now` | `expiresAt >= now` |
| Opérateur logique | `status === 'pending'` | `status !== 'pending'` |
| Opérateur booléen | `a && b` | `a \|\| b` |
| Littéral numérique | `trialDays = 14` | `trialDays = 0` |
| Bloc conditionnel | `if (vip) { total *= 0.8; }` | `if (vip) {}` |
| Négation | `return false` | `return true` |

### 2.6 Stryker et score de mutation

Stryker JS est le framework de mutation testing de référence pour l'écosystème Node/TypeScript. Il intègre un runner Vitest officiel.

**Installation :**

```bash
pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner
```

**Configuration (`stryker.config.mjs`) :**

```js
// stryker.config.mjs
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  reporters: ['html', 'clear-text', 'progress'],
  logLevel: 'info',
  coverageAnalysis: 'perTest',   // optimise : ne rejoue que les tests liés au mutant
  timeoutMS: 10000,
  timeoutFactor: 1.5,
  concurrency: 4,
  thresholds: {
    high: 80,    // vert dans le rapport HTML
    low: 60,     // orange
    break: 50,   // échoue le process CI en dessous de 50 %
  },
};
```

**Lancer :**

```bash
pnpm stryker run                              # tout le projet
pnpm stryker run --mutate "src/invitation/**" # ciblé sur un dossier
```

**Lire le rapport :**

```
All files
  Mutation score: 72.34 %
  Killed:      34  ← tests détectent la mutation → bien
  Survived:    10  ← tests NE détectent PAS → à corriger
  Timeout:      2  ← mutation crée une boucle infinie → généralement OK
  No coverage:  1  ← code non couvert par aucun test → ajouter des tests

src/invitation/invitation.domain.ts
  Mutation score: 50.00 %
  [SURVIVED] ConditionalExpression: changed "expiresAt > now" to "expiresAt >= now"  (line 8)
```

**Formule du score :**

```
Mutation Score = Killed / (Total − CompileErrors − Timeouts) × 100
```

Un score de **80 %+ sur la logique métier** est une cible réaliste et significative. Les timeouts et les erreurs de compilation sont exclus du calcul car ils ne reflètent pas la qualité des tests.

### 2.7 Coverage = signal, pas objectif

| Utiliser la couverture pour… | Ne PAS utiliser la couverture pour… |
|------------------------------|-------------------------------------|
| Identifier du code mort ou jamais exercé | Mesurer la qualité des tests |
| Trouver les branches non parcourues comme piste | Fixer un objectif absolu (100%) |
| Gate CI minimal (80% global) | Remplacer une revue de tests |
| Comparer deux versions d'une PR | Prouver l'absence de bugs |

La couverture et le mutation score se complètent : coverage détecte le code non exécuté ; Stryker détecte les assertions insuffisantes sur le code exécuté.

## 3. Worked examples

### Exemple A — configurer la couverture et lire le rapport

Mise en situation : la logique d'invitation TribuZen. On ajoute la config, on lance, on lit.

**Situation de départ** — `isInvitationValid` ci-dessus, avec deux tests (cas nominal + statut non-pending).

```bash
# 1. Installer le provider
pnpm add -D @vitest/coverage-v8

# 2. Lancer
pnpm vitest run --coverage
```

Rapport texte attendu :

```
File                      | % Stmts | % Branch | % Funcs | % Lines | Uncovered
--------------------------|---------|----------|---------|---------|----------
invitation.domain.ts      |     100 |    66.67 |     100 |     100 | —
```

Branches : 66 % — deux branches couvertes sur trois (`status !== 'pending'` true + false, `expiresAt > now` true), mais la branche `expiresAt > now` false (invitation expirée) n'a jamais été prise. Pourtant le rapport indique 100 % lignes/fonctions/stmts : chaque ligne a bien été exécutée, mais toujours dans les mêmes conditions.

Correction : ajouter le cas manquant.

```ts
it('retourne false pour une invitation expirée', () => {
  const inv = { status: 'pending' as const, expiresAt: new Date('2026-06-30T00:00:00Z') };
  expect(isInvitationValid(inv, NOW)).toBe(false);
});
```

Nouveau rapport : 100 % branches. Mais le bug à la frontière (`===`) n'est toujours pas révélé.

### Exemple B — un mutant survivant révèle le bug à la frontière

On lance Stryker sur `invitation.domain.ts` :

```bash
pnpm stryker run --mutate "src/invitation/invitation.domain.ts"
```

Stryker génère entre autres ce mutant :

```ts
// Mutant #3 — ConditionalExpression
// Original : return invitation.expiresAt > now;
// Mutant   : return invitation.expiresAt >= now;
```

Résultat : **SURVIVED**. Les tests passent sur le mutant. Cela signifie que le changement `>` → `>=` ne casse aucun test — autrement dit, tes tests ne testent pas la frontière exacte.

**Diagnostic** : aucun test ne vérifie `expiresAt === now`. Le mutant survivant pointe l'oubli.

**Corriger en deux étapes :**

1. Ajouter le test limite :

```ts
it('retourne false quand expiresAt est exactement now', () => {
  const inv = { status: 'pending' as const, expiresAt: NOW };
  // avec > : false ✓   avec >= : true ✗
  expect(isInvitationValid(inv, NOW)).toBe(false);
});
```

2. Relancer Stryker : le mutant #3 est maintenant **tué** car ce nouveau test échoue sur le mutant `>=`.

3. Corriger aussi le code si nécessaire (ici `>` est le comportement voulu : une invitation qui expire exactement maintenant est invalide — le code était correct, c'est le test qui manquait).

Nouveau score de mutation : 100 % sur ce fichier. La couverture à 100 % était atteinte dès le départ — Stryker a révélé ce que la couverture ne pouvait pas voir.

## 4. Pièges & misconceptions

- **Viser 100% de couverture.** Les rendements diminuent fortement après 85-90 % : les lignes restantes sont souvent des barrels, des types, du code défensif ou des cas dégénérés qui coûtent plus de maintenance que ce qu'ils protègent. Pire, pour atteindre 100 %, on finit par écrire des tests couplés à l'implémentation qui cassent à chaque refactor. *Correct :* 80 % global, 90 % sur la logique domaine — et laisser le mutation testing juger la qualité.

- **Coverage sans assertions.** Un test qui appelle le code sans `expect` donne 100 % de couverture et ne protège de rien. Ce piège est invisible dans le rapport de couverture. *Correct :* le mutation testing le révèle immédiatement — un mutant qui renvoie `true` au lieu de `false` survivra si aucun test n'assert la valeur de retour. Stryker est le détecteur de ce pattern.

- **Ignorer les mutants survivants.** Un mutant survivant indique qu'une erreur précise dans le code ne serait pas détectée. En logique domaine (règles d'autorisation, calculs financiers, règles d'expiration), un mutant survivant est un bug potentiel en production. *Correct :* traiter les survivants sur la logique métier critique comme des failing tests — analyser, écrire le cas manquant, relancer.

- **Confondre couverture et qualité des assertions.** `expect(result).toBeDefined()` ou `expect(result).not.toBeNull()` exécute tout le code et sature les métriques sans rien vérifier d'utile. *Correct :* asserter sur les valeurs exactes (`toBe(false)`, `toEqual({ id: 'inv-1' })`), les frontières (`toBe(0)`, `toBe(14)`), et les erreurs jetées (`rejects.toThrow('ALREADY_INVITED')`).

- **Lancer Stryker sur tout le projet à chaque PR.** Stryker est lent (il rejoue les tests N fois, une par mutant). Sur un projet avec 500 mutants, un run complet prend plusieurs minutes. *Correct :* utiliser `coverageAnalysis: 'perTest'` pour n'exécuter que les tests liés au mutant, et en CI cibler uniquement les fichiers modifiés (`--mutate` sur le diff de la PR).

## 5. Ancrage TribuZen

Couche fil-rouge : **mesurer la couverture des règles domaine TribuZen + un run de mutation testing sur la logique d'invitation** (`smaurier/tribuzen`).

**Couverture :** les règles domaine de TribuZen (`isInvitationValid`, `can(user, action, resource)` pour le RBAC, `calculateSubscriptionPrice`) sont en logique pure — pas d'I/O. Elles sont les candidates idéales à un seuil de couverture élevé (`branches: 90`). Configurer `src/domain/**` avec un seuil plus strict que le reste du projet.

**Mutation testing :** cibler `src/invitation/invitation.domain.ts` et `src/rbac/can.ts`. Ces fichiers contrôlent l'accès aux données familiales — un mutant survivant sur une règle RBAC (`===` → `!==` sur un rôle) pourrait autoriser un accès non prévu. Le mutation testing les cible directement.

**Workflow en session :**

```bash
# 1. Couverture globale
pnpm vitest run --coverage

# 2. Mutation testing ciblé sur la logique domaine
pnpm stryker run --mutate "src/domain/**,src/invitation/invitation.domain.ts"
```

La combinaison couverture + mutation testing donne deux signaux complémentaires sur la même logique : l'un mesure l'exécution, l'autre mesure la précision des assertions.

## 6. Points clés

1. Vitest supporte deux providers : **v8** (natif, rapide, défaut) et **istanbul** (instrumentation AST, plus précis sur les branches transpilées).
2. Quatre métriques : **instructions** (Stmts), **branches** (chemins conditionnels), **fonctions** (Funcs), **lignes** (Lines) — les branches sont les plus révélatrices.
3. Un seuil (`thresholds`) fait échouer la CI si non atteint — porte minimale, pas objectif absolu.
4. **La couverture mesure l'exécution, pas la vérification** : 100 % de coverage avec des assertions faibles laisse passer des bugs.
5. Le mutation testing crée des **mutants** (petites modifications du code) et vérifie si les tests les détectent — **tué = test précis**, **survivant = test faible**.
6. **Score de mutation** = Killed / (Total − CompileErrors − Timeouts) × 100 ; 80 %+ sur la logique métier est la cible.
7. Stryker JS s'intègre à Vitest via `@stryker-mutator/vitest-runner` ; `coverageAnalysis: 'perTest'` optimise les temps de run.
8. Coverage et mutation testing sont complémentaires : coverage → code non exécuté ; Stryker → assertions insuffisantes sur le code exécuté.

## 7. Seeds Anki

```
Quelle est la différence entre les providers v8 et istanbul dans Vitest ?|v8 = instrumentation native du moteur V8 (rapide, défaut) ; istanbul = instrumentation du code source AST (plus précis sur les branches, plus lent)
Quelles sont les 4 métriques de couverture et que mesurent-elles ?|Statements (instructions exécutées), Branches (chemins conditionnels), Functions (fonctions appelées), Lines (lignes physiques exécutées)
Pourquoi 100 % de coverage ne garantit pas l'absence de bugs ?|La coverage mesure si le code a été exécuté, pas si le comportement est correctement vérifié — un test sans expect ou avec une assertion trop vague donne 100 %
Qu'est-ce qu'un mutant tué vs un mutant survivant ?|Tué = au moins un test échoue sur le code muté → les tests sont assez précis. Survivant = tous les tests passent → les tests sont trop faibles sur ce point
Quelle est la formule du mutation score Stryker ?|Killed / (Total − CompileErrors − Timeouts) × 100
Quels packages installer pour faire du mutation testing avec Stryker + Vitest ?|@stryker-mutator/core + @stryker-mutator/vitest-runner ; configurer testRunner: 'vitest' et plugins: ['@stryker-mutator/vitest-runner']
Quel paramètre Stryker optimise les temps de run en ne rejouant que les tests liés au mutant ?|coverageAnalysis: 'perTest'
Comment un mutant survivant révèle-t-il un bug que la couverture ne voyait pas ?|Il montre qu'une modification précise du code (ex. > → >=) ne casse aucun test — donc les tests ne vérifient pas la valeur aux frontières de la condition
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-12-couverture/`. Tu y configures la couverture Vitest sur la logique d'invitation TribuZen, analyses le rapport, identifies les branches non couvertes, puis lances Stryker pour révéler les mutants survivants et corriges les tests en conséquence. Corrigé complet commenté + variante J+30 dans le README.
