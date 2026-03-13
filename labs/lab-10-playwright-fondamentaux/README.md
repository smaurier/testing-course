# Lab 10 — Playwright fondamentaux

## Objectifs

Apprendre les patterns fondamentaux de Playwright en simulant les interactions de page (sans vrai navigateur). On reconstruit les APIs cles : locateurs, auto-wait, formulaires, navigation et assertions.

## Concepts cles

- Page simulee avec `goto`, `getByRole`, `getByText`, `click`, `fill`
- Auto-wait : les actions attendent que l'element soit visible/enabled
- Tests de formulaire : remplir, soumettre, verifier
- Tests de navigation : changement d'URL, contenu dynamique
- Assertions Playwright : `toBeVisible`, `toHaveText`, `toHaveValue`, `toHaveCount`
- Scenario complet : login -> dashboard -> creation -> verification

## Exercices

### Exercice 1 : createPage — Page simulee
Implementez une page avec `goto`, `getByRole`, `getByText`, `click`, `fill`.

### Exercice 2 : Auto-wait
Les actions attendent que l'element soit visible et enabled avant d'agir.

### Exercice 3 : Tests de formulaire
Remplir les champs, soumettre, verifier le resultat.

### Exercice 4 : Tests de navigation
`goto` change l'URL et le contenu de la page.

### Exercice 5 : Assertions helpers
Implementez `toBeVisible`, `toHaveText`, `toHaveValue`, `toHaveCount`.

### Exercice 6 : Scenario complet
Login -> dashboard -> creer un item -> verifier la liste.

## Lancer le lab

```bash
npx tsx labs/lab-10-playwright-fondamentaux/exercise.ts
npx tsx labs/lab-10-playwright-fondamentaux/solution.ts
```
