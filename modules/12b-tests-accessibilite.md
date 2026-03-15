# Module 12b — Tests d'accessibilite

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 3/5        | 90 min        | — | — |

## Objectifs

- Comprendre pourquoi l'accessibilite doit etre testee automatiquement
- Connaitre les obligations legales (EAA 2025, RGAA) et le referentiel WCAG 2.1 AA
- Detecter les violations a11y des le linting avec ESLint
- Ecrire des tests unitaires avec jest-axe / vitest-axe
- Automatiser les tests E2E d'accessibilite avec Playwright et axe-core
- Integrer les verifications a11y dans une pipeline CI/CD

---

## 1. Pourquoi tester l'accessibilite

### Le contexte legal

Depuis juin 2025, l'**European Accessibility Act (EAA)** impose aux services numeriques commercialises dans l'UE de respecter le niveau **WCAG 2.1 AA**. En France, le **RGAA** (Referentiel General d'Amelioration de l'Accessibilite) traduit ces exigences en criteres concrets.

Ne pas respecter ces obligations expose a :

- Des sanctions financieres (jusqu'a 50 000 EUR par manquement en France)
- Des poursuites civiles (discrimination)
- Une exclusion de marches publics

### Les tests manuels ne suffisent pas

L'audit manuel (navigation clavier, lecteur d'ecran) est indispensable mais :

- Il est **lent** : un audit complet prend plusieurs jours
- Il est **non reproductible** : les resultats varient selon l'auditeur
- Il ne **previent pas les regressions** : une PR peut casser l'accessibilite sans que personne ne s'en apercoive

La solution : **automatiser tout ce qui peut l'etre** et reserver l'audit manuel aux aspects subjectifs (comprehension, parcours utilisateur).

### La pyramide de tests a11y

```
            /  Audit manuel  \        <- Lent, couteux, indispensable
           /   Tests E2E      \       <- Playwright + axe-core
          / Tests d'integration \     <- Composants assembles + axe
         /   Tests unitaires     \    <- jest-axe sur composants isoles
        /   Analyse statique      \   <- ESLint plugins a11y
       ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
```

Chaque niveau attrape des categories de bugs differentes :

| Niveau | Exemples de bugs detectes |
|--------|--------------------------|
| **Lint** | `<img>` sans `alt`, `<div onClick>` sans `onKeyDown` |
| **Unit** | Formulaire sans labels, roles ARIA invalides |
| **E2E** | Ordre de focus incoherent, contrastes insuffisants |
| **Manuel** | Texte alternatif non pertinent, parcours confus |

---

## 2. ESLint : detection statique

L'analyse statique est le premier filet de securite. Elle s'execute dans l'editeur et bloque les PRs avant meme que les tests tournent.

### Pour React : `eslint-plugin-jsx-a11y`

```bash
pnpm add -D eslint-plugin-jsx-a11y
```

Configuration dans `eslint.config.js` (flat config) :

```typescript
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      // Exiger un attribut alt sur toutes les images
      'jsx-a11y/alt-text': 'error',

      // Un element cliquable doit aussi reagir au clavier
      'jsx-a11y/click-events-have-key-events': 'error',

      // Pas d'autofocus automatique (desoriente les utilisateurs de lecteurs d'ecran)
      'jsx-a11y/no-autofocus': 'error',

      // Chaque champ de formulaire doit avoir un label associe
      'jsx-a11y/label-has-associated-control': ['error', {
        required: { some: ['nesting', 'id'] },
      }],

      // Les elements interactifs doivent avoir un role accessible
      'jsx-a11y/no-static-element-interactions': 'error',
    },
  },
];
```

### Pour Angular : `@angular-eslint`

```bash
pnpm add -D @angular-eslint/eslint-plugin-template
```

```typescript
// eslint.config.js (extrait)
{
  files: ['**/*.html'],
  rules: {
    '@angular-eslint/template/accessibility-alt-text': 'error',
    '@angular-eslint/template/accessibility-elements-content': 'error',
    '@angular-eslint/template/accessibility-label-has-associated-control': 'error',
    '@angular-eslint/template/accessibility-valid-aria': 'error',
    '@angular-eslint/template/click-events-have-key-events': 'error',
    '@angular-eslint/template/no-autofocus': 'error',
  },
}
```

### Regles cles a activer en priorite

