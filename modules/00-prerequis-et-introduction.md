---
titre: Prérequis et introduction
cours: 06-testing
notions: [objectif du cours, prérequis TypeScript, installation et config Vitest, structure d'un projet testé, philosophie du cours, boucle rouge-vert-refactor en survol]
outcomes: [installer et configurer Vitest dans un projet TypeScript, comprendre les prérequis et l'objectif du cours, lancer sa première suite de tests]
prerequis: [TypeScript labs 01-10]
next: 01-pourquoi-tester
libs: [{ name: vitest, version: ^4.1.9 }]
tribuzen: mise en place du harnais de test TribuZen (Vitest réel sur la logique domaine invitation/RBAC)
last-reviewed: 2026-07
---

| ← Précédent | Suivant → |
|---|---|
| — | [01 — Pourquoi tester](./01-pourquoi-tester.md) |

# Prérequis et introduction

> **Outcomes — tu sauras FAIRE :** installer et configurer Vitest dans un projet TypeScript, comprendre les prérequis et l'objectif du cours, lancer ta première suite de tests.
> **Difficulté :** :star:

## 1. Cas concret d'abord

Dans TribuZen, la logique domaine s'accumule rapidement : validation d'invitation, règles RBAC, calcul de budget famille. Avant même d'avoir une base Postgres ou un frontend, tu dois pouvoir **vérifier que cette logique est correcte**. Comment ?

```typescript
// src/domain/invitation.ts — logique pure, zéro dépendance infra
export function validateInvitationEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

Sans outillage, tu relances l'app entière à chaque changement pour vérifier manuellement. Avec Vitest configuré, un seul fichier `.test.ts` te donne un retour en millisecondes, rejouable, automatisable en CI. Ce module t'amène de zéro à **un harnais de test qui tourne** sur la vraie logique TribuZen.

## 2. Théorie complète, concise

### Prérequis TypeScript

Ce cours part du principe que tu maîtrises les **TypeScript labs 01-10**. Les patterns que tu rencontreras dans chaque test :

```typescript
// Interfaces et types — structure des doubles et fixtures
interface InvitationRepo {
  save(email: string, familyId: string): Promise<{ id: string }>;
}

// Génériques — wrappers de résultats, helpers de test
function expectRight<T>(result: Result<T, Error>): T { /* ... */ }

// async/await — quasiment tous les tests d'intégration et de service
it('persiste une invitation', async () => {
  const result = await service.invite('fam-1', 'bob@tribu.fr');
  expect(result.id).toBeDefined();
});

// Classes — les services à tester sont souvent des classes DI
export class InvitationService {
  constructor(private repo: InvitationRepo) {}
}
```

Si l'un de ces patterns te bloque, reviens aux labs TS avant de continuer : les tests qui échouent pour des raisons de syntaxe masquent les vrais problèmes.

### Installer Vitest dans un projet TypeScript

Vitest est **Vite-native** : il réutilise la même pipeline de transformation que ton build, donc zéro configuration Babel séparée, HMR inclus en mode watch.

```bash
# Initialiser un projet (si besoin)
npm init -y

# Dépendances de test (Vitest v4 — vérifier la version courante sur npm)
npm install -D vitest@^4.1.9 @types/node typescript

# Coverage (optionnel pour ce module, utile dès le module 10)
npm install -D @vitest/coverage-v8
```

Scripts `package.json` à ajouter :

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui",
    "coverage": "vitest run --coverage"
  }
}
```

### Configurer `vitest.config.ts`

Vitest lit `vitest.config.ts` à la racine du projet. Config minimale opérationnelle pour un projet TypeScript back-end (logique pure, services) :

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,           // describe/it/expect disponibles sans import
    environment: 'node',     // 'node' pour back-end / logique pure
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',        // 'v8' ou 'istanbul'
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
```

Pour que TypeScript reconnaisse les globals (`describe`, `it`, `expect`) sans erreur de type :

```json
// tsconfig.json — extrait
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["vitest/globals"]
  }
}
```

### Structure d'un projet testé

Convention la plus répandue : **colocate** les tests avec le code qu'ils couvrent.

```
src/
├── domain/
│   ├── invitation.ts
│   └── invitation.test.ts     ← à côté de la source
├── services/
│   ├── invitation-service.ts
│   └── invitation-service.test.ts
└── utils/
    ├── date.ts
    └── date.test.ts
