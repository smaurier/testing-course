# Lab 17 — Performance Testing Patterns

| Difficulte | Duree estimee | Module |
|------------|---------------|--------|
| 4/5        | 90 min        | [Module 17](../../modules/17-performance-testing) |

## Objectifs

- Mesurer les performances d'une fonction (avg, min, max, p95)
- Simuler une charge concurrente (load test)
- Mesurer le debit (throughput) en requetes par seconde
- Detecter les fuites memoire (heap croissant)
- Comparer les metriques actuelles a une baseline (regression)
- Assembler une suite complete de tests de performance

## Exercices

### Exercice 1 — `benchmark(fn, iterations)`
Mesurez le temps d'execution moyen, min, max et p95 d'une fonction sur N iterations.

### Exercice 2 — `loadTest(fn, concurrency, duration)`
Simulez des utilisateurs concurrents executant une fonction pendant une duree donnee.

### Exercice 3 — `throughputTest(fn, targetRPS)`
Mesurez le nombre de requetes par seconde que la fonction peut supporter.

### Exercice 4 — `memoryProfile(fn)`
Detectez les fuites memoire en mesurant la croissance du heap.

### Exercice 5 — `regressionDetect(baseline, current, threshold)`
Comparez les metriques actuelles a une baseline et detectez les regressions.

### Exercice 6 — Full performance suite
Assemblez benchmark + load test + memory check + regression report.

## Lancer les tests

```bash
npx tsx labs/lab-17-performance/solution.ts
```
