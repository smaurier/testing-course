# Lab 03 — Vitest fondamentaux

## Objectifs

Maitriser les matchers Vitest, les tests parametres, les snapshots et les matchers personnalises.

## Exercices

### Exercice 1 : Matchers de base
Exercez les matchers fondamentaux : toBe, toEqual, toContain, toMatch, toThrow a travers des fonctions utilitaires.

### Exercice 2 : Tests parametres (each)
Implementez un fizzbuzz et creez des donnees de tests parametres pour le valider avec un pattern `.each`.

### Exercice 3 : Snapshot testing
Implementez `createUserSummary` et verifiez la sortie avec une approche snapshot.

### Exercice 4 : Matcher personnalise
Implementez `toBeWithinRange(min, max)` comme un matcher personnalise.

### Exercice 5 : Filtrage de tests
Implementez une suite de tests qui utilise `.skip` et `.todo` de maniere appropriee.

### Exercice 6 : Suite complete
Implementez une suite complete pour une classe `TodoList` en utilisant tous les types de matchers.

## Lancement

```bash
npx tsx labs/lab-03-vitest-fondamentaux/solution.ts
```
