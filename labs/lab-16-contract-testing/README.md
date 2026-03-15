# Lab 16 — Contract Testing Patterns

| Difficulte | Duree estimee | Module |
|------------|---------------|--------|
| 4/5        | 90 min        | [Module 16](../../modules/16-contract-testing) |

## Objectifs

- Définir un contrat d'API (endpoint, méthode, champs attendus)
- Valider qu'une réponse respecte un contrat
- Detecter les breaking changes entre deux versions d'un contrat
- Implementer un test consumer-driven (pact)
- Vérifier un provider contre les pacts des consumers
- Assembler un flux complet de contract testing

## Exercices

### Exercice 1 — `defineContract(endpoint, method, expectedFields)`
Definissez un contrat schema avec les champs attendus et leurs types.

### Exercice 2 — `validateResponse(response, contract)`
Verifiez qu'une réponse contient tous les champs requis avec les bons types.

### Exercice 3 — `detectBreakingChange(oldContract, newContract)`
Comparez deux versions d'un contrat et identifiez les breaking changes.

### Exercice 4 — Consumer test (pact génération)
Un consumer définit ses attentes et généré un pact.

### Exercice 5 — Provider vérification
Le provider vérifié qu'il satisfait les pacts de ses consumers.

### Exercice 6 — Full contract flow
Assemblez le flux complet : consumer définit, provider vérifié, detection de breaking changes.

## Lancer les tests

```bash
npx tsx labs/lab-16-contract-testing/solution.ts
```
