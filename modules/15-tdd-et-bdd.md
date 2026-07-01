---
titre: TDD et BDD
cours: 06-testing
notions: [cycle red-green-refactor, test-first, baby steps, triangulation, tests comme spécification exécutable, BDD given-when-then, Gherkin en survol, quand TDD et quand pas]
outcomes: [pratiquer le cycle red-green-refactor, écrire le test avant le code, structurer un scénario BDD given-when-then, mener un kata TDD de bout en bout]
prerequis: [14-flaky-tests-et-debugging]
next: 16-contract-testing
libs: [{ name: vitest, version: ^4.1.9 }]
tribuzen: développer la règle d'invitation TribuZen en TDD strict (red-green-refactor)
last-reviewed: 2026-07
---

# TDD et BDD

> **Outcomes — tu sauras FAIRE :** pratiquer le cycle red-green-refactor, écrire le test avant le code, structurer un scénario BDD given-when-then, mener un kata TDD de bout en bout.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, un membre peut inviter quelqu'un dans sa famille à condition que (a) son statut soit `ACTIVE`, (b) l'adresse email cible ne soit pas déjà membre, et (c) son quota d'invitations en attente ne soit pas dépassé (max 5). Comment implémenter `canInvite` ?

La tentation naturelle : ouvrir un fichier `.ts`, écrire la fonction, puis ajouter quelques tests. Problème : tu vas écrire **ce que tu imagines** que le code fait, pas ce qu'il doit faire. Tu vas anticiper plusieurs règles à la fois, créer des branches non prouvées, et le refactoring devient risqué faute de filet.

TDD inverse l'ordre. Avant d'écrire une ligne de `canInvite`, tu écris un test qui décrit **un seul** comportement attendu, tu vérifies qu'il est rouge (preuve que le test teste quelque chose), puis tu écris le minimum de code pour le passer. Le design émerge des tests successifs.

```ts
// RED — la fonction n'existe pas encore
import { describe, it, expect } from 'vitest';
import { canInvite } from './invitation-rules';

describe('canInvite', () => {
  it('retourne false si le membre est INACTIVE', () => {
    expect(canInvite({ status: 'INACTIVE' }, 'bob@tribu.fr', [])).toBe(false);
  });
});
```

Ce test échoue immédiatement (`canInvite is not a function`). C'est exactement ce qu'on veut : **rouge prouvé**. On peut maintenant écrire le minimum de code pour le passer. La suite déroulera les 4 cycles complets.

## 2. Théorie complète, concise

### Le cycle red-green-refactor

Le TDD se déroule en trois phases répétées indéfiniment.

**RED** — écrire un test qui décrit un comportement attendu, lancer les tests, constater l'échec. Si le test passe sans code, il ne teste rien : un test rouge prouve que le test est utile.

**GREEN** — écrire le **minimum** de code de production pour faire passer le test, rien de plus. Pas d'anticipation, pas de généralisation prématurée. Un `return false` hardcodé est souvent la première implémentation valide.

**REFACTOR** — améliorer le code (nommage, duplication, structure) **sans changer le comportement**. Les tests verts pendant le refactor sont le filet de sécurité. Cette phase est obligatoire : la sauter accumule de la dette à chaque cycle.

Durée d'un cycle : 2 à 5 minutes. Si un cycle dure 20 minutes, le pas est trop grand — découper.

### Test-first : pourquoi ça change le design

Écrire le test avant l'implémentation force trois décisions anticipées.

1. **L'interface publique** (nom de la fonction, paramètres, type de retour) est définie par le test avant d'exister. Le test est le premier client du code.
2. **Les dépendances** : si le test est difficile à écrire (besoin d'une base lancée, d'un token), c'est un signal de couplage — le design est mauvais. Le TDD rend la douleur visible tôt.
3. **Les cas limites** : on doit les nommer dans le test avant de les coder, ce qui évite l'implémentation silencieuse de comportements implicites.

### Baby steps

Un baby step = un seul comportement testé à la fois. Pour `canInvite`, l'ordre naturel :

```
Test 1 : retourne false si membre INACTIVE
Test 2 : retourne true si membre ACTIVE et email absent
Test 3 : retourne false si email déjà dans la liste
Test 4 : retourne false si quota d'invitations en attente >= 5
```

