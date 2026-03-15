# Lab 07 — Tests de composants

## Objectifs

Apprendre à tester des composants UI sans framework, en simulant le DOM et les interactions utilisateur.

## Concepts clés

- Rendu de templates HTML avec interpolation de props
- Simulation d'événements (click, input)
- Rendu conditionnel et listes
- Validation de formulaires
- Chargement asynchrone de composants
- Tests d'intégration d'un composant complet

## Exercices

### Exercice 1 : createComponent — Rendu avec props
Implementez `createComponent(template, props)` qui retourne le HTML avec les props interpolees.
- Le template utilise la syntaxe `{{propName}}`
- Les props sont un objet clé-valeur

### Exercice 2 : simulateClick — Gestionnaire d'événements
Implementez `simulateClick(element)` qui declenche un handler enregistre et suit les appels.
- L'élément possede un `onClick` handler
- Le tracker enregistre chaque appel

### Exercice 3 : renderList — Liste avec classes conditionnelles
Implementez `renderList(items, template)` qui généré du HTML pour une liste d'éléments.
- Chaque item peut avoir une classe conditionnelle (`active`, `disabled`)
- Le template est une fonction qui recoit l'item et retourne du HTML

### Exercice 4 : testFormValidation — Formulaire avec validation
Implementez un formulaire avec regles de validation et testez les états submit/erreur.
- Regles : required, minLength, email pattern
- Le formulaire expose `validate()`, `getErrors()`, `submit()`

### Exercice 5 : asyncComponentLoader — Chargement asynchrone
Implementez un loader qui simule les états loading/success/error.
- `load()` retourne une Promise
- Les états transitionnent : idle -> loading -> success | error

### Exercice 6 : SearchableList — Composant complet
Implementez un composant `SearchableList` avec filtre, selection et affichage.
- `filter(query)` filtre les items
- `select(index)` selectionne un item
- `getDisplayed()` retourne les items affiches

## Lancer le lab

```bash
# Exercice (fichier a completer)
npx tsx labs/lab-07-tests-composants/exercise.ts

# Solution
npx tsx labs/lab-07-tests-composants/solution.ts
```
