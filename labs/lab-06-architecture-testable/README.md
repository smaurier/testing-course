# Lab 06 — Architecture testable

## Objectifs

Apprendre a structurer le code pour qu'il soit facilement testable : injection de dépendances, fonctions pures, Repository pattern, Interface Segregation, Ports & Adapters.

## Exercices

### Exercice 1 : Injection de dépendances
Refactorez un `NotificationService` couple pour utiliser l'injection de dépendances.

### Exercice 2 : Fonctions pures
Extrayez des fonctions pures d'un `PriceCalculator` impur.

### Exercice 3 : Repository pattern
Implementez un pattern Repository avec un `InMemoryRepository` (fake).

### Exercice 4 : Interface Segregation
Divisez un gros `UserService` en interfaces focalisees.

### Exercice 5 : Ports & Adapters
Implementez un pattern Ports & Adapters pour un `PaymentGateway`.

### Exercice 6 : Refactoring complet
Rendez un `FileProcessor` non-testable testable avec DI + fonctions pures.

## Lancement

```bash
npx tsx labs/lab-06-architecture-testable/solution.ts
```
