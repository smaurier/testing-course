---
titre: Pourquoi tester
cours: 06-testing
notions: [valeur des tests, confiance et non-régression, pyramide des tests, coût d'un bug selon le moment, types de tests unit intégration e2e, faux sentiment de sécurité, ce qu'il ne faut pas tester]
outcomes: [expliquer la valeur d'une suite de tests, situer les types de tests dans la pyramide, décider quoi tester et quoi ne pas tester]
prerequis: [00-prerequis-et-introduction]
next: 02-anatomie-dun-test
libs: [{ name: vitest, version: ^4.1.9 }]
tribuzen: pourquoi tester la logique d'invitation famille TribuZen avant l'UI
last-reviewed: 2026-07
---

# Pourquoi tester

> **Outcomes — tu sauras FAIRE :** expliquer la valeur concrète d'une suite de tests, situer unit / intégration / e2e dans la pyramide avec leurs proportions, décider quoi tester et quoi ne pas tester.
> **Difficulté :** :star:

## 1. Cas concret d'abord

TribuZen est en production depuis trois semaines. Un membre invité reçoit **deux emails d'invitation** le même soir — l'un signé `alice@famille.fr`, l'autre `Alice@famille.fr`. La logique `existsPending` compare les emails avec un `===` strict : `"alice@famille.fr" === "Alice@famille.fr"` retourne `false`, donc les deux invitations sont acceptées comme distinctes.

Résultat : deux notifications envoyées, une entrée en double dans la table `invitations`, et une plainte utilisateur le lendemain matin. Deux heures de debug pour identifier la cause. Le fix tient en une ligne (`.toLowerCase()`). Le coût réel : 2 h de debug + 30 min de hotfix + l'impact sur la confiance.

```ts
// src/invitation/invitation.ts — code initial (buggy)
export function canInvite(email: string, existingEmails: string[]): boolean {
  return !existingEmails.includes(email); // BUG: comparaison stricte, casse non normalisée
}

// En dev : canInvite('Alice@famille.fr', ['alice@famille.fr']) → true (bug silencieux)
// Un test de 4 lignes aurait tué ce bug avant le premier commit :
//
//   it('traite les emails insensibles à la casse', () => {
//     expect(canInvite('Alice@famille.fr', ['alice@famille.fr'])).toBe(false);
//   });
//
// Ce test aurait échoué, le bug aurait été corrigé en dev, coût : 5 min.
```

Ce module répond à une question simple : **pourquoi ce test de 4 lignes vaut ses 5 minutes d'investissement ?**

## 2. Théorie complète, concise

### Les quatre piliers de la valeur des tests

**Non-régression.** Toute suite de tests qui passe affirme que rien de ce qui marchait ne s'est cassé. Sans tests, chaque commit est un pari. Avec tests, les régressions sont détectées à la seconde où elles apparaissent, pas quand un utilisateur se plaint.

**Confiance pour refactorer.** Un code sans tests ne peut pas être refactoré en sécurité — on ne sait pas si le comportement observable est préservé. Des tests qui passent après un refactor prouvent que rien n'a bougé d'observable. C'est la différence entre un codebase qui vieillit et un codebase qui s'améliore.

**Documentation vivante.** Les tests décrivent le comportement attendu en langage exécutable. Contrairement aux commentaires, ils ne peuvent pas mentir : s'ils ne correspondent plus au code, ils échouent. `canInvite('Alice@famille.fr', ['alice@famille.fr'])` devrait retourner `false` — voilà une spec exécutable.

**Signal de design.** Code difficile à tester = code mal conçu (couplage fort, trop de responsabilités, effets de bord cachés). La friction du test révèle les défauts de conception avant qu'ils coûtent cher à modifier.

### Coût d'un bug selon le moment de découverte

| Phase de découverte | Coût relatif | Exemple concret |
|---------------------|--------------|-----------------|
| Design / spéc | 1× | Décision orale lors d'un atelier |
| Développement | 5× | Code review détecte le `===` strict |
| QA / staging | 10× | Test manuel, reproduction, fix, re-test |
| Production | 100× | Hotfix urgent, debug en direct, plainte utilisateur |
| Post-incident | 1000× | Fuite de données, atteinte à la réputation, perte de confiance |

La règle empirique (IBM, Capers Jones, NIST) : le coût croît exponentiellement à chaque passage de main. Un bug de 5 min en dev devient une panne de 2 h en prod. Investir dans les tests déplace les découvertes vers la gauche de cette courbe.

**Coûts cachés d'un bug en prod :**
- Temps de debug (trouver la cause racine, pas juste le symptôme)
- Risque de régression (le fix introduit un nouveau bug)
- Ralentissement de l'équipe (méfiance envers le codebase)
- Coût de la perte de confiance des utilisateurs (non mesurable)

### La pyramide des tests et ses proportions

```
          /\
         /  \
        / E2E \        5 %   — Lents (~5 s), fragiles, scénarios utilisateur
       /________\
      /          \
     / Intégration \   25 %  — Moyens (~100 ms), assemblage de modules
    /______________\
   /                \
  /    Unit tests    \  70 %  — Rapides (<1 ms), isolés, déterministes
 /____________________\
```

**Unit (70 %)** : teste une seule unité (fonction, classe) de façon isolée. Rapide, déterministe, facile à déboguer. La base de la pyramide : nombreux et peu coûteux. Idéal pour la logique métier pure.

**Intégration (25 %)** : teste l'assemblage de plusieurs modules. Peut toucher une vraie base de données de test, des services internes. Plus lent mais vérifie que les composants fonctionnent ensemble. Détecte les bugs d'assemblage que les tests unitaires ne voient pas.

**E2E / bout en bout (5 %)** : simule un scénario utilisateur complet (navigateur, réseau, stack entière). Lent, fragile (timing, environnement), coûteux à maintenir. Réservé aux chemins critiques (paiement, authentification, onboarding).

**Pourquoi ces proportions ?** Plus un test est haut dans la pyramide, plus il est lent à exécuter, difficile à déboguer et coûteux à maintenir. Inverser la pyramide (beaucoup d'E2E, peu d'unitaires) donne une suite lente et fragile qui décourage les commits fréquents.

### Types de tests en pratique — unit / intégration / e2e

```ts
// UNIT — une fonction pure, aucune I/O
// Teste canInvite isolément, sans base, sans réseau
import { describe, it, expect } from 'vitest';
import { canInvite } from './invitation';

describe('canInvite', () => {
  it('autorise un email absent de la liste', () => {
    expect(canInvite('bob@famille.fr', ['alice@famille.fr'])).toBe(true);
  });
  it('refuse un email déjà présent (insensible à la casse)', () => {
    expect(canInvite('Alice@famille.fr', ['alice@famille.fr'])).toBe(false);
  });
});
// Temps d'exécution : < 1 ms. Zéro dépendance externe.
```

```ts
// INTÉGRATION — le service d'invitation avec une vraie DB de test (ou un fake)
// Teste que invite() persiste ET notifie, ensemble
it('crée l'invitation et envoie la notification', async () => {
  const result = await invitationService.invite('fam-1', 'bob@famille.fr');
  expect(result.id).toBeDefined();
  const saved = await db.invitations.findFirst({ where: { email: 'bob@famille.fr' } });
  expect(saved).not.toBeNull();
  // notifier = spy injecté (voir module 04)
  expect(notifierSpy).toHaveBeenCalledOnce();
});
// Temps : ~50-200 ms selon la DB.
```

```ts
// E2E — scénario Playwright, navigateur réel
// Teste le parcours complet d'invitation depuis l'UI
test('un admin peut inviter un membre et il reçoit un email', async ({ page }) => {
  await page.goto('/famille/fam-1/membres');
  await page.getByRole('button', { name: 'Inviter' }).click();
  await page.getByLabel('Email').fill('bob@famille.fr');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Invitation envoyée')).toBeVisible();
});
// Temps : ~3-8 s. Fragile si l'UI ou le réseau varie.
```

### Faux sentiment de sécurité — 100 % de couverture ≠ 0 bug

La couverture de code (coverage) mesure les **lignes exécutées** par les tests, pas les **comportements testés**. On peut atteindre 100 % de line coverage et rater des bugs critiques :

```ts
// canInvite avec 100% line coverage... qui rate le bug de casse
export function canInvite(email: string, existingEmails: string[]): boolean {
  return !existingEmails.includes(email);
}

// Test qui donne 100% line coverage mais ne teste pas la casse
it('refuse un email déjà présent', () => {
  expect(canInvite('alice@famille.fr', ['alice@famille.fr'])).toBe(false);
  //                ^^ même casse → passe, toutes les lignes exécutées
});

// Le bug de casse n'est pas couvert. La métrique dit 100%. Le bug est en prod.
```

La coverage est un indicateur utile pour détecter du code **non testé du tout**, pas pour garantir l'absence de bugs. Viser 100 % peut même être contre-productif si cela pousse à tester du code trivial au lieu de tester des comportements limites.

### Ce qu'il ne faut pas tester

**Code trivial sans logique.** Un getter pur, une constante, un objet de configuration. Le test ne ferait que dupliquer le code — coût sans valeur.

```ts
// NE PAS TESTER
export const MAX_MEMBERS = 20;
export function getEmail(user: User): string { return user.email; }

// TESTER — logique, branchements, règles métier
export function canAddMember(family: Family): boolean {
  return family.members.length < MAX_MEMBERS;
}
```

**Détails d'implémentation.** Les méthodes privées, la structure interne d'un objet. Tester l'implémentation rend les tests fragiles : un refactor sans changement de comportement casse les tests. On teste le **comportement observable** (entrées → sorties, effets visibles), pas le **comment**.

**Code tiers.** Les librairies ont leurs propres tests. Tester `Array.prototype.map` ou les fonctions Prisma n'apporte rien. En revanche, tester l'utilisation qu'on en fait (les requêtes qu'on construit, les transformations qu'on applique) a de la valeur.

**Prototypes et POC.** Si le code sera jeté dans deux semaines, le tester est du gaspillage. Les tests ont de la valeur là où le code a une durée de vie et un coût de régression.

## 3. Worked examples

### Exemple A — un test qui attrape le bug TribuZen

Voici le bug complet, le test qui le révèle, et le fix :

```ts
// src/invitation/invitation.ts — version buggy
export function canInvite(email: string, existingEmails: string[]): boolean {
  return !existingEmails.includes(email); // BUG: casse non normalisée
}
```

```ts
// src/invitation/invitation.test.ts — ce test ÉCHOUE sur le bug
import { describe, it, expect } from 'vitest';
import { canInvite } from './invitation';

describe('canInvite', () => {
  it('autorise un email vraiment absent', () => {
    // passe même avec le bug (casse identique)
    expect(canInvite('bob@famille.fr', ['alice@famille.fr'])).toBe(true);
  });

  it('refuse un email déjà présent', () => {
    // passe même avec le bug (casse identique)
    expect(canInvite('alice@famille.fr', ['alice@famille.fr'])).toBe(false);
  });

  it('est insensible à la casse (révèle le bug)', () => {
    // ÉCHOUE avec le bug : includes('Alice@...') === false, retourne true au lieu de false
    expect(canInvite('Alice@famille.fr', ['alice@famille.fr'])).toBe(false);
    //                ^^^^^ casse différente → bug exposé
  });
});
```

Résultat du runner avant le fix :
```
✓ autorise un email vraiment absent
✓ refuse un email déjà présent
✗ est insensible à la casse (révèle le bug)
  AssertionError: expected true to be false
```

Fix — une ligne :

```ts
// src/invitation/invitation.ts — version corrigée
export function canInvite(email: string, existingEmails: string[]): boolean {
  const normalized = email.toLowerCase();
  return !existingEmails.map(e => e.toLowerCase()).includes(normalized);
}
```

Après le fix, les trois tests passent. Le comportement est maintenant spécifié et protégé : toute future modification de la fonction qui casserait la normalisation sera détectée immédiatement.

### Exemple B — décider quoi tester dans TribuZen

Quatre extraits de code. Pour chacun, la décision argumentée :

```ts
// 1. Constante — NE PAS TESTER
export const INVITATION_EXPIRY_DAYS = 7;
// Raison : aucune logique, duplicer la valeur dans un test n'apporte rien.

// 2. Logique métier avec branches — TESTER EN PRIORITÉ
export function isInvitationExpired(invitation: Invitation): boolean {
  const expiryMs = INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - invitation.createdAt.getTime() > expiryMs;
}
// Raison : deux branches (expiré / valide), dépend du temps (déterminisme → fake timer),
// règle métier critique (une invitation expirée acceptée = faille).

// 3. Getter trivial — NE PAS TESTER
export function getInvitationId(inv: Invitation): string { return inv.id; }
// Raison : aucune transformation, aucun branchement. Test = copie du code.

// 4. Validation avec règles multiples — TESTER
export function validateInvitationEmail(email: string): string | null {
  if (!email.includes('@')) return 'Format invalide';
  if (email.length > 254) return 'Email trop long';
  return null;
}
// Raison : plusieurs règles, plusieurs branches, valeur nulle ou message d'erreur.
// Chaque règle = un test distinct (cas valide, sans @, trop long).
```

Règle pratique : si tu peux lire toute la logique d'une fonction en regardant uniquement son nom et ses arguments d'appel, le test a peu de valeur. Si la fonction peut retourner des résultats différents selon les entrées ou l'état, elle mérite un test.

## 4. Pièges & misconceptions

**Piège 1 — Tout tester.** Chercher à couvrir chaque getter, chaque constante, chaque ligne de configuration. Résultat : une suite de tests coûteuse à maintenir qui casse à chaque refactor mineur, pour une valeur quasi nulle. *Correct :* tester la logique (branchements, règles métier, transformations), pas la plomberie (getters purs, constantes, code généré).

**Piège 2 — Tester l'implémentation plutôt que le comportement.** Asserter sur des détails internes : « la méthode privée `_normalize` a été appelée », « l'array intermédiaire a 3 éléments ». Ces tests cassent à chaque refactor, même si le comportement observable est identique. *Correct :* asserter sur les entrées-sorties de la fonction publique et les effets visibles de l'extérieur. Le **comment** peut changer ; le **quoi** doit rester stable.

**Piège 3 — Confondre couverture et qualité.** Atteindre 100 % de line coverage et croire que c'est terminé. La coverage mesure ce qui a été exécuté, pas ce qui a été *vérifié*. Un test sans assertion atteint 100 % de coverage en ne testant rien. *Correct :* utiliser la coverage comme outil de détection des zones non testées, pas comme objectif final. La qualité des assertions compte plus que le pourcentage de lignes exécutées.

**Piège 4 — Le faux sentiment de sécurité inversé.** Conclure que tests = aucun bug possible, et donc ne plus tester manuellement ni monitorer la prod. *Correct :* les tests réduisent drastiquement les bugs mais ne les éliminent pas. Monitoring, alertes et tests exploratoires restent nécessaires.

## 5. Ancrage TribuZen

Couche fil-rouge : **pourquoi tester la logique d'invitation famille TribuZen avant l'UI** (`smaurier/tribuzen`).

Le module se connecte directement au produit :

- `canInvite(email, existingEmails)` est la première fonction testée en session. Pure, sans dépendance externe, elle concentre la règle métier clé du produit. Un test de 4 lignes protège la normalisation email pour toute la durée du projet.
- `isInvitationExpired(invitation)` est la deuxième candidate : logique temporelle (→ fake timers en module 04), deux branches, règle critique (une invitation expirée acceptée = faille de sécurité).
- `validateInvitationEmail(email)` couvre le cas multi-règles : un test par règle, structure `describe` / `it` (module 02).
- Ces trois fonctions définissent les **contrats de la couche domaine** — la logique pure, sans DB ni réseau. Les tests écrits ici restent valides même si on change de framework ou d'ORM plus tard.
- L'UI de la page invitation (`/famille/:id/inviter`) vient après : elle dépend de ces fonctions, pas l'inverse. Tester la logique d'abord, l'UI ensuite — c'est la pyramide en pratique.

## 6. Points clés

1. Les tests apportent quatre valeurs : non-régression, confiance pour refactorer, documentation vivante, signal de design.
2. Le coût d'un bug croît exponentiellement selon le moment de découverte (1× en design, 100× en prod, 1000× post-incident).
3. Pyramide : 70 % unit (rapides, isolés), 25 % intégration (assemblage), 5 % E2E (scénarios complets). Inverser la pyramide ralentit et fragilise la suite.
4. Unit test = une unité isolée, < 1 ms, déterministe. Intégration = assemblage de modules, ~100 ms. E2E = navigateur + stack entière, ~5 s.
5. 100 % de couverture de code ne garantit pas l'absence de bugs : coverage mesure les lignes exécutées, pas les comportements vérifiés.
6. Ne pas tester : code trivial sans logique (getters, constantes), détails d'implémentation, code tiers, prototypes jetables.
7. Tester en priorité : logique avec branchements, règles métier, validations, calculs financiers, auth.
8. Tester l'implémentation (le comment) rend les tests fragiles ; tester le comportement observable (le quoi) les rend robustes.

## 7. Seeds Anki

```
Quels sont les 4 piliers de la valeur des tests ?|Non-régression, confiance pour refactorer, documentation vivante, signal de design
Quel est le coût relatif d'un bug découvert en production vs en développement ?|100× en prod vs 5× en dev — le coût croît exponentiellement à chaque passage de phase
Quelles sont les proportions de la pyramide des tests ?|Unit 70 % (rapides, isolés), Intégration 25 % (assemblage), E2E 5 % (scénarios complets)
Pourquoi 100% de couverture de code ne garantit pas 0 bug ?|Coverage mesure les lignes exécutées, pas les comportements vérifiés — un test sans assertion pertinente peut couvrir 100% de lignes sans détecter de bug
Qu'est-ce qu'un test d'intégration par opposition à un test unitaire ?|Un test d'intégration teste l'assemblage de plusieurs modules ensemble (peut toucher une vraie DB) — un test unitaire teste une seule unité isolée, sans I/O
Qu'est-ce qu'on ne doit PAS tester, et pourquoi ?|Code trivial sans logique (getters, constantes), détails d'implémentation, code tiers, prototypes — le coût de maintenance dépasse la valeur
Piège "tester l'implémentation" — qu'est-ce que ça signifie et pourquoi est-ce mauvais ?|Asserter sur des détails internes (méthodes privées, structure intermédiaire) — casse les tests à chaque refactor sans changement de comportement observable
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-01-pourquoi-tester/`. Tu y écris, en **Vitest réel**, un test qui révèle le bug de casse de `canInvite`, le fix, puis tu décides quoi tester dans quatre fonctions TribuZen. Corrigé complet commenté + variante J+30 dans le README.

---

| Précédent | Suivant |
|-----------|---------|
| [00 — Prérequis et introduction](./00-prerequis-et-introduction.md) | [02 — Anatomie d'un test](./02-anatomie-dun-test.md) |
