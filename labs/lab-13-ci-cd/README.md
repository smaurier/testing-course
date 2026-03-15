# Lab 13 — CI/CD Pipeline Patterns

| Difficulte | Duree estimee | Module |
|------------|---------------|--------|
| 4/5        | 90 min        | [Module 13](../../modules/13-tests-en-ci-cd) |

## Objectifs

- Modeliser un pipeline CI/CD avec des stages sequentiels
- Paralleliser des stages independants
- Générer une matrice de build (Node versions x OS)
- Implementer un cache manager pour les computations couteuses
- Collecter des artefacts (résultats de tests, couverture)
- Assembler un pipeline complet avec fail-fast

## Exercices

### Exercice 1 — `createPipeline(stages)`
Creez une fonction qui exécuté des stages sequentiellement. Chaque stage est une fonction async qui peut echouer. Le pipeline s'arrete au premier echec et retourne le résultat de chaque stage.

### Exercice 2 — `parallelStages(tasks)`
Implementez une fonction qui lance des stages independants en parallele. Retournez tous les résultats (succes et echecs) une fois tous termines.

### Exercice 3 — `matrixBuild(nodeVersions, os)`
Generez toutes les combinaisons d'une matrice de build (ex: Node 18/20/22 x ubuntu/windows). Chaque combinaison produit un objet `{ node, os }`.

### Exercice 4 — `cacheManager(key, compute)`
Implementez un cache qui memoize les résultats de fonctions couteuses. Si le cache contient déjà la clé, retournez le résultat sans recalculer.

### Exercice 5 — `artifactCollector`
Creez un collecteur d'artefacts qui accumule des résultats de tests et des rapports de couverture, puis généré un rapport agrege.

### Exercice 6 — Pipeline complet
Assemblez un pipeline complet : lint -> test:unit -> test:intégration -> test:e2e -> deploy, avec fail-fast (arret au premier echec).

## Lancer les tests

```bash
npx tsx labs/lab-13-ci-cd/solution.ts
```
