# Lab 12 — Couverture et mutation testing

## Objectifs

Comprendre les metriques de couverture de code (lignes, branches) et le mutation testing. On implemente les algorithmes de calcul sans outil externe.

## Concepts clés

- Couverture de lignes : pourcentage de lignes executees
- Couverture de branches : pourcentage de branches parcourues
- Génération de mutants : remplacement d'operateurs, conditions
- Detection de mutants : tues vs survivants
- Rapport de couverture agrege avec seuils
- Score de mutation complet

## Exercices

### Exercice 1 : analyzeCoverage — Couverture de lignes
Calculez le pourcentage de lignes executees.

### Exercice 2 : analyzeBranchCoverage — Couverture de branches
Calculez le pourcentage de branches parcourues.

### Exercice 3 : generateMutants — Génération de mutants
Creez des mutations du code source (remplacement d'operateurs, negation de conditions).

### Exercice 4 : runMutationTest — Detection de mutants
Executez les tests sur chaque mutant et determinez s'il est tue ou survivant.

### Exercice 5 : coverageReport — Rapport agrege
Aggregez la couverture de plusieurs fichiers et verifiez les seuils.

### Exercice 6 : Mutation testing complet
Implementez une fonction, ses tests, generez les mutants et calculez le score de mutation.

## Lancer le lab

```bash
npx tsx labs/lab-12-couverture/exercise.ts
npx tsx labs/lab-12-couverture/solution.ts
```