Chaque test fait avancer l'implémentation par un état valide mais incomplet. L'algo final **émerge** des contraintes, pas de ta tête.

### Triangulation

La triangulation est la technique qui force la généralisation. Si `return false` passe le test 1, il faut un deuxième cas opposé (test 2, `ACTIVE` → `true`) pour forcer le code à brancher réellement. Deux résultats en opposition obligent une vraie implémentation ; un seul permet le hardcode.

```ts
// Un seul test : return false suffit (faux vert trompeur)
expect(canInvite({ status: 'INACTIVE' }, 'x@t.fr', [])).toBe(false);

// La triangulation force la vraie logique :
expect(canInvite({ status: 'ACTIVE' }, 'x@t.fr', [])).toBe(true); // oblige le branchement
```

Règle : si une implémentation `return <valeur hardcodée>` passe tous les tests, il manque de la triangulation.

### Tests comme spécification exécutable

Les tests TDD ne sont pas des filets de sécurité ajoutés après — ils sont la **spécification du comportement**, écrite avant le code. La liste des `it(...)` d'un module est lisible par un non-dev et décrit exactement ce que le code fait.

Deux effets : (a) quand la spec change, on modifie d'abord le test (documentation vivante), (b) un test qui passe est une preuve formelle que le comportement est implémenté.

### BDD given-when-then

Le BDD (Behavior-Driven Development) structure les scénarios dans un langage partagé par les devs et les métiers. Le format **given-when-then** décrit un scénario en trois temps.

- **Given** (étant donné) : l'état du système avant l'action (préconditions)
- **When** (quand) : l'action déclenchée par l'acteur
- **Then** (alors) : le résultat observable attendu

Exemple TribuZen :

```
Given un membre actif avec 3 invitations en attente
When il invite "alice@tribu.fr" non encore membre
Then l'invitation est acceptée
And le quota passe à 4 invitations en attente
```

Le given-when-then peut s'écrire dans les `describe`/`it` Vitest (suffisant pour les tests unitaires) ou en Gherkin (pour les specs lisibles par les métiers).

### Gherkin en survol

Gherkin est la syntaxe formelle du BDD, lue par Cucumber. Elle permet d'exécuter des scénarios en langue naturelle.

```gherkin
Feature: Invitation TribuZen

  Scenario: membre actif peut inviter
    Given un membre avec le statut "ACTIVE" et 3 invitations en attente
    When il invite "alice@tribu.fr" non encore membre
    Then canInvite retourne true

  Scenario: membre inactif ne peut pas inviter
    Given un membre avec le statut "INACTIVE"
    When il tente d'inviter "alice@tribu.fr"
    Then canInvite retourne false
```

Dans ce cours, Gherkin reste un outil de spécification. L'exécution avec Cucumber est un sujet avancé — ici tu retiens la structure `given-when-then` et son utilité pour clarifier les exigences avant de coder.

### Quand TDD est adapté / quand il ne l'est pas

| Contexte | TDD adapté | Raison |
|----------|-----------|--------|
| Logique métier (règles, validations) | Oui | Cas limites nombreux, spec précisable en tests |
| Algorithme (tri, parsing, conversion) | Oui | Baby steps clairs, triangulation naturelle |
| Bug fix | Oui | Écrire le test qui reproduit le bug d'abord |
| Exploration / prototypage | Non | On ne sait pas encore ce qu'on construit |
| UI visuelle | Non | Le rendu est difficile à exprimer en assertions |
| Intégration système (DB réelle, API tierce) | Non | Coût de mise en place disproportionné |
| Code jetable | Non | L'investissement ne sera pas rentabilisé |

Heuristique : si tu peux écrire `expect(maFonction(input)).toBe(output)` de tête, TDD est adapté.

## 3. Worked examples

### Kata TDD complet — `canInvite` pas à pas

On implémente la règle d'invitation TribuZen en TDD strict. Outil : Vitest réel.

**Cycle 1 — membre inactif**

```ts
// RED
import { describe, it, expect } from 'vitest';
import { canInvite } from './invitation-rules';

describe('canInvite', () => {
  it('retourne false si le membre est INACTIVE', () => {
    expect(canInvite({ status: 'INACTIVE' }, 'bob@tribu.fr', [])).toBe(false);
  });
});
```