| Regle | Raison |
|-------|--------|
| `alt-text` | Les images sans texte alternatif sont invisibles pour les lecteurs d'ecran |
| `click-events-have-key-events` | Les utilisateurs clavier ne peuvent pas interagir avec un `onClick` seul |
| `no-autofocus` | L'autofocus deplace le curseur de maniere inattendue |
| `label-has-associated-control` | Un champ sans label est inutilisable avec un lecteur d'ecran |
| `no-static-element-interactions` | Un `<div>` avec un handler n'est pas un bouton |

> **Astuce** : ces plugins ne detectent qu'environ **30% des violations WCAG**. Le linting est necessaire mais jamais suffisant.

---

## 3. jest-axe / vitest-axe : tests unitaires

[axe-core](https://github.com/dequelabs/axe-core) est le moteur de regles d'accessibilite le plus utilise. La librairie `jest-axe` l'integre dans les tests unitaires via un matcher custom.

### Installation

```bash
pnpm add -D jest-axe @types/jest-axe
```

> `jest-axe` fonctionne aussi avec Vitest sans modification.

### Setup global (Vitest)

Creer un fichier `tests/setup-a11y.ts` :

```typescript
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);
```

Puis dans `vitest.config.ts` :

```typescript
export default defineConfig({
  test: {
    setupFiles: ['./tests/setup-a11y.ts'],
  },
});
```

### Tester un composant React

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { LoginForm } from './LoginForm';

expect.extend(toHaveNoViolations);

describe('LoginForm', () => {
  it('ne contient aucune violation a11y', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('associe chaque champ a son label', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container, {
      runOnly: ['label'],
    });
    expect(results).toHaveNoViolations();
  });
});
```

### Tester un composant Vue

```typescript
import { mount } from '@vue/test-utils';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import ContactForm from './ContactForm.vue';

expect.extend(toHaveNoViolations);

describe('ContactForm', () => {
  it('est accessible', async () => {
    const wrapper = mount(ContactForm);
    const results = await axe(wrapper.element as HTMLElement);
    expect(results).toHaveNoViolations();
  });
});
```

### Filtrer les regles

Certaines regles ne sont pas pertinentes dans le contexte d'un test unitaire (ex. : les contrastes de couleur dependent du CSS qui n'est pas charge en JSDOM).

```typescript
it('est accessible (hors contrastes)', async () => {
  const { container } = render(<DataTable data={mockData} />);
  const results = await axe(container, {
    rules: {
      'color-contrast': { enabled: false },
      'document-title': { enabled: false },
      'html-has-lang': { enabled: false },
      'landmark-one-main': { enabled: false },
    },
  });
  expect(results).toHaveNoViolations();
});
```

### Helper reutilisable

Pour eviter de repeter la configuration de filtrage dans chaque test :

```typescript
// tests/helpers/a11y.ts
import { axe, type AxeResults } from 'jest-axe';

const IGNORED_RULES_UNIT = [
  'color-contrast',
  'document-title',
  'html-has-lang',
  'landmark-one-main',
  'page-has-heading-one',
];

export async function checkA11y(container: Element): Promise<AxeResults> {
  return axe(container, {
    rules: Object.fromEntries(
      IGNORED_RULES_UNIT.map((rule) => [rule, { enabled: false }]),
    ),
  });
}
```

Utilisation simplifiee :

```typescript
import { checkA11y } from '../helpers/a11y';

it('est accessible', async () => {
  const { container } = render(<SearchBar />);
  expect(await checkA11y(container)).toHaveNoViolations();
});
```

---

## 4. Playwright : tests E2E d'accessibilite

Les tests E2E operent sur un vrai navigateur avec le CSS reel. Ils detectent des violations impossibles a trouver en JSDOM : contrastes, ordre de focus, comportement des roles ARIA.

### Installation

```bash
pnpm add -D @axe-core/playwright
```

### Scanner une page entiere

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibilite', () => {
  test('la page d\'accueil respecte WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('la page de connexion respecte WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```

### Scanner une section specifique

