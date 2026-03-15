# Lab 10 — Playwright fondamentaux

## Objectifs

Apprendre les patterns fondamentaux de Playwright en simulant les interactions de page (sans vrai navigateur). On reconstruit les APIs clés : locateurs, auto-wait, formulaires, navigation et assertions.

## Concepts clés

- Page simulee avec `goto`, `getByRole`, `getByText`, `click`, `fill`
- Auto-wait : les actions attendent que l'élément soit visible/enabled
- Tests de formulaire : remplir, soumettre, vérifier
- Tests de navigation : changement d'URL, contenu dynamique
- Assertions Playwright : `toBeVisible`, `toHaveText`, `toHaveValue`, `toHaveCount`
- Scenario complet : login -> dashboard -> création -> vérification

## Exercices

### Exercice 1 : createPage — Page simulee
Implementez une page avec `goto`, `getByRole`, `getByText`, `click`, `fill`.

### Exercice 2 : Auto-wait
Les actions attendent que l'élément soit visible et enabled avant d'agir.

### Exercice 3 : Tests de formulaire
Remplir les champs, soumettre, vérifier le résultat.

### Exercice 4 : Tests de navigation
`goto` change l'URL et le contenu de la page.

### Exercice 5 : Assertions helpers
Implementez `toBeVisible`, `toHaveText`, `toHaveValue`, `toHaveCount`.

### Exercice 6 : Scenario complet
Login -> dashboard -> créer un item -> vérifier la liste.

## Lancer le lab

```bash
npx tsx labs/lab-10-playwright-fondamentaux/exercise.ts
npx tsx labs/lab-10-playwright-fondamentaux/solution.ts
```
