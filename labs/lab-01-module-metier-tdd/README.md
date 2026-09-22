# Lab 01 — Un module métier construit en TDD strict, de zéro

> **Outcome :** à la fin, tu as construit `evaluerInvitation`, une règle métier TribuZen à quatre
> conditions, **cycle par cycle** (RED → GREEN → REFACTOR), et tu peux justifier chaque ligne par
> le test qui l'a exigée. C'est le geste central du testing : les tests ne viennent pas après le
> code, ils le dessinent.
> **Vrai outil :** vitest 5, TypeScript 7. Aucun harnais simulé — l'oracle exécute ton implémentation.
> **Feedback :** `npm run lab:01` depuis `06-testing/labs` — RED tant que `src/invitation.ts` ne
> satisfait pas l'oracle. Au GREEN, le correcteur-labs lit aussi `CYCLES.md` (voir plus bas) avant
> de trancher GO/FIX/STOP : un GREEN obtenu en écrivant tout le code d'un coup, sans cycles, n'est
> pas un GO. `npm run solution:01` prouve l'oracle ; tu ne l'ouvres pas avant ton GREEN.

## Lire avant (une lecture bornée)

- Module [`15-tdd-et-bdd.md`](../../modules/15-tdd-et-bdd.md) §2 (cycle red-green-refactor, baby
  steps, triangulation) — **pas le kata `canInvite` en §3**, il ressemble à ce lab et te donnerait
  la solution.
- Module [`04-mocking-et-test-doubles.md`](../../modules/04-mocking-et-test-doubles.md) — pas
  nécessaire ici (aucune dépendance externe), mais utile pour comprendre pourquoi ce module n'en a
  pas besoin : la logique est pure.

## Énoncé

TribuZen a besoin d'une règle unique qui décide si un membre peut inviter quelqu'un par email,
avec quatre motifs de refus possibles. Tu vas la construire **en TDD strict**, un cycle à la fois :

1. Membre non actif → refus (`"inactif"`).
2. Email déjà dans la liste des membres → refus (`"deja-membre"`).
3. Quota de 5 invitations en attente atteint → refus (`"quota"`).
4. Email récemment révoqué (moins de 30 jours) → refus (`"recemment-revoquee"`).
5. Sinon → accepté.

Le résultat est une union discriminée (`{ ok: true } | { ok: false; reason: ... }`), pas un
booléen : un appelant doit pouvoir afficher **pourquoi** l'invitation est refusée.

**Contrainte de déterminisme (testing 101) :** la fonction reçoit `now: Date` en paramètre —
**jamais** de `new Date()`/`Date.now()` dans son corps. Un test qui dépend de l'horloge système
est un futur test flaky (tu verras pourquoi en détail au lab 04).

## Étapes (en friction) — un cycle = un commit mental, pas plus

Tiens un journal dans `CYCLES.md` à la racine du lab, un bloc par cycle :

```
## Cycle N — <ce que je teste>
RED   : <le test que j'écris, et pourquoi il échoue>
GREEN : <le minimum de code qui le fait passer — pas plus>
REFACTOR : <ce que j'ai nettoyé, ou "rien à faire" si c'est déjà propre>
```

1. **Cycle 1** : écris UN test — membre inactif → refus. Fais-le échouer (la fonction n'existe pas
   encore). Écris le minimum pour le faire passer (un retour hardcodé est acceptable si un seul
   test l'exige).
2. **Cycle 2 (triangulation)** : écris le test du cas nominal (actif, email libre → accepté). Ton
   retour hardcodé du cycle 1 ne peut plus survivre : c'est la preuve que la triangulation force
   un vrai branchement.
3. **Cycle 3** : email déjà membre.
4. **Cycle 4** : quota — c'est ici que `pendingInvitations` apparaît dans le type `Member`, parce
   que le test l'exige, pas avant (YAGNI).
5. **Cycle 5** : cooldown après révocation — introduit `now` et `revokedInvitations`. Teste la
   borne exacte (30 jours pile) en plus du cas évident.
6. Relis l'ordre des conditions dans ton implémentation : un membre inactif doit être refusé même
   si son email est *aussi* déjà membre. Écris ce test s'il ne l'est pas déjà.

## Vérifier

```bash
cd 06-testing/labs
npm install
npm run lab:01
npm run check:01
```

**Contrat attendu par l'oracle**

`src/invitation.ts` exporte : `MemberStatus` (union `"actif" | "inactif" | "suspendu"`), `Member`,
`InvitationRefus` (union des quatre motifs), `InvitationResult`, `COOLDOWN_JOURS` (le nombre 30,
nommé — jamais une valeur magique cachée dans le corps), `evaluerInvitation(member, email,
existingEmails, now)`.

**Ce que l'oracle vérifie**

Les cinq règles dans l'ordre de priorité (inactif d'abord, même si l'email est aussi déjà membre),
la borne exacte du quota (4 passe, 5 refuse), la borne exacte du cooldown (29 jours refuse, 30
jours passe), qu'une révocation sur un autre email n'affecte pas celui testé, et les types
(`Date` explicite en 4e paramètre — pas de signature qui accepterait un timestamp implicite).

## Application TribuZen

`tribuzen/src/domain/invitation/evaluerInvitation.ts`, branché sur `InvitationForm` (cours React) :
le motif de refus s'affiche tel quel à l'utilisateur, traduit en français par un dictionnaire de
libellés. Commit : `feat(invitation): evaluerInvitation en TDD — 5 règles, résultat explicite`.
