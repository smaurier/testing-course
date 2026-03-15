# Lab 04 — Mocking et test doubles

## Objectifs

Maîtriser les différents types de test doubles (stub, spy, mock, fake) et les techniques d'injection de dépendances pour le testing.

## Exercices

### Exercice 1 : Types de test doubles
Creez des implementations stub, spy, mock et fake d'une interface `Logger`.

### Exercice 2 : Mock fetch
Mockez `fetch` pour tester un `UserService.getById`.

### Exercice 3 : Mocking de timers
Utilisez un fake timer pour tester une classe `Scheduler` basee sur setTimeout.

### Exercice 4 : Mock de module
Mockez un module `database` pour tester un `ProductRepository`.

### Exercice 5 : Mocking partiel
Mockez une seule fonction d'un module tout en gardant les autres reelles.

### Exercice 6 : DI complete
Injectez un mock `EmailService` dans un `OrderService`.

## Lancement

```bash
npx tsx labs/lab-04-mocking/solution.ts
```
