---
titre: Tests d'accessibilité
cours: 06-testing
notions: [axe-core et automatisation, vitest-axe et jest-axe, limites de l'audit automatique 30-40 pourcent, tests clavier et lecteur d'écran, addon a11y et Playwright axe, intégration CI, lien avec RGAA et WCAG]
outcomes: [automatiser des tests d'accessibilité avec axe-core dans Vitest, connaître les limites de l'audit automatique, compléter par des tests clavier manuels, intégrer les tests a11y en CI]
prerequis: [12-couverture-et-mutation-testing]
next: 13-tests-en-ci-cd
libs: [{ name: vitest, version: ^4.1.9 }, { name: "@testing-library/vue", version: ^8 }, { name: "vitest-axe", version: ^4 }, { name: axe-core, version: ^4 }]
tribuzen: tester l'accessibilité des composants TribuZen (vitest-axe) + audit manuel des parcours clés
last-reviewed: 2026-07
---

# Tests d'accessibilité

> **Outcomes — tu sauras FAIRE :** automatiser des tests d'accessibilité avec axe-core dans Vitest, connaître les limites réelles de l'audit automatique (~30-40 %), compléter par des tests clavier ciblés, intégrer les vérifications a11y en CI sans faux positifs.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen comporte un formulaire d'invitation qui demande un prénom et un email. Un membre de l'équipe le livre rapidement :

```vue
<!-- src/components/InvitationForm.vue — tel que livré (INACCESSIBLE) -->
<template>
  <div>
    <input type="text" placeholder="Prénom" />
    <input type="email" placeholder="Email" />
    <div @click="onInvite('...')">Envoyer l'invitation</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ onInvite: (email: string) => void }>()
</script>
```

Trois violations immédiates : pas de `<label>` associé aux champs, un `<div @click>` non accessible au clavier, pas de rôle sémantique sur la zone. Un utilisateur naviguant au clavier ou sous NVDA ne peut pas remplir ce formulaire.

Question centrale : comment **détecter automatiquement** ces violations dès la PR, **quantifier ce que l'outil ne peut pas voir**, et organiser les tests clavier qu'aucun outil ne remplacera ?

## 2. Théorie complète, concise

### axe-core — le moteur

**axe-core** (Deque Labs, open source) est le moteur de règles d'accessibilité le plus utilisé dans l'écosystème. Il analyse le DOM et retourne des violations classées par `impact` : `critical`, `serious`, `moderate`, `minor`. Chaque violation pointe les nœuds incriminés, la règle violée (ex. `label`, `button-name`), et une description.

axe-core teste un **sous-ensemble des critères WCAG** — uniquement ceux vérifiables algorithmiquement sur le DOM. Il ne "passe pas un audit RGAA" et ne "vérifie pas WCAG" au sens complet. Voir la distinction WCAG/RGAA ci-dessous.

```ts
import axe from 'axe-core';

// API bas niveau (rarement utilisée directement)
const results = await axe.run(containerElement);
// results.violations : tableau de violations avec impact, id, nodes
```

### vitest-axe et jest-axe — l'intégration dans les tests unitaires

