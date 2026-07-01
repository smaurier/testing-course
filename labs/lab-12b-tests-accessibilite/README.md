# Lab 12b — Tests d'accessibilité

> **Outcome :** à la fin, tu sais détecter des violations axe-core avec **vitest-axe** sur un vrai composant React, corriger le composant pour passer `toHaveNoViolations`, et automatiser un test de navigation clavier avec **Playwright**.
> **Vrai outil :** vitest-axe, axe-core, @axe-core/playwright. Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu travailles sur le formulaire d'invitation TribuZen. Le composant livré (`InvitationFormBroken`) viole plusieurs critères WCAG détectables automatiquement. Ton travail :

1. Écrire un test vitest-axe qui **prouve** les violations sur la version cassée.
2. Écrire un second test qui **passe** sur la version corrigée que tu vas produire.
3. Écrire un test Playwright qui vérifie la **navigation clavier** du parcours d'invitation.

Code de départ fourni — **ne modifie pas `InvitationFormBroken`** :

```tsx
// src/components/InvitationFormBroken.tsx
export function InvitationFormBroken({ onInvite }: { onInvite: (email: string) => void }) {
  return (
    <div>
      <input type="text" placeholder="Prénom" />
      <input type="email" placeholder="Email" />
      <div onClick={() => onInvite('...')}>Envoyer l'invitation</div>
    </div>
  );
}
```

Tu dois créer `InvitationForm.tsx` (version corrigée) et les deux fichiers de tests.

## Étapes (en friction)

1. **Setup vitest-axe.** Installe `vitest-axe` et `axe-core`. Crée `tests/setup-a11y.ts` qui étend `expect` avec `toHaveNoViolations`. Branche-le dans `vitest.config.ts` via `setupFiles`.

2. **Test rouge sur la version cassée.** Dans `InvitationFormBroken.test.tsx`, rends le composant dans JSDOM et appelle `axe(container)`. Assert que `results.violations.length > 0` ET que le tableau des `id` de violations contient `'label'`. Ce test doit rester dans le repo — c'est la preuve que l'outil détecte bien le problème.

3. **Correction du composant.** Crée `InvitationForm.tsx` : deux `<label htmlFor>` liés à leurs `<input id>`, un `<button type="submit">` à la place du `<div onClick>`, un `aria-label` ou `aria-labelledby` sur le `<form>`. Pas d'ARIA superflu là où le HTML natif suffit.

4. **Test vert sur la version corrigée.** Dans `InvitationForm.test.tsx`, rends le composant et appelle `axe(container, { rules: { 'color-contrast': { enabled: false } } })` (JSDOM ne rend pas le CSS — justification obligatoire en commentaire). Assert `toHaveNoViolations()`.

5. **Test clavier Playwright.** Dans `tests/e2e/a11y/invitation.spec.ts`, navigue vers `/invite`, utilise `page.keyboard.press('Tab')` pour atteindre le champ Prénom, remplis-le, Tab vers Email, remplis-le, Tab vers le bouton Envoyer, active avec `Enter`. Assert qu'une confirmation est visible (`role="alert"` ou texte prévisible).

6. **Test axe Playwright.** Dans le même fichier, ajoute un test `AxeBuilder({ page }).include('#invitation-form').withTags(['wcag2a','wcag2aa']).analyze()` et filtre les violations `critical` + `serious`.

## Corrigé complet commenté

```tsx
// src/components/InvitationForm.tsx
import { useState } from 'react';

export function InvitationForm({ onInvite }: { onInvite: (email: string) => void }) {
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onInvite(email);
    setSent(true);
  }

  return (
    // aria-label sur form : pas de <legend> ou <h2> associé ici,
    // donc on nomme explicitement la region formulaire
    <form id="invitation-form" aria-label="Inviter un membre" onSubmit={handleSubmit}>

      {/* label + htmlFor + input id : association explicite, la plus robuste */}
      <label htmlFor="invite-prenom">Prénom</label>
      <input
        id="invite-prenom"
        type="text"
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
      />

      <label htmlFor="invite-email">Adresse email</label>
      <input
        id="invite-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-describedby="invite-email-hint"
      />
      {/* hint associé via aria-describedby : lu après le nom du champ sous SR */}
      <span id="invite-email-hint">Format attendu : prénom@domaine.fr</span>

      {/* <button type="submit"> : interactif nativement (Tab + Enter + Space) */}
      <button type="submit">Envoyer l'invitation</button>

      {/* role="alert" : annoncé immédiatement par le lecteur d'écran à l'apparition */}
      {sent && <p role="alert">Invitation envoyée</p>}
    </form>
  );
}
```

```tsx
// src/components/InvitationFormBroken.test.tsx
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, it, expect } from 'vitest';
import { InvitationFormBroken } from './InvitationFormBroken';

describe('InvitationFormBroken — détection violations axe', () => {
  it('détecte des violations sur la version inaccessible', async () => {
    const { container } = render(<InvitationFormBroken onInvite={() => {}} />);
    const results = await axe(container);

    // Ce test doit rester rouge tant que le composant n'est pas corrigé.
    // Il sert de régression-inverse : si l'outil ne détecte plus rien,
    // c'est qu'il est mal configuré, pas que le composant est soudainement correct.
    expect(results.violations.length).toBeGreaterThan(0);

    const ids = results.violations.map((v) => v.id);
    // 'label' : champs sans label associé — violation WCAG 1.3.1 / 4.1.2
    expect(ids).toContain('label');
  });
});
```

