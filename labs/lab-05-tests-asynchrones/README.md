# Lab 05 — Tests asynchrones

## Objectifs

Maîtriser les techniques de test pour le code asynchrone : Promises, fake timers, EventEmitter, debounce, polling et race conditions.

## Exercices

### Exercice 1 : Promises
Testez des fonctions qui retournent des Promises (resolve et reject).

### Exercice 2 : RetryWithDelay
Testez une fonction de retry avec delai en utilisant des fake timers.

### Exercice 3 : PubSub (EventEmitter)
Testez un système PubSub base sur un pattern EventEmitter.

### Exercice 4 : Debounce
Testez une fonction debounce avec un controle précis des timers.

### Exercice 5 : Polling
Testez une fonction qui poll toutes les N ms jusqu'a ce qu'une condition soit remplie.

### Exercice 6 : Race conditions
Testez des increments concurrents sur un compteur.

## Lancement

```bash
npx tsx labs/lab-05-tests-asynchrones/solution.ts
```