**vitest-axe** et **jest-axe** exposent tous les deux le matcher `toHaveNoViolations` et la fonction `axe()` wrappée pour fonctionner dans JSDOM (l'environnement de Vitest/Jest). La différence est mineure : `vitest-axe` est conçu pour Vitest natif, `jest-axe` fonctionne aussi avec Vitest via `expect.extend`.

Installation (Vitest) :

```bash
pnpm add -D vitest-axe axe-core
```

Setup global dans `vitest.config.ts` :

```ts
export default defineConfig({
  test: {
    setupFiles: ['./tests/setup-a11y.ts'],
    environment: 'jsdom',
  },
});
```

```ts
// tests/setup-a11y.ts
import { expect } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe';

expect.extend({ toHaveNoViolations });
```

Utilisation dans un test :

```ts
import { render } from '@testing-library/vue';
import { axe } from 'vitest-axe';
import { describe, it, expect } from 'vitest';
import InvitationForm from './InvitationForm.vue';

describe('InvitationForm a11y', () => {
  it('ne doit avoir aucune violation axe détectable', async () => {
    const { container } = render(InvitationForm, { props: { onInvite: () => {} } });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

`toHaveNoViolations` produit un message d'erreur lisible qui liste les violations, leur impact, et les sélecteurs CSS des nœuds incriminés.

### Limites de l'audit automatique — ~30-40 %

C'est le chiffre à **retenir et à répéter** : les outils automatiques (axe-core, Lighthouse, IBM Equal Access…) détectent environ **30 à 40 % des violations WCAG réelles** d'une interface. Ce consensus vient de plusieurs études convergentes (WebAIM, Deque, GDS UK). Il varie selon la complexité de l'application, mais l'ordre de grandeur est stable.

Ce que l'automatisation détecte fiablement :
- Absence de `<label>` ou `aria-labelledby`
- `<img>` sans `alt`
- Hiérarchie de titres sautée (`h1` → `h3`)
- Rôles ARIA invalides ou attributs manquants (`aria-*` non supportés)
- Éléments interactifs sans nom accessible
- Contrastes de couleur insuffisants (seulement avec vrai CSS — pas en JSDOM)

Ce que l'automatisation **ne peut pas détecter** :
- La pertinence d'un texte alternatif (`alt="image"` = présent mais inutile)
- L'ordre logique de lecture (séquence de focus cohérente avec la lecture)
- Le comportement d'une modale sous lecteur d'écran (annonces, piège de focus)
- La compréhension d'un parcours multi-étapes sous NVDA/VoiceOver
- Les animations et réduction de mouvement perçues

Ces 60-70 % restants nécessitent des **tests clavier manuels** et un **audit sous lecteur d'écran**.

### Tests clavier — la couche manuelle incontournable

Un test clavier vérifie la navigabilité sans souris. Les interactions fondamentales à couvrir :

| Touche | Comportement attendu |
|--------|---------------------|
| `Tab` | Avance vers le prochain élément focusable, ordre logique |
| `Shift+Tab` | Recule vers l'élément précédent |
| `Enter` / `Space` | Active le bouton ou le lien focalisé |
| `Escape` | Ferme une modale, abandonne une action |
| `Flèches` | Navigation dans les composants riches (menu, slider, tabs) |

Points à vérifier manuellement :
- Le focus est **visible** (outline CSS présent, non supprimé globalement)
- Le **skip link** ("Aller au contenu") est le premier élément tabulable
- Une **modale ouverte piège le focus** (Tab ne sort pas) et le restaure à la fermeture
- Aucun élément interactif n'est skippé ou inatteignable

Playwright permet d'**automatiser une partie** de ces vérifications :

```ts
import { test, expect } from '@playwright/test';

test('le formulaire d\'invitation est navigable au clavier', async ({ page }) => {
  await page.goto('/invite');

  // Premier Tab : le premier champ doit recevoir le focus
  await page.keyboard.press('Tab');
  const firstFocused = page.locator(':focus');
  await expect(firstFocused).toHaveRole('textbox');
  await expect(firstFocused).toHaveAccessibleName('Prénom');

  // Remplissage clavier
  await firstFocused.fill('Alice');
  await page.keyboard.press('Tab');
  await page.locator(':focus').fill('alice@tribu.fr');

  // Tab vers le bouton et activation
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveRole('button');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Invitation envoyée');
});
```

### Lecteur d'écran — non automatisable en CI

Les lecteurs d'écran (NVDA/Windows, VoiceOver/macOS, TalkBack/Android) interagissent avec l'**arbre d'accessibilité** du navigateur, pas directement le DOM. Leurs comportements varient selon la combinaison SR+navigateur. Il n'existe pas de lecteur d'écran headless fiable pour la CI.

En pratique : tester les parcours critiques (connexion, invitation, messagerie) sous NVDA+Firefox ou VoiceOver+Safari lors des jalons de livraison, pas à chaque PR.

### `@axe-core/playwright` — axe dans un vrai navigateur

En JSDOM, le CSS n'est pas rendu — axe-core ne peut donc pas vérifier les contrastes. `@axe-core/playwright` exécute axe-core dans un vrai navigateur Chromium/Firefox, avec le CSS réel.

```bash
pnpm add -D @axe-core/playwright
```

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibilité TribuZen', () => {
  test('page d\'invitation — WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/invite');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('scanner seulement le formulaire d\'invitation', async ({ page }) => {
    await page.goto('/invite');

    const results = await new AxeBuilder({ page })
      .include('#invitation-form')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```

Storybook propose son propre `@storybook/addon-a11y` — même moteur axe-core, mais dans l'environnement Storybook. Utile pour un audit composant par composant en développement, pas pour la CI de production.

### Intégration CI

Stratégie en deux niveaux : les tests vitest-axe (JSDOM, rapides) bloquent la PR ; les tests Playwright axe (navigateur réel) tournent en post-merge ou sur une branche dédiée.

```yaml
# .github/workflows/a11y.yml
name: Tests a11y

on: [push, pull_request]

jobs:
  unit-a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install
      - run: pnpm vitest run --reporter=verbose

  e2e-a11y:
    runs-on: ubuntu-latest
    needs: unit-a11y
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install
      - run: pnpm playwright install --with-deps chromium
      - run: pnpm build && pnpm preview &
      - run: npx wait-on http://localhost:4173
      - run: pnpm playwright test tests/e2e/a11y/
```

Filtrer par sévérité pour éviter de bloquer sur du `minor` :

```ts
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa'])
  .analyze();

// Seulement critical et serious bloquent la CI
const blocking = results.violations.filter(
  (v) => v.impact === 'critical' || v.impact === 'serious',
);
expect(blocking).toHaveLength(0);
```

### WCAG, RGAA, axe-core — trois choses distinctes

C'est le point d'exactitude le plus important de ce module. Ne jamais les confondre :

| | Qu'est-ce que c'est ? | Qui le produit ? | Ce que ça fait |
|---|---|---|---|
| **WCAG** | Norme internationale (Web Content Accessibility Guidelines) | W3C | Définit des critères de succès organisés en niveaux A / AA / AAA |
| **RGAA** | Référentiel Général d'Amélioration de l'Accessibilité | DINUM (France) | Traduit WCAG 2.1 en 106 critères + tests concrets. Un audit RGAA est **manuel et méthodologique** |
| **axe-core** | Outil logiciel open source | Deque Labs | Exécute des règles automatiques sur le DOM. Couvre un **sous-ensemble de critères WCAG** détectables algorithmiquement |

axe-core détecte des **violations de critères WCAG** (pas "des critères RGAA"). Un audit RGAA complet reste une démarche manuelle encadrée par la méthode DINUM — passer axe-core à zéro violation ne signifie pas qu'une application est conforme RGAA.

Le tag `wcag2aa` dans axe-core sélectionne les règles taggées par axe selon leur correspondance WCAG 2.0 AA — pas la totalité des critères WCAG 2.0 AA (seulement ceux qu'axe peut vérifier).

## 3. Worked examples

### Exemple A — vitest-axe sur InvitationForm TribuZen (détecter puis corriger)

Objectif : prouver que le formulaire livré viole des règles axe, puis vérifier que la version corrigée les passe.

```ts
// src/components/InvitationForm.test.ts
import { render } from '@testing-library/vue';
import { axe } from 'vitest-axe';
import { describe, it, expect } from 'vitest';
import InvitationFormBroken from './InvitationFormBroken.vue';
import InvitationForm from './InvitationForm.vue';

describe('InvitationForm — accessibilité axe', () => {
  it('DÉTECTE des violations sur la version inaccessible', async () => {
    const { container } = render(InvitationFormBroken, { props: { onInvite: () => {} } });
    const results = await axe(container);
    // On s'attend à des violations : labels manquants, div cliquable
    expect(results.violations.length).toBeGreaterThan(0);
    // On peut inspecter ce qu'axe a trouvé :
    const ids = results.violations.map((v) => v.id);
    expect(ids).toContain('label'); // champ sans label associé
  });

  it('PASSE sans violation sur la version corrigée', async () => {
    const { container } = render(InvitationForm, { props: { onInvite: () => {} } });
    // En JSDOM, color-contrast ne peut pas être calculé (pas de CSS rendu)
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
```

```vue
<!-- src/components/InvitationForm.vue — VERSION CORRIGÉE -->
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ onInvite: (email: string) => void }>()
const prenom = ref('')
const email = ref('')
</script>

<template>
  <form
    id="invitation-form"
    aria-label="Inviter un membre"
    @submit.prevent="props.onInvite(email)"
  >
    <!-- label lié par for ↔ id (attribut HTML natif, pas htmlFor) -->
    <label for="invite-prenom">Prénom</label>
    <input
      id="invite-prenom"
      type="text"
      v-model="prenom"
    />

    <label for="invite-email">Adresse email</label>
    <input
      id="invite-email"
      type="email"
      v-model="email"
      aria-describedby="invite-email-hint"
    />
    <span id="invite-email-hint">Format attendu : prénom@domaine.fr</span>

    <!-- button type="submit" = interactif au clavier nativement -->
    <button type="submit">Envoyer l'invitation</button>
  </form>
</template>
```

Pas-à-pas : (1) le test "broken" prouve que l'outil détecte bien la violation `label` — il ne faut pas supprimer ce test, il sert de régression-inverse ; (2) `color-contrast: { enabled: false }` est justifié en JSDOM où le CSS n'est jamais rendu — on le note explicitement pour ne pas laisser croire qu'on ignore les contrastes ; (3) la correction utilise uniquement du HTML sémantique natif (`<label for>`, `<button type="submit">`) sans ARIA superflu — la première règle ARIA est « ne pas l'utiliser si le HTML natif suffit ».

### Exemple B — `@axe-core/playwright` sur la page d'invitation (vrai navigateur)

```ts
// tests/e2e/a11y/invitation.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Page d\'invitation TribuZen — a11y E2E', () => {
  test('aucune violation WCAG 2.1 AA (critical + serious)', async ({ page }) => {
    await page.goto('/invite');
    // Attendre que le composant soit interactif
    await page.waitForSelector('#invitation-form');

    const results = await new AxeBuilder({ page })
      .include('#invitation-form')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // On bloque sur critical/serious, on log les moderate/minor sans bloquer
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    if (blocking.length > 0) {
      const detail = blocking
        .map((v) => `[${v.impact}] ${v.id} — ${v.description} (${v.nodes.length} nœud(s))`)
        .join('\n');
      throw new Error(`Violations bloquantes :\n${detail}`);
    }
  });

  test('le champ email a un nom accessible et un hint', async ({ page }) => {
    await page.goto('/invite');
    const emailField = page.getByRole('textbox', { name: 'Adresse email' });
    await expect(emailField).toBeVisible();
    // Playwright vérifie le nom accessible calculé (pas juste l'attribut aria-label)
    await expect(emailField).toHaveAccessibleName('Adresse email');
  });
});
```

Différence clé avec l'exemple A : ici le CSS est chargé, donc axe-core vérifie aussi les contrastes — aucune règle désactivée par défaut.

## 4. Pièges & misconceptions

- **Croire que zéro violation axe = composant accessible.** axe-core ne détecte que ~30-40 % des violations WCAG réelles. Un formulaire peut passer axe à 100 % et rester illisible sous NVDA parce que les annonces live region sont absentes ou que l'ordre de lecture est incohérent. Correct : traiter l'auto comme le premier filet, pas le seul.

- **Tester le composant dans son état initial seulement.** Un champ de saisie vide avec validation peut passer axe. Le même champ en erreur (`aria-invalid="true"` sans `aria-describedby` pointant le message d'erreur) viole les critères WCAG 1.3.1 et 3.3.1. Correct : tester aussi les états — erreur, désactivé, chargement, modale ouverte.

- **Désactiver `color-contrast` en JSDOM et l'oublier.** Justifié techniquement (pas de CSS), mais si on ne le couvre jamais en E2E Playwright (vrai navigateur), les contrastes insuffisants ne seront jamais détectés. Correct : désactiver en unit/JSDOM, activer en E2E.

- **Ignorer le clavier au profit de l'auto seul.** axe-core ne navigue pas au clavier : il ne peut pas détecter qu'un `<div tabindex="0">` ne répond pas à `Enter`, qu'un trap de focus est cassé, ou que l'ordre de Tab est illogique. Correct : compléter par des tests Playwright clavier sur les parcours critiques.

- **Confondre « conforme RGAA » et « zéro violation axe ».** Dire qu'une application "est RGAA" parce qu'axe-core renvoie zero violations est une erreur de communication grave (surtout vis-à-vis d'un client public). Correct : axe-core réduit la surface de risque sur les critères WCAG vérifiables automatiquement ; la conformité RGAA requiert un audit méthodologique complet selon la grille DINUM.

- **Utiliser `results.violations` sans lire les `incomplete`.** axe-core retourne aussi `results.incomplete` — les règles qu'il n'a pas pu trancher (résultat indéterminé). En ignorer le contenu revient à ignorer des avertissements potentiellement critiques. Correct : logguer `incomplete` en mode verbose et investiguer les cas ambigus manuellement.

## 5. Ancrage TribuZen

Couche fil-rouge : **tester l'accessibilité des composants TribuZen (vitest-axe) + audit manuel des parcours clés** (`smaurier/tribuzen`).

- **`InvitationForm`** : premier composant à couvrir avec vitest-axe. Test double : broken vs corrected. Le lab reproduit exactement ce flux.
- **`FamilyMemberCard`** (carte d'un membre) : composant riche avec menu contextuel — tester les états fermé et ouvert séparément, vérifier que l'état ouvert piège le focus.
- **Parcours clé #1 — invitation** : test Playwright clavier complet (Tab sur les champs, Enter sur le bouton, feedback de confirmation audible via `role="alert"`).
- **Parcours clé #2 — connexion** : même stratégie. La modale de 2FA doit piéger le focus, s'annoncer comme `role="dialog"` avec `aria-labelledby`.
- **CI TribuZen** : vitest-axe dans `pnpm test` (déjà configuré) ; Playwright axe dans un job séparé déclenché sur push main.

## 6. Points clés

1. axe-core est un **outil** qui teste un sous-ensemble de critères WCAG automatisables — ne pas le confondre avec WCAG (norme W3C) ni RGAA (méthodologie française basée sur WCAG).
2. Les outils automatiques détectent **~30-40 % des violations WCAG** réelles — ce chiffre est une borne haute et non un plancher.
3. `vitest-axe` expose `toHaveNoViolations()` ; s'installer avec `axe-core` en dépendance pair ; désactiver `color-contrast` en JSDOM (pas de CSS rendu).
4. Tester tous les **états** du composant — initial, erreur, désactivé, chargement — pas seulement l'état vide.
5. `@axe-core/playwright` exécute axe dans un vrai navigateur avec CSS réel — contrastes inclus ; filtrer par `impact` pour ne bloquer la CI que sur `critical` et `serious`.
6. Les **tests clavier** (Tab, Enter, Escape, piège de focus des modales) couvrent des violations que l'automatisation ne peut pas détecter — Playwright les automatise partiellement.
7. Les **lecteurs d'écran** (NVDA, VoiceOver) ne sont pas automatisables en CI ; tester sur les jalons de livraison des parcours critiques.
8. En CI : vitest-axe en job PR (rapide, bloquant) ; Playwright axe en job post-merge ou nightly (navigateur réel, plus lent).

## 7. Seeds Anki

```
Que détecte axe-core et que ne détecte-t-il pas ?|Il détecte les violations WCAG vérifiables algorithmiquement sur le DOM (labels manquants, rôles ARIA invalides, contrastes insuffisants avec CSS). Il ne détecte pas la pertinence d'un alt, l'ordre de lecture logique, le comportement sous lecteur d'écran.
Quel pourcentage des violations WCAG est détectable automatiquement ?|Environ 30 à 40 % — les 60-70 % restants nécessitent des tests clavier et un audit sous lecteur d'écran.
Différence entre axe-core, WCAG et RGAA ?|axe-core = outil Deque Labs qui exécute des règles automatiques sur le DOM. WCAG = norme W3C internationale. RGAA = méthodologie française (DINUM) de mise en œuvre de WCAG, avec audit complet manuel.
Pourquoi désactiver color-contrast en JSDOM ?|JSDOM ne rend pas le CSS ; axe-core ne peut pas calculer les contrastes réels. La règle doit être couverte en tests E2E Playwright avec un vrai navigateur.
Comment tester l'accessibilité avec vitest-axe ?|pnpm add -D vitest-axe axe-core ; dans setup : expect.extend({ toHaveNoViolations }) ; dans le test : const results = await axe(container) ; expect(results).toHaveNoViolations()
À quoi sert @axe-core/playwright ?|Exécuter axe-core dans un vrai navigateur (Chromium/Firefox) via Playwright — avec CSS réel, contrastes inclus. new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze()
Pourquoi tester les états erreur et désactivé séparément ?|Un composant accessible à l'état initial peut violer WCAG en état erreur (aria-invalid sans aria-describedby) ou désactivé (focus perdu). L'auto ne teste que ce qu'il voit au moment du rendu.
Quel est le piège de dire qu'une app est conforme RGAA parce qu'axe renvoie zéro violation ?|axe-core ne couvre que les critères WCAG automatisables (~30-40 %). La conformité RGAA est un audit méthodologique complet (106 critères DINUM). C'est une affirmation fausse et potentiellement engageante contractuellement.
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-12b-tests-accessibilite/`. Tu y écris en **vitest-axe réel** les tests sur l'`InvitationForm` TribuZen (version cassée → correction → passage), puis un test Playwright clavier sur le parcours d'invitation. Corrigé complet commenté + variante J+30 dans le README.