```tsx
// src/components/InvitationForm.test.tsx
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, it, expect } from 'vitest';
import { InvitationForm } from './InvitationForm';

describe('InvitationForm — accessibilité axe (version corrigée)', () => {
  it('ne contient aucune violation détectable par axe', async () => {
    const { container } = render(<InvitationForm onInvite={() => {}} />);

    const results = await axe(container, {
      rules: {
        // JSDOM ne rend pas le CSS → axe ne peut pas calculer les contrastes.
        // Cette règle est couverte séparément en test E2E Playwright (CSS réel).
        'color-contrast': { enabled: false },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('détecte le formulaire envoyé (état sent)', async () => {
    // Tester l'état après soumission : le role="alert" est-il présent et accessible ?
    const onInvite = vi.fn();
    const { container, getByRole } = render(<InvitationForm onInvite={onInvite} />);

    // Simuler la soumission
    const btn = getByRole('button', { name: 'Envoyer l\'invitation' });
    btn.click(); // déclenche handleSubmit (state change → "sent" = true)

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
```

```ts
// tests/e2e/a11y/invitation.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Formulaire d\'invitation TribuZen — a11y E2E', () => {
  test('navigation clavier complète', async ({ page }) => {
    await page.goto('/invite');
    await page.waitForSelector('#invitation-form');

    // Tab 1 → champ Prénom (premier élément focusable du formulaire)
    await page.keyboard.press('Tab');
    const prenomField = page.locator(':focus');
    await expect(prenomField).toHaveRole('textbox');
    await expect(prenomField).toHaveAccessibleName('Prénom');
    await prenomField.fill('Alice');

    // Tab 2 → champ Email
    await page.keyboard.press('Tab');
    const emailField = page.locator(':focus');
    await expect(emailField).toHaveRole('textbox');
    await expect(emailField).toHaveAccessibleName('Adresse email');
    await emailField.fill('alice@tribu.fr');

    // Tab 3 → bouton Envoyer (un seul Tab car le hint est non focusable)
    await page.keyboard.press('Tab');
    const submitBtn = page.locator(':focus');
    await expect(submitBtn).toHaveRole('button');
    await expect(submitBtn).toHaveAccessibleName('Envoyer l\'invitation');

    // Activation au clavier (Enter sur un button type="submit")
    await page.keyboard.press('Enter');

    // Confirmation annoncée en role="alert"
    await expect(page.getByRole('alert')).toHaveText('Invitation envoyée');
  });

  test('aucune violation critique ou sérieuse (axe Playwright)', async ({ page }) => {
    await page.goto('/invite');
    await page.waitForSelector('#invitation-form');

    // @axe-core/playwright — vrai navigateur, CSS réel, contrastes inclus
    const results = await new AxeBuilder({ page })
      .include('#invitation-form')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Stratégie CI progressive : seuls critical et serious bloquent
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (blocking.length > 0) {
      const detail = blocking
        .map((v) => `[${v.impact}] ${v.id} — ${v.description} (${v.nodes.length} nœud(s))`)
        .join('\n');
      throw new Error(`Violations bloquantes :\n${detail}`);
    }

    // Log non bloquant des moderate/minor pour information
    const nonBlocking = results.violations.filter(
      (v) => v.impact === 'moderate' || v.impact === 'minor',
    );
    if (nonBlocking.length > 0) {
      console.warn(
        'Violations non bloquantes (moderate/minor) :',
        nonBlocking.map((v) => `${v.id} [${v.impact}]`).join(', '),
      );
    }
  });
});
```

Points de validation par le coach :
- (a) le test "broken" **reste en rouge** et prouve que l'outil détecte `label` — ne pas le supprimer ;
- (b) `color-contrast` est **désactivé et commenté** avec la justification JSDOM ;
- (c) on teste aussi l'**état `sent`** — pas seulement l'état initial ;
- (d) le test clavier Playwright vérifie les **noms accessibles** (`toHaveAccessibleName`) pas seulement les rôles ;
- (e) le test axe Playwright **filtre par sévérité** avec un message d'erreur lisible ;
- (f) aucun ARIA superflu dans le composant corrigé — HTML natif en premier.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 25 min**, et ajoute deux contraintes :

1. Le formulaire doit maintenant afficher un **message d'erreur inline** si le champ Email est vide à la soumission (`aria-invalid="true"` + `aria-describedby` pointant le message). Écris un test vitest-axe qui couvre cet **état erreur** séparément (pas seulement l'état initial).
2. Ajoute un test Playwright qui vérifie que le focus revient sur le champ Email après une soumission échouée (UX clavier). Justifie à voix haute pourquoi axe-core ne peut pas détecter ce comportement automatiquement.

Bonus : identifie dans quelle catégorie WCAG (critère de succès) tombe le message d'erreur inline, et explique pourquoi axe-core peut ou ne peut pas le vérifier.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée ou corrige `src/components/InvitationForm.tsx` selon les exigences du lab.
2. Ajoute `vitest-axe` au `devDependencies` et branche `toHaveNoViolations` dans le setup Vitest existant.
3. Écris `InvitationForm.test.tsx` avec les deux cas (état initial + état sent), `color-contrast` désactivé et commenté.
4. Ajoute le test Playwright dans `tests/e2e/a11y/invitation.spec.ts` (clavier + axe Playwright).
5. Commit : `test(a11y): vitest-axe + Playwright clavier sur InvitationForm`.
6. Note dans le PR les violations détectées avant correction et celles qui restent hors périmètre auto (~30-40 % de couverture).
