# Module 00 — Prerequis et Introduction

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 1/5        | 45 min        | --  | [Quiz 00](../quizzes/quiz-00-prerequis.html) |

## Objectifs

- Comprendre pourquoi un cours dedie au testing est necessaire
- Installer les outils : Vitest, Playwright, MSW
- Ecrire et executer un premier test
- Naviguer dans la structure du cours

---

## Pourquoi un cours dedie au testing ?

Le testing est une competence **transversale**. Que vous travailliez avec Vue, React, Angular, ou un backend Node.js, les fondamentaux sont les memes :

- **Les principes** : pyramide de tests, isolation, determinisme
- **Les outils** : Vitest (runner), Playwright (E2E), MSW (mocking API)
- **Les patterns** : AAA, test doubles, Page Object, fixtures
- **Les methodologies** : TDD, BDD, contract testing

Ce cours extrait ces fondamentaux des cours framework-specifiques pour les traiter en profondeur.

---

## Prerequisites

### Connaissances requises

```typescript
// TypeScript basique : types, interfaces, generics
interface User {
  id: number;
  name: string;
  email: string;
}

// Fonctions async/await
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// Classes et modules ES
export class UserService {
  constructor(private readonly baseUrl: string) {}

  async getById(id: number): Promise<User> {
    const res = await fetch(`${this.baseUrl}/users/${id}`);
    if (!res.ok) throw new Error(`User ${id} not found`);
    return res.json();
  }
}
```

### Environnement

- **Node.js** >= 20.0.0
- **npm** ou **pnpm**
- **VS Code** (recommande) avec l'extension Vitest

---

## Installation

### 1. Initialiser le projet

```bash
mkdir testing-playground && cd testing-playground
npm init -y
```

### 2. Installer les outils de test

```bash
# Runner de tests
npm install -D vitest @types/node typescript tsx

# E2E
npm install -D @playwright/test
npx playwright install chromium

# Mocking API
npm install -D msw
```

### 3. Configuration Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,          // describe, it, expect sans import
    environment: 'node',    // ou 'jsdom' pour les composants
    include: ['**/*.test.ts', '**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
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

### 4. Configuration TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "types": ["vitest/globals"]
  }
}
```

---

## Votre premier test

### Le code a tester

```typescript
// src/math.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

### Le fichier de test

```typescript
// src/math.test.ts
import { describe, it, expect } from 'vitest';
import { add, divide, clamp } from './math';

describe('add', () => {
  it('should add two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should handle negative numbers', () => {
    expect(add(-1, 1)).toBe(0);
  });

  it('should handle zero', () => {
    expect(add(0, 0)).toBe(0);
  });
});

describe('divide', () => {
  it('should divide two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should return float for non-integer division', () => {
    expect(divide(7, 2)).toBe(3.5);
  });

  it('should throw on division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });
});

describe('clamp', () => {
  it('should return value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('should clamp to min when below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('should clamp to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
```

### Executer

```bash
npx vitest run          # Une seule execution
npx vitest              # Mode watch (re-execute a chaque modification)
npx vitest --ui         # Interface graphique
```

Resultat attendu :

```
 ✓ src/math.test.ts (9)
   ✓ add (3)
   ✓ divide (3)
   ✓ clamp (3)

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

---

## Structure du cours

```
testing-course/
├── modules/          # 19 modules theoriques (00-18)
├── labs/             # 18 labs pratiques (exercice + solution)
├── quizzes/          # 19 quizzes interactifs HTML
├── screencasts/      # 19 plans de screencast
├── visualizations/   # 5 visualisations interactives HTML
└── glossaire.md      # ~50 termes essentiels
```

### Progression

| Phase | Modules | Niveau | Theme |
|-------|---------|--------|-------|
| 1 | 00-02 | Debutant | Fondamentaux : pourquoi, anatomie, patterns |
| 2 | 03-05 | Intermediaire | Outils : Vitest, mocking, async |
| 3 | 06-09 | Avance | Applicatif : architecture, composants, MSW, integration |
| 4 | 10-13 | Avance | E2E : Playwright, couverture, CI/CD |
| 5 | 14-18 | Expert | Methodologies : TDD, BDD, contract, performance |

### Convention des labs

Chaque lab contient 3 fichiers :
- `README.md` — enonce et instructions
- `exercise.ts` — squelette avec `// TODO` a completer
- `solution.ts` — solution complete avec tests integres

```bash
npx tsx labs/lab-03-vitest-fondamentaux/exercise.ts   # Votre code
npx tsx labs/lab-03-vitest-fondamentaux/solution.ts    # Solution
```

---

## Liens avec les cours frameworks

Ce cours est concu pour etre **prerequis** aux modules de testing des cours Vue, React et Angular :

| Testing Course | Vue | React | Angular |
|---------------|-----|-------|---------|
| Modules 02-05 (Vitest, mocking) | → Tests unitaires de composables | → Tests de hooks | → Tests de services |
| Module 07 (Composants) | → Vue Test Utils | → React Testing Library | → Angular TestBed |
| Modules 10-11 (Playwright) | → E2E Nuxt | → E2E Next.js | → E2E Angular |
| Module 08 (MSW) | → Mock API Vue | → Mock API React | → Mock HTTP Angular |

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| -- | [01 - Pourquoi tester](./01-pourquoi-tester) |

---

## Ressources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles)
