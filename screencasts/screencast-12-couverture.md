# Screencast 12 — Couverture de code et mutation testing

## Informations
- **Duree estimee** : 15-18 min
- **Module** : `modules/12-couverture-et-mutation-testing.md`
- **Lab associe** : Lab 12
- **Prerequis** : Screencast 11

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Projet de demo avec Vitest + @vitest/coverage-v8
- [ ] Fichier `modules/12-couverture-et-mutation-testing.md` ouvert

## Script

### [00:00-02:00] Introduction — Qu'est-ce que la couverture ?

> La couverture mesure quelle proportion du code source est executee pendant les tests. C'est un indicateur quantitatif, pas qualitatif. 100% de couverture ne signifie pas 0 bugs.

**Action** : Afficher les 4 metriques.

```
METRIQUE    | CE QU'ELLE MESURE                          | EXEMPLE
------------|--------------------------------------------|---------
Statements  | Instructions executees                     | const x = 1; → 1 statement
Branches    | Chemins conditionnels couverts             | if/else, switch, ternaire
Functions   | Fonctions appelees au moins une fois       | Declarations, expressions
Lines       | Lignes physiques executees                 | Approximation de statements
```

### [02:00-05:00] Configuration et execution

**Action** : Configurer la couverture dans Vitest.

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/mocks/**',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
```

**Action** : Executer avec couverture.

```bash
npx vitest run --coverage
```

> Le rapport texte s'affiche dans le terminal. Le rapport HTML dans `coverage/index.html` est interactif : on peut naviguer fichier par fichier et voir exactement quelles lignes sont couvertes.

### [05:00-08:00] Le piege du 100% — Ce que la couverture ne dit PAS

> La couverture dit "ce code a ete execute". Elle ne dit pas "ce code produit le bon resultat".

**Action** : Montrer un test avec 100% de couverture mais aucune verification.

```typescript
function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

// 100% de couverture, 0% de confiance
it('should execute divide', () => {
  divide(10, 2);  // pas d'assertion !
  try { divide(10, 0); } catch { /* ignore */ }
});
// → Toutes les lignes sont executees, mais RIEN n'est verifie

// Le vrai test
it('should divide correctly', () => {
  expect(divide(10, 2)).toBe(5);
  expect(() => divide(10, 0)).toThrow('Division by zero');
});
```

> C'est pour ca que la couverture est necessaire mais pas suffisante. Elle detecte le code NON teste, mais pas le code MAL teste.

### [08:00-10:00] Seuils pragmatiques

**Action** : Afficher les recommandations.

```
SEUIL    | CONTEXTE
---------|--------------------------------------------------
60-70%   | MVP, prototype, code exploratoire
80%      | Application en production (bon objectif par defaut)
90%+     | Librairie publique, code critique (paiement, auth)
100%     | Quasiment jamais pertinent — cout excessif

RECOMMANDATION :
- Viser 80% global avec des seuils plus eleves pour le code critique
- Ne JAMAIS baisser les seuils — uniquement les monter progressivement
- Exclure le code genere, les types, les mocks
```

### [10:00-14:00] Mutation testing — Tester la qualite des tests

> Le mutation testing repond a la question : "Mes tests sont-ils assez bons pour detecter des bugs ?" Il modifie le code source (mutations) et verifie que les tests detectent le changement.

**Action** : Expliquer le concept.

```
CODE ORIGINAL                     MUTATION                      TEST DETECTE ?
---------------------------------|-----------------------------|-----------
if (age >= 18)                   | if (age > 18)               | Oui/Non ?
return a + b                     | return a - b                | Oui/Non ?
if (items.length === 0)          | if (items.length !== 0)     | Oui/Non ?
price * 0.9                      | price * 0.1                 | Oui/Non ?

MUTANT TUE    = le test a detecte la mutation ✓
MUTANT SURVIT = le test n'a PAS detecte la mutation ✗
```

**Action** : Configurer Stryker.

```bash
pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner
npx stryker init
```

```javascript
// stryker.config.js
export default {
  testRunner: 'vitest',
  mutate: ['src/**/*.ts', '!src/**/*.test.ts'],
  reporters: ['html', 'clear-text', 'progress'],
  thresholds: { high: 80, low: 60, break: 50 },
};
```

**Action** : Executer Stryker.

```bash
npx stryker run
```

> Un score de mutation de 80% signifie que 80% des mutations ont ete tuees par les tests. Les 20% restants sont des cas ou vos tests ne detecteraient pas un bug.

### [14:00-16:00] Interpreter un rapport de mutations

**Action** : Montrer un rapport et corriger un test faible.

```typescript
// Mutant survivant : "return a + b" mute en "return a - b" → test passe encore !
function calculateDiscount(price: number, rate: number): number {
  return price * rate;
}

// Test faible — ne verifie pas la valeur exacte
it('should return a number', () => {
  const result = calculateDiscount(100, 0.1);
  expect(result).toBeDefined(); // passe avec + ET -
});

// Test corrige — verifie la valeur
it('should apply discount correctly', () => {
  expect(calculateDiscount(100, 0.1)).toBe(10);
  expect(calculateDiscount(200, 0.25)).toBe(50);
});
```

### [16:00-17:30] Recapitulatif

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. La couverture mesure CE QUI EST EXECUTE, pas CE QUI EST VERIFIE
2. 80% est un bon seuil par defaut, 100% est rarement pertinent
3. Le mutation testing mesure la QUALITE des tests, pas la quantite
4. Mutant tue = bon test, mutant survivant = test a ameliorer
5. Stryker + Vitest pour le mutation testing en TypeScript
6. Couverture + mutations = vision complete de la sante des tests

PROCHAINE ETAPE :
→ Screencast 13 : Tests en CI/CD
```

## Points d'attention pour l'enregistrement
- Le test avec 100% couverture et 0 assertion est le moment cle — bien le montrer
- Le rapport HTML de couverture est visuellement parlant — naviguer dans les fichiers
- Le mutation testing est souvent meconnu — prendre le temps d'expliquer
- Stryker peut etre lent — preparer un rapport pre-genere pour la demo
