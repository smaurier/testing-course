# Lab 03 — Intervention : caractériser un legacy sans tests, puis corriger un bug rapporté

> **Outcome :** à la fin, tu sais aborder du code de production **sans aucun test**, en capturer
> le comportement réel avant d'y toucher (golden master), puis corriger un bug rapporté sans
> jamais changer un seul résultat pour les cas qui marchaient déjà. C'est la situation la plus
> fréquente en mission : personne ne réécrit un module qui tourne, on le comprend et on le corrige.
> **Vrai outil :** vitest 5, `it.each` pour le golden master. Aucun harnais simulé.
> **Feedback :** `npm run lab:03` — la **non-régression** (`regression.test.ts`) doit rester verte
> **avant et après** ; le **bug rapporté** (`bug.test.ts`) doit passer du rouge au vert. `npm run
> solution:03` prouve l'oracle ; tu ne l'ouvres pas avant ton GREEN.

## Lire avant (une lecture bornée)

- Module [`14-flaky-tests-et-debugging.md`](../../modules/14-flaky-tests-et-debugging.md) §"Reproduire un test flaky" — la posture de diagnostic, même si ce lab n'est pas sur du flaky.
- Module [`06-architecture-testable.md`](../../modules/06-architecture-testable.md) — extraction de fonctions pures pour rendre un bloc testable, sans changer son comportement.
- La [voie lecture critique](../../../PARCOURS-SYLVAIN.md) du parcours : findings avant de connaître la vérité — c'est exactement la posture ici.

## Énoncé

`src/pricing.ts` calcule la cotisation annuelle d'un foyer TribuZen. **Aucun test n'existe.**
Le code est en production. Un ticket produit arrive :

> *« Le site annonce un plafond à 450€/an dès CINQ personnes dans le foyer. Une famille de
> exactement cinq personnes ne l'obtient pas ; à six personnes, si. »*

Ta mission, dans cet ordre :

**0. Caractérise avant de corriger.** Ouvre `src/pricing.ts`. Sans le modifier, trouve la règle
exacte de la taille du foyer pour laquelle le plafond ne s'applique PAS alors qu'il le devrait
(indice : c'est une comparaison au mauvais opérateur). Écris **toi-même** un fichier
`test/mes-caracterisations.test.ts` avec au moins 6 cas qui décrivent le comportement ACTUEL du
code (y compris le cas bugué, tel qu'il est aujourd'hui, pas tel qu'il devrait être). C'est ton
golden master à toi, en plus de celui déjà fourni dans `regression.test.ts`. Le correcteur-labs
le lit avant de juger — un GREEN sans ce fichier n'est pas un GO.

**1. Corrige le bug**, un seul changement, minimal, à l'endroit exact que tu as identifié.

**2. Refactore si tu veux** (extraire des fonctions nommées, sortir les nombres magiques en
constantes) — mais `regression.test.ts` doit rester vert à chaque étape : c'est ton filet.

Contrainte dure : ne touche à **rien** qui ferait bouger une valeur de `regression.test.ts` — ce
fichier n'est pas à toi, c'est le contrat de non-régression.

## Étapes (en friction)

1. Lis `src/pricing.ts` en entier. Calcule à la main le résultat pour 2-3 tailles de foyer
   différentes, compare à ce que le code produit réellement (exécute `npm run lab:03` pour voir
   `regression.test.ts` déjà vert : c'est ta référence de comportement actuel).
2. Trouve la ligne responsable du bug (une seule comparaison).
3. Écris `test/mes-caracterisations.test.ts` (6+ cas, comportement actuel).
4. Corrige la ligne. Relance `npm run lab:03`.
5. Si tu refactores, fais-le par petits pas, en relançant l'oracle après chaque pas.

## Vérifier

```bash
cd 06-testing/labs
npm run lab:03
npm run check:03
```

**Contrat attendu par l'oracle**

`src/pricing.ts` exporte toujours `calculerCotisationAnnuelle(membres: { role: "adulte" | "enfant" }[]): number`, même signature.

**Ce que l'oracle vérifie**

- `regression.test.ts` (10 cas, tailles de foyer ≠ 5) : identique avant/après, y compris le cas
  « 4 adultes seuls, taille 4, pas de plafond même si le total dépasse 450€ » — c'est un
  comportement du legacy à **préserver**, pas un bug.
- `bug.test.ts` (3 cas, taille 5) : les deux cas où le total brut dépasse 450€ doivent être
  plafonnés à 450€ ; le cas où le total brut est déjà sous 450€ (390€) doit rester à 390€ — le
  plafond ne doit **jamais** faire remonter un total.

## Variante J+30 (fading)

Un second ticket arrive : *« le tarif dégressif enfant devrait commencer au 3e enfant EN COMPTANT
tous les enfants du foyer, même ceux déjà inscrits ailleurs dans le système — actuellement il ne
compte que ceux passés à cette fonction. »* Sans le code sous les yeux, écris d'abord les cas de
test qui capturent ce nouveau comportement, puis implémente. `regression.test.ts` et `bug.test.ts`
doivent rester verts (aucun des cas fournis n'a de collision avec ce changement).

## Application TribuZen

Même diff sur `tribuzen/src/domain/pricing.ts`. Commit 1 (golden master) :
`test(pricing): golden master avant intervention`. Commit 2 (fix) :
`fix(pricing): plafond familial appliqué dès 5 personnes (pas seulement au-delà)`.
