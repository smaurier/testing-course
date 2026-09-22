# Lab 06 — Un contrat construit de zéro entre le front et l'API TribuZen

> **Outcome :** à la fin, tu sais écrire un **contrat consumer-driven** — ce que le front exige
> d'une réponse API, vérifié des DEUX côtés — et expliquer pourquoi deux suites unitaires vertes
> (front qui mocke, API qui ignore le front) peuvent masquer une rupture qui plante en staging.
> **Vrai outil :** vitest 5, TypeScript 7. Pas de Pact ni de broker dans ce lab (voir note
> d'adaptation plus bas) — l'essentiel du mécanisme (contrat partagé, vérifié des deux côtés,
> attrape la dérive) est là, sans l'outillage lourd.
> **Feedback :** `npm run lab:06` — RED tant que `contract/invitation.contract.ts` est vide.
> `npm run solution:06` prouve l'oracle. `npm run lab:06:drift` est une démonstration à part
> (pas gating) : elle montre que le contrat de référence attrape une VRAIE dérive provider.

## Note d'adaptation

Le module 16 utilise Pact (broker, `Verifier`, `stateHandlers`) — un outillage réel mais lourd à
installer dans un lab (binaire natif, serveur mock). Ce lab enseigne le **même principe** avec un
contrat écrit à la main (un type + une fonction de validation), vérifié des deux côtés. Une fois
ce lab acquis, la bascule vers Pact en mission est une question d'outillage, pas de compréhension.

## Lire avant (une lecture bornée)

- Module [`16-contract-testing.md`](../../modules/16-contract-testing.md) §2 jusqu'à « Le contrat
  comme source de vérité » (pas les Worked examples Pact, hors périmètre de ce lab).
- Module [`04-mocking-et-test-doubles.md`](../../modules/04-mocking-et-test-doubles.md) — la
  différence entre mocker une réponse et **vérifier** qu'une vraie réponse la respecte.

## Énoncé

Deux fichiers te sont donnés, corrects, à ne pas modifier :

- `consumer/fetchInvitation.ts` — le front. Il refuse de faire confiance à une réponse brute :
  tout passe par `validateInvitationContract`, **que tu écris**.
- `provider/getInvitationResponse.ts` — l'API. Elle renvoie `{ id, familyId, email, status }`.

Ton travail : écrire `contract/invitation.contract.ts`, qui exporte :
- `InvitationDTO` — le type que le front exige (`id`, `familyId`, `email`: `string` ; `status`:
  une union fermée à 4 valeurs).
- `validateInvitationContract(payload: unknown): asserts payload is InvitationDTO` — une **vraie**
  validation runtime (pas un simple `as`), qui rejette tout ce qui ne respecte pas le contrat.

L'oracle te teste des deux côtés : côté consumer (ton contrat doit rejeter une réponse à qui il
manque `status`, une réponse où `email` serait imbriqué sous `contact`, `null`, un `status` hors
de l'union...), côté provider (la vraie réponse de `getInvitationResponse` doit passer ta
validation — sinon ton contrat est trop strict, ou faux).

## Étapes (en friction)

1. Écris `InvitationDTO` (le type), sans la fonction de validation d'abord.
2. Écris `validateInvitationContract` en `unknown` → vérifie chaque champ un par un, lève une
   erreur explicite (nommant le champ fautif) à la première violation.
3. `npm run lab:06` — regarde quels tests échouent encore, ajoute la vérification manquante.
4. Une fois vert, lance `npm run lab:06:drift` : il utilise **volontairement** un provider qui a
   dérivé (email imbriqué sous `contact`) — ton contrat (enfin, celui de référence, voir le
   fichier) doit le détecter et faire échouer le test. C'est la preuve que le mécanisme marche :
   la même vérification qui valide un provider correct **bloque** un provider qui a cassé le
   contrat, avant que ça n'atteigne la prod.

## Vérifier

```bash
cd 06-testing/labs
npm run lab:06
npm run check:06
npm run lab:06:drift   # démonstration, à lire, pas à faire passer au vert
```

**Ce que l'oracle vérifie**

Consumer : accepte une réponse conforme ; rejette l'absence de `status` ; rejette `email` imbriqué
sous `contact` ; rejette `null`/`undefined`/un primitif ; rejette un `status` hors union. Provider :
la vraie réponse de `getInvitationResponse` passe ta validation. Types : `InvitationDTO` a les bons
champs, `validateInvitationContract` prend `unknown` et rétrécit via `asserts`.

## Application TribuZen

`tribuzen/src/contracts/invitation.contract.ts`, importé par `tribuzen-api` (provider, testé en
CI) et par `tribuzen` (front, consumer). Commit :
`feat(contract): InvitationDTO — contrat consumer-driven front/API`.
