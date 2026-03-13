# Lab 08 — MSW (Mock Service Worker)

## Objectifs

Apprendre les patterns MSW pour intercepter les requetes HTTP dans les tests, sans dependance reelle a MSW (intercepteur fetch simule).

## Concepts cles

- Mock server avec mapping URL -> reponse
- Handlers GET/POST avec validation du body
- Parametres dynamiques dans les routes (`/api/users/:id`)
- Simulation d'erreurs reseau, timeout, 500
- Tests CRUD complets avec mock server

## Exercices

### Exercice 1 : createMockServer — Enregistrement de handlers
Implementez un mock server qui intercepte `fetch` avec des handlers URL -> reponse.

### Exercice 2 : Test GET avec handlers succes/erreur
Utilisez le mock server pour tester GET /api/users avec reponses de succes et d'erreur.

### Exercice 3 : Test POST avec validation du body
Testez POST /api/users avec un handler qui valide le body de la requete.

### Exercice 4 : Handlers dynamiques avec path params
Supportez les parametres de route (`/api/users/:id`) dans les handlers.

### Exercice 5 : Simulation d'erreurs
Simulez des erreurs reseau, timeout et erreurs serveur 500.

### Exercice 6 : Test CRUD complet
Testez un cycle create/read/update/delete complet avec le mock server.

## Lancer le lab

```bash
npx tsx labs/lab-08-msw/exercise.ts
npx tsx labs/lab-08-msw/solution.ts
```