Test rouge : `canInvite is not a function`. Minimum de code :

```ts
// GREEN
export function canInvite(
  member: { status: string },
  _email: string,
  _existingEmails: string[]
): boolean {
  return false; // hardcodé — suffit pour ce test
}
```

Test vert. Refactor : rien à faire, le code est minimal et lisible.

**Cycle 2 — membre actif, email libre (triangulation)**

```ts
// RED
it('retourne true si le membre est ACTIVE et email libre', () => {
  expect(canInvite({ status: 'ACTIVE' }, 'bob@tribu.fr', [])).toBe(true);
});
```

Test rouge (`return false` hardcodé échoue — preuve que la triangulation fonctionne). Minimum de code :

```ts
// GREEN
export function canInvite(
  member: { status: string },
  _email: string,
  _existingEmails: string[]
): boolean {
  return member.status === 'ACTIVE';
}
```

Test vert. La triangulation a forcé le vrai branchement. Refactor : nommage déjà lisible.

**Cycle 3 — email déjà membre**

```ts
// RED
it("retourne false si l'email est déjà dans la liste des membres", () => {
  expect(
    canInvite({ status: 'ACTIVE' }, 'bob@tribu.fr', ['alice@tribu.fr', 'bob@tribu.fr'])
  ).toBe(false);
});
```

Test rouge. Minimum :

```ts
// GREEN
export function canInvite(
  member: { status: string },
  email: string,
  existingEmails: string[]
): boolean {
  if (member.status !== 'ACTIVE') return false;
  return !existingEmails.includes(email);
}
```

Test vert. Refactor : nommage correct, logique claire — rien à changer.

**Cycle 4 — quota dépassé**

```ts
// RED
it("retourne false si le quota d'invitations en attente est atteint", () => {
  const pending = ['a@t.fr', 'b@t.fr', 'c@t.fr', 'd@t.fr', 'e@t.fr'];
  expect(
    canInvite({ status: 'ACTIVE', pendingInvitations: pending }, 'bob@tribu.fr', [])
  ).toBe(false);
});
```

Test rouge (le type ne connaît pas encore `pendingInvitations`). Minimum + refactor :

```ts
// GREEN + REFACTOR : extraction de l'interface Member
export interface Member {
  status: string;
  pendingInvitations?: string[];
}

export function canInvite(
  member: Member,
  email: string,
  existingEmails: string[]
): boolean {
  if (member.status !== 'ACTIVE') return false;
  if (existingEmails.includes(email)) return false;
  if ((member.pendingInvitations ?? []).length >= 5) return false;
  return true;
}
```

Tous les tests précédents restent verts. L'interface `Member` a émergé du besoin au cycle 4, pas anticipée au début — c'est YAGNI respecté.

### Bilan du kata

4 cycles, 4 tests, une implémentation complète qui a émergé des contraintes. L'ordre des tests a guidé l'ajout progressif du type `Member` et des prédicats — rien n'a été anticipé.

## 4. Pièges & misconceptions

**Écrire le code d'abord, le test ensuite.** Si tu écris l'implémentation avant le test, tu écriras le test pour qu'il passe le code que tu as écrit — pas pour décrire le comportement attendu. Le test devient une vérification post-hoc, pas une spec. *Correct* : ferme le fichier d'implémentation, ouvre le fichier de test, commence par l'assertion.

**Sauter le refactor.** Green → Red sans passer par Refactor accumule de la dette à chaque cycle. Le code reste vert mais devient illisible. *Correct* : après chaque Green, demande-toi « duplication ? nom ambigu ? responsabilité imbriquée ? ». Si oui, refactor maintenant, pas plus tard.

**Faire de gros pas.** Tester plusieurs comportements dans un seul test ou écrire toute l'implémentation d'un coup produit des échecs multiples impossibles à diagnostiquer, et des cycles de 30 minutes. *Correct* : baby steps — un seul comportement par test, implémentation minimale, cycle de 2-5 min.

**Confondre triangulation et duplication.** Ajouter un second test `toBe(false)` avec des données différentes pour la même règle n'est pas de la triangulation — c'est de la duplication. La triangulation oppose deux résultats (`true` vs `false`) pour forcer le branchement. *Correct* : un test par branche logique.

