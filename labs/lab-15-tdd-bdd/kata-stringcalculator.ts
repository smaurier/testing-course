// =============================================================================
// Kata StringCalculator — Phase RED
// =============================================================================
// Tu écris TOIS-MÊME chaque test avant l'implémentation.
// Pas de tests pré-écrits ici — c'est le but.
//
// Protocole :
//   1. Lis l'exigence suivante dans le module 15
//   2. Ferme le module
//   3. Écris le test ici
//   4. Lance → doit être ROUGE
//   5. Écris le minimum de code pour passer
//   6. Lance → doit être VERT
//   7. Retour à 1
//
// Commande : npx tsx labs/lab-15-tdd-bdd/kata-stringcalculator.ts
// =============================================================================

import { createTestRunner } from '../test-utils.ts';

const { test, assertEqual, assertThrows, run } = createTestRunner('StringCalculator kata');

// -----------------------------------------------------------------------------
// Implémentation — commence vide, laisse émerger des tests
// -----------------------------------------------------------------------------

function calculate(_input: string): number {
  throw new Error('Not implemented');
}

// -----------------------------------------------------------------------------
// Tes tests ici — un par exigence, dans l'ordre
// -----------------------------------------------------------------------------

// Exigence 1 : chaine vide → 0
// await test('...', () => { ... });

// Exigence 2 : un seul nombre → lui-même
// await test('...', () => { ... });

// Exigence 3 : deux nombres séparés par virgule → somme
// await test('...', () => { ... });

// Exigence 4 : nombre arbitraire de valeurs
// await test('...', () => { ... });

// Exigence 5 : saut de ligne comme séparateur
// await test('...', () => { ... });

// Exigence 6 : séparateur personnalisé (format //sep\nnombres)
// await test('...', () => { ... });

// Exigence 7 : nombres négatifs → throw avec liste des négatifs
// await test('...', () => { ... });

// Exigence 8 : nombres > 1000 ignorés
// await test('...', () => { ... });

run();
