# Lab 09 — Tests d'intégration

## Objectifs

Apprendre à tester l'intégration entre plusieurs modules : service + base de donnees, événements, fixtures, et un système complet API + service + DB + events.

## Concepts clés

- Base de donnees en mémoire pour les tests
- Tests de service intégré avec la couche de persistance
- Isolation par rollback de transaction
- Flux d'événements entre services
- Factories de fixtures pour les donnees de test
- Intégration complete : routeur API + service + DB + bus d'événements

## Exercices

### Exercice 1 : createInMemoryDB — CRUD en mémoire
Implementez une base de donnees en mémoire avec create, findById, findAll, update, delete.

### Exercice 2 : UserService + InMemoryDB
Testez un UserService qui utilise InMemoryDB (create, findById, update, delete).

### Exercice 3 : Transaction rollback
Implementez un pattern de rollback pour isoler les tests.

### Exercice 4 : Flux d'événements
Testez que OrderService emet un événement consomme par NotificationService.

### Exercice 5 : Fixture factory
Creez des factories `createUser(overrides)` et `createOrder(overrides)` pour les donnees de test.

### Exercice 6 : Intégration complete
Testez un système complet : routeur API + service + DB + bus d'événements.

## Lancer le lab

```bash
npx tsx labs/lab-09-tests-integration/exercise.ts
npx tsx labs/lab-09-tests-integration/solution.ts
```
