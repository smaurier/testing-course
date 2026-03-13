# Lab 14 — Flaky Test Detection and Fixing

| Difficulte | Duree estimee | Module |
|------------|---------------|--------|
| 4/5        | 90 min        | [Module 14](../../modules/14-flaky-tests-et-debugging) |

## Objectifs

- Detecter les tests flaky en les executant plusieurs fois
- Corriger un test dependant du temps (Date.now)
- Corriger un test avec etat partage (variable globale)
- Corriger un test avec condition de course (async non-await)
- Implementer un systeme de quarantaine pour tests flaky
- Identifier et corriger 3 tests flaky dans une suite

## Exercices

### Exercice 1 — `detectFlaky(testFn, runs)`
Executez une fonction de test N fois et rapportez le ratio succes/echec. Un test est flaky s'il produit des resultats differents entre les runs.

### Exercice 2 — Fix time-dependent test
Un test utilise `Date.now()` directement, ce qui le rend non-deterministe. Rendez-le deterministe en injectant une horloge.

### Exercice 3 — Fix shared-state test
Un test mute une variable globale, causant des interferences entre tests. Isolez l'etat par test.

### Exercice 4 — Fix race condition test
Un test lance des operations async sans les attendre correctement. Corrigez l'ordre d'execution.

### Exercice 5 — `quarantineManager`
Gerez une liste de tests en quarantaine : ajout, retrait, auto-skip, et rapport de sante.

### Exercice 6 — Full suite fix
Identifiez et corrigez 3 tests flaky dans une suite de tests.

## Lancer les tests

```bash
npx tsx labs/lab-14-flaky-tests/solution.ts
```