vitest.config.ts
tsconfig.json
package.json
```

Avantages de la colocation : refactor = déplacer les deux fichiers ensemble, imports relatifs courts, clarté sur la couverture manquante.

### Philosophie du cours

Ce cours traite le testing comme une **compétence transversale et stratégique**, pas une formalité de fin de sprint.

Trois convictions qui structurent tout le contenu :

1. **Les tests sont un outil de design.** Écrire un test difficile révèle un code à couplage fort. Si tu galères à isoler `InvitationService`, le service est probablement mal conçu.
2. **Tester le comportement, pas l'implémentation.** Les tests doivent survivre aux refactors internes. On assertera sur les sorties observables et les interactions de bord — jamais sur les détails privés.
3. **La pyramide de confiance.** Tests unitaires (rapides, nombreux) → tests d'intégration (plus lents, moins nombreux) → E2E (lents, rares). Chaque couche a un rôle distinct.

Ce cours couvre toutes les couches : modules 01-05 (fondamentaux + mocking), 06-09 (architecture + composants + MSW + intégration), 10-13 (Playwright + CI), 14-18 (TDD, BDD, contract testing).

### Survol de la boucle rouge-vert-refactor

Le **cycle TDD** (Test-Driven Development) sera traité en profondeur au module 14. Le survol ici t'en donne la mécanique pour comprendre les exemples du cours.

```
1. 🔴 RED   — écrire un test qui échoue (il ne peut pas passer : le code n'existe pas encore)
2. 🟢 GREEN  — écrire le minimum de code pour le faire passer
3. 🔵 REFACTOR — améliorer le code SANS casser le test
   └─ retour à 🔴
```

Chaque itération est courte (minutes, pas heures). La règle stricte : **on n'écrit pas de code de prod sans un test rouge qui l'appelle**. Ce cours n'impose pas TDD partout, mais les worked examples suivent ce rythme pour que tu voies la boucle en action.

## 3. Worked examples

### Exemple A — configuration et premier test

**Étape 1 : code à tester** — une fonction pure de validation d'invitation TribuZen.

```typescript
// src/domain/invitation.ts
export function validateInvitationEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function buildInvitationId(familyId: string, email: string): string {
  return `${familyId}::${email.toLowerCase()}`;
}
```

**Étape 2 : fichier de test colocalisé.**

```typescript
// src/domain/invitation.test.ts
import { describe, it, expect } from 'vitest';
import { validateInvitationEmail, buildInvitationId } from './invitation';

describe('validateInvitationEmail', () => {
  it('accepte un email valide', () => {
    expect(validateInvitationEmail('bob@tribu.fr')).toBe(true);
  });

  it('refuse une adresse sans domaine', () => {
    expect(validateInvitationEmail('bob')).toBe(false);
  });

  it('refuse une adresse avec espace', () => {
    expect(validateInvitationEmail('bob @tribu.fr')).toBe(false);
  });
});

describe('buildInvitationId', () => {
  it('construit un identifiant normalisé', () => {
    expect(buildInvitationId('fam-1', 'BOB@Tribu.fr')).toBe('fam-1::bob@tribu.fr');
  });
});
```

**Étape 3 : lancer les tests.**

```bash
npx vitest run          # exécution unique — utile en CI
npx vitest              # mode watch — relance à chaque sauvegarde (dev)
npx vitest --ui         # interface graphique dans le navigateur
```

Résultat attendu :

```
 ✓ src/domain/invitation.test.ts (4)
   ✓ validateInvitationEmail (3)
   ✓ buildInvitationId (1)

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  ~80ms
```

Pas-à-pas : (1) `describe` groupe les tests par unité logique ; (2) `it` décrit un comportement observable (pas « appelle la fonction ») ; (3) `expect(...).toBe(...)` est l'assertion — si le prédicat échoue, Vitest affiche la valeur reçue vs attendue en diff coloré.

### Exemple B — cycle rouge-vert-refactor sur 1 itération

On ajoute une règle métier : une invitation expire après 7 jours. On suit le cycle.

**🔴 RED — le test d'abord, le code n'existe pas encore.**

```typescript
// src/domain/invitation.test.ts — ajout
import { isInvitationExpired } from './invitation'; // n'existe pas encore

it('détecte une invitation expirée après 7 jours', () => {
  const createdAt = new Date('2026-06-01T00:00:00Z');
  const now = new Date('2026-06-09T00:00:00Z'); // 8 jours après
  expect(isInvitationExpired(createdAt, now)).toBe(true);
});

it('considère une invitation valide à 6 jours', () => {
  const createdAt = new Date('2026-06-01T00:00:00Z');
  const now = new Date('2026-06-07T00:00:00Z'); // 6 jours après
  expect(isInvitationExpired(createdAt, now)).toBe(false);
});
```

`vitest run` → erreur d'import. C'est le **red** attendu.

**🟢 GREEN — minimum de code pour passer.**

```typescript
// src/domain/invitation.ts — ajout
const EXPIRY_DAYS = 7;

export function isInvitationExpired(createdAt: Date, now: Date): boolean {
  const diffMs = now.getTime() - createdAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > EXPIRY_DAYS;
}
```

`vitest run` → 6 tests passent.

**🔵 REFACTOR — nommer la constante, pas de nouveau comportement.**

```typescript
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function isInvitationExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() > EXPIRY_MS;
}
```

`vitest run` → toujours 6 tests verts. Le refactor est sûr car les tests le gardent sous surveillance.

## 4. Pièges & misconceptions

- **`globals: true` sans `"types": ["vitest/globals"]` dans `tsconfig.json`.** TypeScript ne connaît pas `describe`, `it`, `expect` et souligne tout en rouge dans l'éditeur, même si les tests passent en CLI. Les globals sont disponibles à l'exécution (Vitest les injecte) mais le compilateur les ignore sans la déclaration de types. *Correct* : ajouter `"types": ["vitest/globals"]` dans `compilerOptions` du `tsconfig.json`.

- **Mauvais environnement : `jsdom` pour du code serveur, `node` pour des composants DOM.** `environment: 'jsdom'` émule un navigateur (`window`, `document`, `localStorage`). Si tu testes de la logique métier pure (calculs, validation, services) avec jsdom, tu charges 30 Mo d'émulation pour rien et tu risques des pollutions entre tests. À l'inverse, tester un composant qui accède à `window` dans l'environnement `node` lève une `ReferenceError`. *Correct* : `node` pour logique pure et services back-end, `jsdom` (ou `happy-dom`) pour les composants UI — et en v4 tu peux mixer via les `projects` de workspace.

- **`vitest run` vs `vitest` confondus.** `vitest` (sans `run`) lance le mode **watch** : il re-exécute à chaque sauvegarde, ne se termine jamais. En CI ou dans un script de build, il bloque le process indéfiniment. *Correct* : `vitest run` en CI/CD (exécution unique, code de sortie 0/1), `vitest` (watch) en développement local.

- **`include` trop large qui capture `node_modules`.** Le pattern par défaut `**/*.test.ts` peut descendre dans `node_modules` si `exclude` n'est pas explicite. *Correct* : toujours déclarer `exclude: ['**/node_modules/**', '**/dist/**']` dans la config.

- **Oublier d'installer `@vitest/coverage-v8` avant `vitest run --coverage`.** Vitest v4 sépare le provider de coverage en package distinct. Sans lui, `--coverage` lève une erreur et ne produit rien. *Correct* : `npm install -D @vitest/coverage-v8` (ou `@vitest/coverage-istanbul` selon le provider choisi).

## 5. Ancrage TribuZen

Couche fil-rouge : **mise en place du harnais de test TribuZen (Vitest réel sur la logique domaine invitation/RBAC)**.

En session, on ne crée pas un projet fictif "testing-playground" : on configure Vitest **dans le repo TribuZen réel**. Les premiers tests portent sur la logique domaine existante :

- `validateInvitationEmail`, `buildInvitationId`, `isInvitationExpired` — fonctions pures, zéro dépendance infra, idéales pour débuter.
- `can(user, action, resource)` — la règle RBAC est également logique pure : stub de rôle en entrée, assertion booléenne en sortie.

La config `vitest.config.ts` installée ici persistera tout le cours : chaque nouveau module ajoute des tests dans le même harnais. À la fin du cours, TribuZen a une suite couvrant logique, services, composants, et E2E — pas un repo de démo sacrifié.

## 6. Points clés

1. Vitest v4 est Vite-native : même pipeline de transformation que le build, config dans `vitest.config.ts`.
2. `globals: true` injecte `describe`/`it`/`expect` sans import ; `"types": ["vitest/globals"]` les déclare à TypeScript.
3. `environment: 'node'` pour logique pure et services ; `'jsdom'` / `'happy-dom'` pour les composants UI.
4. `vitest run` = exécution unique (CI) ; `vitest` = mode watch (dev) — ne pas confondre dans les scripts.
5. La structure colocated (`.test.ts` à côté de la source) simplifie les refactors et rend les gaps de couverture visibles.
6. Le cycle rouge-vert-refactor garantit que chaque ligne de code de prod est couverte avant d'exister.
7. Les prérequis TS (interfaces, génériques, async/await, classes) sont utilisés dans chaque pattern de test du cours.
8. Coverage v4 nécessite `@vitest/coverage-v8` ou `@vitest/coverage-istanbul` installé séparément.

## 7. Seeds Anki

```
Quelle commande lance Vitest en mode exécution unique (adapté CI) ?|vitest run
Quelle option de tsconfig.json donne les types pour les globals Vitest (describe, it, expect) ?|"types": ["vitest/globals"] dans compilerOptions
Quelle valeur de 'environment' choisir pour tester de la logique pure sans DOM ?|'node'
Quelle valeur de 'environment' choisir pour tester un composant qui accède à window ou document ?|'jsdom' ou 'happy-dom'
Quel package supplémentaire faut-il installer pour utiliser vitest run --coverage avec le provider v8 ?|@vitest/coverage-v8
Quelles sont les 3 étapes du cycle TDD rouge-vert-refactor ?|🔴 écrire un test qui échoue → 🟢 minimum de code pour le faire passer → 🔵 refactorer sans casser les tests
Pourquoi colocaliser les fichiers .test.ts à côté de leur source ?|Les imports relatifs sont courts, le refactor déplace les deux fichiers ensemble, et les gaps de couverture sont immédiatement visibles
```

---

> **Module suivant :** [01 — Pourquoi tester](./01-pourquoi-tester.md) — pyramide de tests, ROI du testing, et les cas où ne pas tester. Le premier lab pratique démarre là.
