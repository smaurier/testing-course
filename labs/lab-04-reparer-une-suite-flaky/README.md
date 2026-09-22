# Lab 04 — Intervention : réparer une suite de tests flaky, sans affaiblir une seule assertion

> **Outcome :** à la fin, tu sais reconnaître et corriger les deux causes de flakiness les plus
> fréquentes (module 14) — état partagé entre tests, async non maîtrisé — sans jamais tricher en
> retirant ou en assouplissant une assertion. C'est le geste qui distingue « les tests passent »
> de « les tests prouvent quelque chose ».
> **Vrai outil :** vitest 5, `beforeEach`, `vi.useFakeTimers()` / `vi.advanceTimersByTime()`.
> **Feedback :** `npm run lab:04` — RED (3 échecs déterministes) tant que `test/notifications.test.ts`
> n'est pas réparé. Le correcteur-labs lit ton **diff** du fichier de test avant de trancher : zéro
> `.skip`, zéro `.todo`, zéro `retry`, zéro timeout augmenté en pansement — le module est explicite,
> la quarantaine et les retries cachent le symptôme, ils ne le corrigent pas. `npm run solution:04`
> prouve l'oracle ; tu ne l'ouvres pas avant ton GREEN.

## Lire avant (une lecture bornée)

- Module [`14-flaky-tests-et-debugging.md`](../../modules/14-flaky-tests-et-debugging.md) §2 en
  entier : les 4 causes, la section « Reproduire un test flaky », et surtout « Quarantaine et
  retries — pansement, pas solution ». Lis aussi l'Exemple A (flaky temps + async).

## Énoncé — une particularité de ce lab

Dans tous les autres labs, tu ne touches jamais à `test/` : c'est l'oracle. **Ici, c'est l'inverse.**
`test/notifications.test.ts` **est** le livrable — c'est la suite cassée que tu répares en place.
`src/notifications.ts` est correct et ne se modifie pas.

La suite actuelle contient deux causes classiques de flakiness, **dans le même fichier** :

1. **État partagé entre tests** : une seule instance de `NotificationCenter` créée au niveau du
   `describe`, réutilisée par les quatre tests. Le deuxième test suppose une instance fraîche
   (id 1, une seule notification) — faux, le premier test l'a déjà mutée. Le résultat dépend de
   l'**ordre d'exécution**, pas du contenu du test.
2. **Async non maîtrisé** : `notifierApresDelai()` programme un `setTimeout` réel ; le test
   l'appelle puis vérifie le résultat **immédiatement**, sans attendre ni contrôler l'horloge.
   L'assertion s'exécute avant que la notification ne soit poussée.

Dans cet exercice, ces deux bugs échouent **de façon reproductible à chaque exécution** (pas
« parfois ») — pour que tu voies l'effet immédiatement. En vrai CI, les mêmes causes se manifestent
souvent seulement par intermittence, selon la charge de la machine ou l'ordre de lancement des
tests (`--sequence.shuffle`) — ce qui les rend beaucoup plus difficiles à repérer. La correction
est identique dans les deux cas.

## Étapes (en friction)

1. Lance `npm run lab:04`. Lis les 3 échecs. Pour chacun, identifie laquelle des deux causes est
   en jeu (parfois les deux à la fois).
2. Corrige la cause 1 : donne à chaque test une instance fraîche (`beforeEach`), sans changer
   aucune assertion existante — seulement la manière dont l'état est préparé.
3. Corrige la cause 2 : remplace le `setTimeout` réel non maîtrisé par des fake timers
   (`vi.useFakeTimers()` avant, `vi.useRealTimers()` après — dans un `finally` ou un `afterEach`),
   et **prouve** l'état avant ET après l'avance du temps (deux assertions, pas une).
4. Relance `npm run lab:04` après chaque correction, pas seulement à la fin.
5. Relis ton fichier final : zéro `.skip`, zéro `.todo`, zéro `retry:`, zéro `timeout` augmenté.
   Si tu en trouves un, c'est un pansement — retire-le et corrige la vraie cause.

## Vérifier

```bash
cd 06-testing/labs
npm run lab:04
```

**Ce que l'oracle vérifie**

Les 4 tests de `test/notifications.test.ts` passent, avec les **mêmes assertions** qu'au départ
(vérifiées par le correcteur, pas mécaniquement — un vrai oracle anti-triche demanderait de
figer le texte du fichier, ce qui interdirait tout refactor légitime ; c'est pour ça que la
vérification de « rien n'a été affaibli » revient au correcteur-labs, qui lit ton diff).

## Variante J+30 (fading)

Ajoute un 5e test : deux notifications programmées avec `notifierApresDelai` à des délais
différents (10ms et 20ms) doivent apparaître dans le bon ordre. Écris-le avec des fake timers
dès le départ, sans jamais passer par la version « non maîtrisée » — tu dois pouvoir l'écrire
juste en te souvenant du geste, sans revoir ce README.

## Application TribuZen

Même correction sur `tribuzen/test/notifications.test.ts`. Commit :
`fix(tests): NotificationCenter — état frais par test, horloge maîtrisée (plus de flaky)`.
