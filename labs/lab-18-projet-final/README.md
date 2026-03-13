# Lab 18 — Projet Final : Integration Complete

| Difficulte | Duree estimee | Module |
|------------|---------------|--------|
| 5/5        | 120 min       | [Module 18](../../modules/18-projet-final) |

## Objectifs

- Elaborer une strategie de test avec distribution pyramidale
- Ecrire une suite de tests unitaires pour un TaskService (CRUD + validation)
- Ecrire des tests d'integration avec une base en memoire
- Creer des mock handlers pour les endpoints REST
- Simuler un scenario e2e complet (create, edit, complete, delete)
- Generer un rapport de test agrege avec couverture

## Exercices

### Exercice 1 — `createTestStrategy(app)`
Generez un plan de test avec la distribution pyramidale (unit > integration > e2e).

### Exercice 2 — Unit test suite: TaskService
Testez le CRUD et la validation d'un TaskService.

### Exercice 3 — Integration test suite: TaskService + InMemoryDB
Testez le service avec un vrai store en memoire.

### Exercice 4 — Mock API handlers
Creez des handlers mock pour les endpoints REST (GET/POST/PUT/DELETE).

### Exercice 5 — E2E scenario
Simulez un scenario complet : create -> edit -> complete -> delete.

### Exercice 6 — Full test report
Agregez tous les resultats et generez un rapport avec couverture.

## Lancer les tests

```bash
npx tsx labs/lab-18-projet-final/solution.ts
```