**Écrire un test qui passe sans code (faux vert).** Si l'implémentation existante fait déjà passer le nouveau test, le test n'apporte rien. *Correct* : si le test est vert d'emblée, il est soit redondant soit le comportement est déjà couvert — affine-le pour cibler un cas distinct.

**Confondre BDD et Gherkin.** BDD est une approche (given-when-then, collaboration métier-dev). Gherkin est un format de fichier lu par Cucumber. On peut faire du BDD sans Gherkin — les `describe`/`it` bien nommés suffisent pour une équipe dev seule. *Correct* : utilise Gherkin quand les métiers écrivent ou lisent les scénarios eux-mêmes.

## 5. Ancrage TribuZen

Couche fil-rouge : **développer la règle d'invitation TribuZen en TDD strict (red-green-refactor)** (`smaurier/tribuzen`).

La règle `canInvite` développée dans ce module est la vraie logique métier du produit. En session :

- Crée `src/domain/invitation-rules.ts` (vide) et `src/domain/invitation-rules.test.ts`.
- Joue les 4 cycles du worked example : `INACTIVE` → `ACTIVE + email libre` → `email déjà membre` → `quota dépassé`.
- Chaque cycle prend 3-5 min. À la fin, 4 tests verts et une implémentation complète de `canInvite`.
- Le résultat est directement utilisé par `InvitationService` du module 04 : `if (!canInvite(member, email, existing)) throw new Error('CANNOT_INVITE')`.

Le BDD given-when-then est utilisé pour les scénarios de quota et de RBAC (qui peut inviter, qui peut accepter) — les documenter en given-when-then avant de les coder évite les ambiguïtés de spec au sein de l'équipe.

## 6. Points clés

1. Le cycle TDD est red-green-refactor — chaque phase a un rôle précis ; sauter une phase brise le cycle.
2. Test-first force l'interface publique, les dépendances et les cas limites à être définis avant le code.
3. Baby steps — un comportement par test, implémentation minimale, cycle de 2-5 min.
4. La triangulation oppose deux résultats pour forcer la vraie logique à émerger (pas de hardcode).
5. Les tests TDD sont une spécification exécutable — ils décrivent le comportement, pas l'implémentation.
6. BDD given-when-then structure un scénario en préconditions (Given), action (When), résultat observable (Then).
7. Gherkin est le format fichier du BDD (Feature/Scenario/Given/When/Then) — utile quand les métiers lisent ou écrivent les specs.
8. TDD ne s'applique pas à l'exploration, à l'UI visuelle ou aux intégrations système coûteuses à simuler.

## 7. Seeds Anki

```
Quelles sont les 3 phases du cycle TDD ?|Red (test qui échoue), Green (minimum de code pour passer), Refactor (améliorer sans changer le comportement)
Pourquoi le test doit-il être rouge avant d'écrire le code ?|Prouver que le test teste quelque chose — un test vert d'emblée ne détecte rien
Qu'est-ce que la triangulation en TDD ?|Ajouter un second test avec un résultat opposé pour forcer une vraie implémentation (pas un return hardcodé)
Qu'est-ce qu'un baby step en TDD ?|Tester un seul comportement à la fois et écrire le minimum de code qui le satisfait — cycle de 2-5 min
Différence entre TDD et BDD ?|TDD est centré sur les unités de code (cycles red-green-refactor) ; BDD est centré sur les comportements métier exprimés en given-when-then pour toute l'équipe
Structure d'un scénario BDD ?|Given (préconditions), When (action de l'acteur), Then (résultat observable attendu)
Quand TDD n'est pas adapté ?|Exploration, UI visuelle, intégrations système coûteuses, code jetable
Pourquoi les tests TDD sont-ils une spec exécutable ?|Ils sont écrits avant le code et décrivent le comportement attendu — modifier la spec = modifier le test en premier
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-15-tdd-bdd/`. Tu y mènes un kata TDD de bout en bout sur `canInvite` en Vitest réel, en appliquant le cycle red-green-refactor à chaque règle d'invitation. Corrigé complet commenté + variante J+30 dans le README du lab.
