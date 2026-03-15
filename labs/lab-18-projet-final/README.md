# Lab 18 — Projet Final : Intégration Complete

| Difficulte | Duree estimee | Module |
|------------|---------------|--------|
| 5/5        | 120 min       | [Module 18](../../modules/18-projet-final) |

## Objectifs

- Elaborer une stratégie de test avec distribution pyramidale
- Écrire une suite de tests unitaires pour un TaskService (CRUD + validation)
- Écrire des tests d'intégration avec une base en mémoire
- Créer des mock handlers pour les endpoints REST
- Simuler un scenario e2e complet (create, edit, complete, delete)
- Générer un rapport de test agrege avec couverture

## Exercices

### Exercice 1 — `createTestStrategy(app)`
Generez un plan de test avec la distribution pyramidale (unit > intégration > e2e).

### Exercice 2 — Unit test suite: TaskService
Testez le CRUD et la validation d'un TaskService.

### Exercice 3 — Intégration test suite: TaskService + InMemoryDB
Testez le service avec un vrai store en mémoire.

### Exercice 4 — Mock API handlers
Creez des handlers mock pour les endpoints REST (GET/POST/PUT/DELETE).

### Exercice 5 — E2E scenario
Simulez un scenario complet : create -> edit -> complete -> delete.

### Exercice 6 — Full test report
Agregez tous les résultats et generez un rapport avec couverture.

## Lancer les tests

```bash
npx tsx labs/lab-18-projet-final/solution.ts
```
