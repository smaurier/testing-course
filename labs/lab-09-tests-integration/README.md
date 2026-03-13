# Lab 09 — Tests d'integration

## Objectifs

Apprendre a tester l'integration entre plusieurs modules : service + base de donnees, evenements, fixtures, et un systeme complet API + service + DB + events.

## Concepts cles

- Base de donnees en memoire pour les tests
- Tests de service integre avec la couche de persistance
- Isolation par rollback de transaction
- Flux d'evenements entre services
- Factories de fixtures pour les donnees de test
- Integration complete : routeur API + service + DB + bus d'evenements

## Exercices

### Exercice 1 : createInMemoryDB — CRUD en memoire
Implementez une base de donnees en memoire avec create, findById, findAll, update, delete.

### Exercice 2 : UserService + InMemoryDB
Testez un UserService qui utilise InMemoryDB (create, findById, update, delete).

### Exercice 3 : Transaction rollback
Implementez un pattern de rollback pour isoler les tests.

### Exercice 4 : Flux d'evenements
Testez que OrderService emet un evenement consomme par NotificationService.

### Exercice 5 : Fixture factory
Creez des factories `createUser(overrides)` et `createOrder(overrides)` pour les donnees de test.

### Exercice 6 : Integration complete
Testez un systeme complet : routeur API + service + DB + bus d'evenements.

## Lancer le lab

```bash
npx tsx labs/lab-09-tests-integration/exercise.ts
npx tsx labs/lab-09-tests-integration/solution.ts
```
