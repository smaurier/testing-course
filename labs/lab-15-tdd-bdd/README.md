# Lab 15 — TDD Kata and BDD Patterns

| Difficulte | Duree estimee | Module |
|------------|---------------|--------|
| 4/5        | 90 min        | [Module 15](../../modules/15-tdd-et-bdd) |

## Objectifs

- Pratiquer le cycle TDD Red-Green-Refactor avec une Stack
- Resoudre le kata TDD RomanNumerals
- Implementer un runner de specs BDD Given-When-Then
- Créer un système de step définitions
- Appliquer le TDD outside-in sur un UserRegistration
- Resoudre le kata du bowling score calculator

## Exercices

### Exercice 1 — TDD Stack
Implementez une Stack (push, pop, peek, isEmpty, size) en suivant le cycle Red-Green-Refactor.

### Exercice 2 — TDD RomanNumerals
Convertissez un entier en chiffres romains (1=I, 4=IV, 9=IX, 40=XL, etc.).

### Exercice 3 — BDD Given-When-Then runner
Creez un runner de specs qui exécuté des scenarios BDD avec des étapes Given, When, Then.

### Exercice 4 — Step définitions
Implementez un registre de step définitions qui mappe des patterns Given/When/Then a des fonctions.

### Exercice 5 — TDD outside-in: UserRegistration
Construisez un service d'inscription utilisateur depuis le test d'acceptance vers les details.

### Exercice 6 — Bowling score calculator
Calculez le score d'une partie de bowling (10 frames, strikes, spares).

## Lancer les tests

```bash
npx tsx labs/lab-15-tdd-bdd/solution.ts
```
