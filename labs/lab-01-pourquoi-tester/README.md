# Lab 01 — Pourquoi tester ?

## Objectifs

Comprendre la valeur economique et strategique des tests logiciels a travers des exercices pratiques de calcul et de classification.

## Exercices

### Exercice 1 : Calculateur de cout des bugs
Implementez `bugCostCalculator(phase, hourlyRate)` qui retourne le cout d'un bug selon la phase ou il est decouvert (requirements, design, coding, testing, production) en utilisant le multiplicateur standard (1x, 5x, 10x, 15x, 100x).

### Exercice 2 : Distribution de la pyramide de tests
Implementez `testPyramidDistribution(total, ratios)` qui distribue un nombre total de tests selon les ratios de la pyramide (unit, integration, e2e).

### Exercice 3 : Classification des tests
Implementez `classifyTest(description)` qui classe un test comme "unit", "integration" ou "e2e" selon sa description.

### Exercice 4 : Faut-il tester ?
Implementez `shouldWeTest(codeType, complexity, criticalityScore)` qui decide si un morceau de code merite d'etre teste.

### Exercice 5 : Calcul du ROI des tests
Implementez `calculateTestROI(bugs, debugTime, testWriteTime, testMaintainTime)` qui calcule le retour sur investissement.

### Exercice 6 : Priorisation des tests
Implementez `prioritizeTests(features)` qui trie les fonctionnalites par risque*frequence decroissant.

## Lancement

```bash
npx tsx labs/lab-01-pourquoi-tester/solution.ts
```