```typescript
test('le formulaire de recherche est accessible', async ({ page }) => {
  await page.goto('/products');

  const results = await new AxeBuilder({ page })
    .include('#search-form')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### Exclure des elements connus (dette technique)

```typescript
test('page accessible sauf banniere tierce', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .exclude('.third-party-banner')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### Tester la navigation clavier

```typescript
test('le menu principal est navigable au clavier', async ({ page }) => {
  await page.goto('/');

  // Premiere tabulation : on arrive sur le lien "Aller au contenu"
  await page.keyboard.press('Tab');
  const skipLink = page.locator(':focus');
  await expect(skipLink).toHaveText('Aller au contenu principal');

  // Tabulations suivantes : on parcourt le menu
  await page.keyboard.press('Tab');
  const firstMenuItem = page.locator(':focus');
  await expect(firstMenuItem).toHaveRole('link');
  await expect(firstMenuItem).toHaveAttribute('href', '/');

  // Echap ferme un menu ouvert
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="menu"]')).not.toBeVisible();
});
```

### Tester les roles ARIA

Playwright propose des selecteurs semantiques qui refletent la facon dont les technologies d'assistance voient la page :

```typescript
test('les elements interactifs ont les bons roles', async ({ page }) => {
  await page.goto('/dashboard');

  // Verifier la presence d'un bouton avec un nom accessible
  const submitBtn = page.getByRole('button', { name: 'Soumettre' });
  await expect(submitBtn).toBeVisible();
  await expect(submitBtn).toBeEnabled();

  // Verifier qu'un dialog s'ouvre avec le bon titre
  await submitBtn.click();
  const dialog = page.getByRole('dialog', { name: 'Confirmer l\'envoi' });
  await expect(dialog).toBeVisible();

  // Verifier la structure de navigation
  const nav = page.getByRole('navigation', { name: 'Menu principal' });
  await expect(nav).toBeVisible();

  // Verifier les landmarks
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
});
```

### Screenshot pour audit visuel

```typescript
test('le focus est visible sur les elements interactifs', async ({ page }) => {
  await page.goto('/login');

  // Focus sur le premier champ
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveCSS('outline-style', /.+/);

  // Capture d'ecran pour validation visuelle
  await page.screenshot({
    path: 'screenshots/a11y-focus-login.png',
    fullPage: true,
  });
});
```

### Helper Playwright reutilisable

```typescript
// tests/helpers/a11y-e2e.ts
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

export async function expectPageAccessible(
  page: Page,
  options?: { exclude?: string[]; include?: string },
): Promise<void> {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa']);

  if (options?.include) {
    builder = builder.include(options.include);
  }

  for (const selector of options?.exclude ?? []) {
    builder = builder.exclude(selector);
  }

  const results = await builder.analyze();

  if (results.violations.length > 0) {
    const summary = results.violations.map((v) =>
      `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} elements)`
    ).join('\n');
    throw new Error(`Violations a11y detectees :\n${summary}`);
  }
}
```

Utilisation :

```typescript
import { expectPageAccessible } from '../helpers/a11y-e2e';

test('page produits accessible', async ({ page }) => {
  await page.goto('/products');
  await expectPageAccessible(page, {
    exclude: ['.cookie-banner'],
  });
});
```

---

## 5. CI/CD : automatiser

### Lighthouse CI avec assertions a11y

Lighthouse CI permet de definir des seuils d'accessibilite dans la pipeline :

```bash
pnpm add -D @lhci/cli
```

Fichier `lighthouserc.json` :

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/login"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["warn", { "minScore": 0.8 }]
      }
    },
    "upload": {
      "target": "filesystem",
      "outputDir": "./lighthouse-reports"
    }
  }
}
```

Script dans `package.json` :

```json
{
  "scripts": {
    "lhci": "lhci autorun"
  }
}
```

### axe dans la pipeline GitHub Actions

```yaml
# .github/workflows/a11y.yml
name: Tests accessibilite

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install

      - name: Tests unitaires a11y
        run: pnpm vitest run --reporter=verbose tests/a11y/

      - name: Build et demarrer le serveur
        run: |
          pnpm build
          pnpm preview &
          npx wait-on http://localhost:3000

      - name: Tests E2E a11y (Playwright + axe)
        run: pnpm playwright test tests/e2e/a11y/

      - name: Lighthouse CI
        run: pnpm lhci

      - name: Upload des rapports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: a11y-reports
          path: |
            lighthouse-reports/
            playwright-report/
```

### Rapport HTML des violations

axe-core genere des resultats JSON structurees. Un script simple peut les convertir en HTML :

```typescript
// scripts/a11y-report.ts
import { writeFileSync } from 'node:fs';
import type { AxeResults } from 'axe-core';

