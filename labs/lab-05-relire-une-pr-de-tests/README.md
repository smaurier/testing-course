# Lab 05 — Intervention : relire une PR de tests, findings avant vérité

> **Outcome :** à la fin, tu sais repérer une suite de tests qui *a l'air* correcte (elle passe,
> elle est mergée, elle est verte en CI) mais qui **ne prouve rien** — parce qu'elle ne teste
> jamais les cas où une implémentation buguée se distinguerait d'une bonne. Tu sais aussi la
> renforcer jusqu'à ce qu'elle devienne réellement discriminante. C'est le lien direct avec le
> module 12 (mutation testing) : une bonne suite tue les mutants, une suite molle les laisse
> passer.
> **Vrai outil :** vitest 5. L'oracle exécute **ta** suite deux fois — contre l'implémentation
> correcte, et contre une implémentation buguée cachée dans `mutant/`.
> **Feedback :** `npm run lab:05` — deux critères, tous les deux obligatoires : (1) ta suite passe
> contre `src/` (une bonne suite ne doit jamais accuser du code correct), (2) ta suite **échoue**
> contre `mutant/` (elle doit détecter le bug). `npm run solution:05` prouve l'oracle.

## Lire avant (une lecture bornée)

- Module [`12-couverture-et-mutation-testing.md`](../../modules/12-couverture-et-mutation-testing.md) — l'idée que la couverture de lignes ne dit rien sur la qualité des assertions ; un mutant tué est une preuve, une ligne couverte n'en est pas une.
- Module [`14-flaky-tests-et-debugging.md`](../../modules/14-flaky-tests-et-debugging.md) — tu vas retrouver `new Date()` non maîtrisé, déjà vu au lab 04.
- La voie **lecture critique** en tête de [`PARCOURS-SYLVAIN.md`](../../../PARCOURS-SYLVAIN.md) : findings écrits **avant** de connaître la vérité, toujours.

## Énoncé

Un collègue a ouvert une PR ajoutant `estMajeur(naissance, reference): boolean` et sa suite de
tests (`test/age.test.ts`). Elle est déjà **mergée** : elle passait en CI, la revue a été rapide.
Trois tests, tous verts.

**0. Findings d'abord.** Sans regarder `src/age.ts` ni `mutant/`, écris `REVIEW.md` à la racine
du lab et réponds :
- Quels cas cette suite ne teste-t-elle **pas**, pour une fonction qui calcule un âge ?
- Le troisième test utilise `new Date()`. Pourquoi est-ce un problème, même s'il passe
  aujourd'hui ? (Tu l'as déjà vu au lab 04 — nomme la cause exacte.)
- Si quelqu'un introduisait un bug d'un seul caractère dans le calcul du jour anniversaire,
  cette suite le détecterait-elle ? Justifie sans exécuter de code.

Le correcteur-labs lit `REVIEW.md` avant de juger — un GREEN sans ce fichier n'est pas un GO.

**1. Renforce.** Modifie `test/age.test.ts` **en place** : retire la dépendance à `new Date()`
(remplace par une date fixe), et ajoute les cas limites qui manquaient. N'affaiblis et ne retire
aucune assertion existante qui a du sens.

## Étapes (en friction)

1. Écris `REVIEW.md`.
2. Lance `npm run lab:05` une première fois pour voir précisément ce que l'oracle reproche
   (il te dit si tu passes contre `src/` et si tu détectes le mutant — pas le contenu du mutant).
3. Remplace le test « fonctionne avec la date d'aujourd'hui » par une date fixe.
4. Ajoute un test sur le jour EXACT du 18e anniversaire.
5. Ajoute un test sur la veille (encore mineur).
6. Relance `npm run lab:05` après chaque ajout.

## Vérifier

```bash
cd 06-testing/labs
npm run lab:05
```

**Ce que l'oracle vérifie**

Ta suite (`test/age.test.ts`) doit être verte contre `src/age.ts` (l'implémentation correcte,
que tu ne modifies jamais) et rouge contre `mutant/age.ts` (une variante avec un bug d'un
caractère sur la comparaison du jour anniversaire) — l'oracle lance vitest deux fois, en changeant
uniquement la cible que `@lab/age` résout.

## Variante J+30 (fading)

Un deuxième mutant existe dans le même esprit : le calcul confond `getMonth()` (0-indexé) quelque
part. Sans le voir, écris de mémoire les trois cas limites qui protègent contre une confusion
0-indexé/1-indexé sur le mois (indice : un anniversaire en janvier ou en décembre est le terrain
le plus sensible à ce genre d'erreur).

## Application TribuZen

Même renfort sur `tribuzen/test/estMajeur.test.ts` (utilisé pour la validation d'inscription
enfant vs adulte). Commit : `test(age): cas limites anniversaire + suppression de new Date()`.
