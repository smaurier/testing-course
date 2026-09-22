# Lab 02 — La pyramide de tests réelle : unitaire → intégration → e2e, sur un écran qui existe

> **Outcome :** à la fin, tu as fait tourner les trois couches de la pyramide **sur le même
> geste métier** — inviter un membre — et tu as vu de tes yeux pourquoi l'ordre compte : la
> couche unitaire (rapide, pure) te dit en 300ms si la règle est juste ; l'intégration (le vrai
> serveur HTTP, sans navigateur) prouve que la règle est bien branchée ; l'e2e (Playwright, un
> **vrai** Chromium) prouve que l'utilisateur final voit ce qu'il doit voir. Une seule de ces
> couches ne suffit jamais — c'est le sujet du module.
> **Vrai outil :** vitest 5 (unitaire + intégration), `supertest` (intégration HTTP sans
> navigateur), `@playwright/test` 1.63 avec un **vrai Chromium** (e2e).
> **Feedback :** `npm run lab:02` — enchaîne les trois couches **dans l'ordre**, s'arrête à la
> première rouge (exactement ce que tu ferais en vrai : pas la peine de lancer un navigateur si
> la logique de base est fausse). `npm run solution:02` prouve l'oracle sur les trois couches.

## Lire avant (une lecture bornée)

- Module [`09-tests-integration.md`](../../modules/09-tests-integration.md) — la différence entre
  un test d'intégration (vrai serveur, pas de navigateur) et un test e2e.
- Module [`10-playwright-fondamentaux.md`](../../modules/10-playwright-fondamentaux.md) §2 —
  `page.goto`, `getByRole`, `getByLabel`, `expect(locator).toHaveText`.
- Module [`01-pourquoi-tester.md`](../../modules/01-pourquoi-tester.md) §"la pyramide" (rappel du
  ratio recommandé : beaucoup d'unitaire, un peu d'intégration, très peu d'e2e — c'est pour ça
  que ce lab a 5 tests unitaires, 4 d'intégration, 3 e2e, pas l'inverse).

## Énoncé

Trois fichiers te sont donnés, corrects, à ne pas modifier :

- `server/app.ts` — le serveur HTTP (Node natif, sans framework). Il route `GET /`, `GET /app.js`
  et `POST /api/invitations`, et pour ce dernier appelle **ta** fonction `peutInviter`.
- `public/index.html` + `public/app.js` — le front vanilla (un formulaire email → fetch → affiche
  le résultat).

Ton travail : écrire `src/validation.ts`, qui exporte `peutInviter(emailsExistants: string[],
email: string): { ok: true } | { ok: false; reason: "invalide" | "deja-invite" }` — format email
valide, pas déjà dans la liste (comparaison insensible à la casse).

Tant que cette fonction n'est pas correcte, **rien au-dessus ne peut être vert** : le serveur en
dépend, la page en dépend. C'est le point du lab — la base de la pyramide porte tout le reste.

## Étapes (en friction)

1. Écris `peutInviter` (page blanche, comme les labs TypeScript).
2. `npm run lab:02` — regarde la couche 1. Corrige jusqu'au vert.
3. La couche 2 se lance automatiquement : un vrai serveur HTTP démarre en mémoire, `supertest`
   lui envoie de vraies requêtes. Si elle est rouge, le bug est dans la façon dont le serveur
   *utilise* ta fonction (relis `server/app.ts`, ne le modifie pas).
4. La couche 3 se lance ensuite : Playwright démarre le serveur sur `localhost:4173`, ouvre un
   vrai Chromium, remplit le formulaire, clique, lit le texte affiché. Si elle est rouge alors
   que 1 et 2 sont vertes, regarde `public/app.js` (donné) pour comprendre ce que l'UI affiche
   réellement — souvent un format de message différent de ce à quoi tu t'attendais.

## Vérifier

```bash
cd 06-testing/labs
npx playwright install chromium   # une fois, si pas déjà fait
npm run lab:02
npm run check:02
```

**Ce que l'oracle vérifie**

Couche 1 (`test/unit.validation.test.ts`, 5 cas) : email valide accepté, doublon refusé
(insensible à la casse), format invalide refusé, chaîne vide refusée. Couche 2
(`test/integration.api.test.ts`, 4 cas) : `201` + `{ ok: true }` pour un nouvel email, `422` pour
un doublon (alice, présente au démarrage), `422` pour un format invalide, `GET /` sert bien la
page. Couche 3 (`e2e/invitation.spec.ts`, 3 cas, **vrai navigateur**) : le message de succès
s'affiche avec le bon texte, le message de refus aussi, et un email mal formé est bloqué par la
validation native du navigateur (`required`, `type="email"`) avant même d'atteindre le serveur.

## Variante J+30 (fading)

Ajoute une règle : refuser plus de 3 invitations envoyées dans la même minute (anti-spam). Écris
d'abord le test unitaire (avec une horloge injectée — souviens-toi du lab 01 et du lab 04, jamais
de `Date.now()` caché), puis fais-le remonter dans les trois couches : intégration (deux requêtes
rapprochées, la 4e doit renvoyer 429), puis e2e (le message affiché doit être clair pour
l'utilisateur, pas juste un code d'erreur).

## Application TribuZen

`tribuzen/src/domain/invitation/peutInviter.ts` (couche 1), branché sur l'API NestJS réelle
(couche 2, remplace le petit serveur Node par les tests e2e NestJS du cours 03), et sur l'écran
`InvitationForm` React (couche 3, Playwright pointé sur l'app Next.js). Commit :
`feat(invitation): peutInviter + pyramide complète (unit/intégration/e2e)`.