export function generateA11yReport(
  results: AxeResults,
  outputPath: string,
): void {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rapport a11y</title></head>
<body>
  <h1>Rapport d'accessibilite</h1>
  <p>URL: ${results.url}</p>
  <p>Violations: ${results.violations.length}</p>
  <table border="1">
    <thead>
      <tr><th>Severite</th><th>Regle</th><th>Description</th><th>Elements</th></tr>
    </thead>
    <tbody>
      ${results.violations.map((v) => `
        <tr>
          <td>${v.impact}</td>
          <td>${v.id}</td>
          <td>${v.description}</td>
          <td>${v.nodes.length}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

  writeFileSync(outputPath, html, 'utf-8');
}
```

### Strategie de severite

Ne bloquez pas la pipeline pour toutes les violations. Adoptez une approche progressive :

| Impact axe-core | Action CI |
|-----------------|-----------|
| **critical** | Fail la pipeline (bloquant) |
| **serious** | Fail la pipeline (bloquant) |
| **moderate** | Warning (non bloquant) |
| **minor** | Warning (non bloquant) |

```typescript
// Dans un test Playwright
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa'])
  .analyze();

const blocking = results.violations.filter(
  (v) => v.impact === 'critical' || v.impact === 'serious',
);

expect(blocking).toEqual([]);
```

---

## 6. Exercices

### Exercice 1 — Auditer un formulaire avec jest-axe

**Consigne** : le composant `RegistrationForm` ci-dessous contient 3 violations d'accessibilite. Ecrivez un test qui les detecte, puis corrigez le composant.

```typescript
// RegistrationForm.tsx (avec violations)
export function RegistrationForm() {
  return (
    <form>
      <div>
        <input type="text" placeholder="Nom" />
      </div>
      <div>
        <input type="email" placeholder="Email" />
      </div>
      <div onClick={() => console.log('submit')}>Envoyer</div>
    </form>
  );
}
```

**Solution** :

```typescript
// RegistrationForm.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { RegistrationForm } from './RegistrationForm';

expect.extend(toHaveNoViolations);

describe('RegistrationForm', () => {
  it('detecte les violations a11y', async () => {
    const { container } = render(<RegistrationForm />);
    const results = await axe(container);
    // On s'attend a des violations tant que le composant n'est pas corrige
    expect(results.violations.length).toBeGreaterThan(0);
  });
});

// RegistrationForm.tsx (corrige)
export function RegistrationForm() {
  return (
    <form aria-label="Inscription">
      <div>
        <label htmlFor="name">Nom</label>
        <input id="name" type="text" />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" />
      </div>
      <button type="submit">Envoyer</button>
    </form>
  );
}
```

---

### Exercice 2 — Test E2E de navigation clavier avec Playwright

**Consigne** : ecrivez un test Playwright qui verifie que la modale de confirmation de votre application :

1. Recoit le focus automatiquement a l'ouverture
2. Piege le focus (Tab ne sort pas de la modale)
3. Se ferme avec Echap
4. Restore le focus sur l'element declencheur apres fermeture

**Solution** :

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Modale de confirmation', () => {
  test('gestion du focus conforme WCAG', async ({ page }) => {
    await page.goto('/dashboard');

    // Ouvrir la modale
    const trigger = page.getByRole('button', { name: 'Supprimer' });
    await trigger.click();

    // 1. La modale recoit le focus
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('role', 'dialog');

    // 2. Le focus est piege dans la modale
    const confirmBtn = page.getByRole('button', { name: 'Confirmer' });
    const cancelBtn = page.getByRole('button', { name: 'Annuler' });
    await page.keyboard.press('Tab');
    await expect(confirmBtn).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancelBtn).toBeFocused();
    await page.keyboard.press('Tab');
    // Le focus revient au premier element focusable de la modale
    await expect(dialog.locator(':focus')).toBeVisible();

    // 3. Echap ferme la modale
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // 4. Le focus revient sur le bouton declencheur
    await expect(trigger).toBeFocused();
  });

  test('la modale est accessible (axe)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Supprimer' }).click();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```

---

## Ressources

- [axe-core rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md) — liste complete des regles
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/) — criteres filtrable par niveau
- [Playwright accessibility](https://playwright.dev/docs/accessibility-testing) — documentation officielle
- [RGAA 4.1](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/) — referentiel francais
