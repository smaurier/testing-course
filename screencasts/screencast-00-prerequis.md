# Screencast 00 — Prerequis et Introduction

## Informations
- **Duree estimee** : 12-15 min
- **Module** : `modules/00-prerequis-et-introduction.md`
- **Lab associe** : --
- **Prerequis** : Aucun

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Node.js 20+ installe
- [ ] pnpm installe
- [ ] Aucun projet existant dans le dossier de demo

## Script

### [00:00-01:30] Introduction — Bienvenue dans le cours de testing

> Le testing est une competence transversale. Que vous travailliez en Vue, React, Angular ou Node.js, les fondamentaux sont identiques : pyramide de tests, isolation, determinisme, test doubles. Ce cours extrait ces fondamentaux pour les traiter en profondeur, independamment du framework.

**Action** : Afficher la structure du cours.

```
testing-course/
├── modules/          ← 19 modules (00 a 18)
├── labs/             ← Exercices pratiques
├── quizzes/          ← Auto-evaluation
├── screencasts/      ← Videos (ce que vous regardez)
└── visualizations/   ← Schemas interactifs
```

### [01:30-04:00] Prerequis — Ce que vous devez deja connaitre

> Avant de commencer, verifions les prerequis. Vous devez etre a l'aise avec TypeScript basique : types, interfaces, generics, async/await. Vous devez aussi connaitre les bases de npm/pnpm et avoir un editeur configure.

**Action** : Montrer un snippet TypeScript rapide.

```typescript
// Vous devez etre a l'aise avec ce niveau de TypeScript
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// Generics basiques
function first<T>(items: T[]): T | undefined {
  return items[0];
}
```

### [04:00-07:00] Installation — Vitest, Playwright, MSW

> Installons les trois outils principaux du cours. Vitest pour les tests unitaires, Playwright pour le E2E, et MSW pour mocker les API au niveau reseau.

**Action** : Creer un projet de demo et installer les dependances.

```bash
mkdir testing-demo && cd testing-demo
pnpm init
pnpm add -D vitest playwright @playwright/test msw typescript
npx playwright install chromium
```

**Action** : Creer un `vitest.config.ts` minimal.

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

### [07:00-10:00] Premier test — Le "Hello World" du testing

> Ecrivons notre premier test pour verifier que tout fonctionne.

**Action** : Creer `src/sum.ts` et `src/sum.test.ts`.

```typescript
// src/sum.ts
export function sum(a: number, b: number): number {
  return a + b;
}
```

```typescript
// src/sum.test.ts
import { describe, it, expect } from 'vitest';
import { sum } from './sum';

describe('sum', () => {
  it('should add two positive numbers', () => {
    expect(sum(1, 2)).toBe(3);
  });

  it('should handle negative numbers', () => {
    expect(sum(-1, 1)).toBe(0);
  });
});
```

**Action** : Executer le test.

```bash
npx vitest run
```

> Le test passe. Vitest a detecte automatiquement le fichier `.test.ts`, compile le TypeScript a la volee via Vite, et affiche le resultat en vert.

### [10:00-12:30] Structure du cours — Comment naviguer

> Le cours est structure en 19 modules progressifs. Les modules 00 a 05 couvrent les fondamentaux. Les modules 06 a 09 couvrent l'architecture et les tests d'integration. Les modules 10-11 se concentrent sur Playwright. Et les modules 12 a 18 couvrent des sujets avances : couverture, CI/CD, flaky tests, TDD/BDD, contract testing, performance et le projet final.

**Action** : Afficher la progression recommandee.

```
FONDAMENTAUX (Semaine 1-2)
  00 Prerequis → 01 Pourquoi tester → 02 Anatomie → 03 Vitest → 04 Mocking → 05 Async

INTEGRATION (Semaine 3-4)
  06 Architecture → 07 Composants → 08 MSW → 09 Integration

E2E (Semaine 5)
  10 Playwright → 11 Playwright avance

AVANCE (Semaine 6-8)
  12 Couverture → 13 CI/CD → 14 Flaky → 15 TDD/BDD → 16 Contract → 17 Performance

SYNTHESE
  18 Projet final
```

### [12:30-14:00] Recapitulatif

> Recapitulons. Vous avez installe Vitest, Playwright et MSW. Vous avez ecrit et execute votre premier test. Et vous connaissez la structure du cours. A partir du prochain screencast, on rentre dans le vif du sujet : pourquoi tester.

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Trois outils principaux : Vitest (unitaire), Playwright (E2E), MSW (mocking reseau)
2. Vitest detecte automatiquement les fichiers *.test.ts
3. Le cours suit une progression : fondamentaux → integration → E2E → avance
4. Chaque module a un screencast, un lab et un quiz

PROCHAINE ETAPE :
→ Screencast 01 : Pourquoi tester ?
```

## Points d'attention pour l'enregistrement
- S'assurer que Node.js et pnpm sont installes avant de commencer
- L'installation de Playwright peut prendre du temps — couper au montage si necessaire
- Le premier test doit passer du premier coup pour donner confiance
- Montrer brievement le watch mode (`npx vitest`) avant de conclure
- Garder un ton accueillant, c'est le premier contact avec le cours
