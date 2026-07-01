---
titre: Tests de composants
cours: 06-testing
notions: [monter un composant en test, requêtes par rôle accessible getByRole, simuler une interaction utilisateur, tester le comportement pas l'implémentation, props et événements émis, états asynchrones dans un composant, Testing Library vs Vue Test Utils]
outcomes: [monter et interroger un composant en test, simuler une interaction et vérifier l'effet observable, tester le comportement plutôt que les détails internes]
prerequis: [06-architecture-testable]
next: 08-msw-mock-service-worker
libs: [{ name: vitest, version: ^4.1.9 }, { name: "@vue/test-utils", version: ^2 }]
tribuzen: tester le composant FamilyCard TribuZen (props famille, émission select au clic, état vide)
last-reviewed: 2026-07
---

# Tests de composants

> **Outcomes — tu sauras FAIRE :** monter et interroger un composant Vue en test sans navigateur réel, simuler une interaction utilisateur et vérifier l'effet observable, tester le comportement plutôt que les détails internes d'implémentation.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, le composant `FamilyCard` affiche une carte famille — nom, nombre de membres, bouton « Rejoindre ». Si aucune famille n'est fournie, il affiche un état vide. Un clic sur « Rejoindre » émet l'id de la famille au composant parent.

Comment prouver que ce composant fonctionne — sans ouvrir un navigateur, sans Cypress, sans screenshot ? Tu veux :

1. Vérifier que la prop `family` se reflète dans le DOM rendu.
2. Vérifier qu'un clic déclenche l'émission de l'id correct.
3. Vérifier que l'état vide s'affiche quand `family` est absent.

La réponse : **`@vue/test-utils`** — tu montes le composant dans un DOM virtuel (jsdom), interagis avec lui comme un utilisateur, et tu assertes sur ce qui est visible.

```vue
<!-- src/components/FamilyCard.vue -->
<script setup lang="ts">
export interface Family {
  id: string
  name: string
  memberCount: number
}

const props = defineProps<{ family?: Family | null }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <article v-if="props.family" aria-label="Carte famille">
    <h2>{{ props.family.name }}</h2>
    <p>{{ props.family.memberCount }} membres</p>
    <button @click="emit('select', props.family.id)">Rejoindre</button>
  </article>
  <p v-else role="status">Aucune famille disponible</p>
</template>
```

Question centrale : comment tester ces trois cas sans base de données ni navigateur réel ? La suite répond.

## 2. Théorie complète, concise

### Monter un composant en test

`mount(Component, options)` est le point d'entrée de Vue Test Utils. Il crée une application Vue en mémoire, rend le composant dans un DOM jsdom, et retourne un **wrapper** — objet qui expose des méthodes pour interagir et interroger le composant.

```ts
import { mount } from '@vue/test-utils'
import FamilyCard from './FamilyCard.vue'

const wrapper = mount(FamilyCard, {
  props: { family: { id: 'fam-1', name: 'Les Martin', memberCount: 4 } },
})
```

`mount` rend le composant **et tous ses enfants** (full mount). `shallowMount(Component)` — alias de `mount(Component, { shallow: true })` — remplace les composants enfants par des stubs. Préférer `mount` par défaut : il teste ce que l'utilisateur voit réellement et détecte les régressions dans les enfants.

Options utiles de `mount` :

| Option | Usage |
|---|---|
| `props` | Passer des props au composant |
| `slots` | Fournir du contenu aux slots |
| `global.plugins` | Injecter Pinia, Router, i18n |
| `global.stubs` | Stubber un enfant lourd précis |
| `attachTo` | Attacher au `document.body` (nécessaire pour focus/blur) |

### Requêtes par rôle accessible

Vue Test Utils expose `wrapper.find(selector)` et `wrapper.get(selector)` avec des sélecteurs CSS standard. C'est fonctionnel, mais un sélecteur CSS `.family-card__title` est **fragile** : il se casse si on renomme la classe.

La meilleure stratégie : interroger par **rôle ARIA accessible** — `wrapper.get('[role="status"]')`, `wrapper.get('button')`, `wrapper.get('h2')` — ou, avec `@testing-library/vue`, via `screen.getByRole('button', { name: /rejoindre/i })`.

**Lien RGAA :** cibler un élément par son rôle accessible (`button`, `heading`, `article`, `status`, `alert`, `progressbar`) force le composant à avoir une sémantique HTML correcte. Un test qui utilise `getByRole('button', { name: /rejoindre/i })` échoue si le bouton n'a pas de libellé accessible — il détecte les problèmes d'accessibilité avant qu'ils n'atteignent la production. Tester par rôle = auditer l'accessibilité gratuitement à chaque run CI.

Hiérarchie des sélecteurs (du plus robuste au moins) :

| Priorité | Approche | Exemple |
|---|---|---|
| 1 | Rôle accessible | `getByRole('button', { name: /rejoindre/i })` |
| 2 | Label de formulaire | `getByLabelText(/email/i)` |
| 3 | Texte visible | `getByText(/aucune famille/i)` |
| 4 | data-testid | `get('[data-testid="spinner"]')` |

### Simuler une interaction utilisateur

`trigger(eventName, options?)` déclenche un événement DOM sur un wrapper. Il retourne une **Promise** — toujours `await` pour laisser Vue mettre à jour le DOM avant d'asserter.

```ts
await wrapper.get('button').trigger('click')
await wrapper.get('input').trigger('input')
```

`setValue(value)` combine `element.value = value` + `trigger('input')` + `trigger('change')` — pratique pour les champs de formulaire :

```ts
await wrapper.get('input').setValue('alice@tribu.fr')
```

Pour simuler la frappe réelle avec focus, keydown, keyup, `@testing-library/user-event` est plus fidèle au comportement navigateur. Pour les interactions simples (clic, saisie), `trigger` de Vue Test Utils suffit.

### Tester le comportement, pas l'implémentation

La règle centrale (Kent C. Dodds) : « The more your tests resemble the way your software is used, the more confidence they can give you. »

Concrètement :

| Interdit — implémentation | Correct — comportement observable |
|---|---|
| `wrapper.vm.count` | `wrapper.get('[role="status"]').text()` |
| `wrapper.vm.handleClick()` | `await wrapper.get('button').trigger('click')` |
| `wrapper.vm.$options.methods` | `wrapper.emitted('select')` |
| `.find('.internal-class')` | `.get('[role="article"]')` ou `.get('h2')` |

Un test qui accède à `wrapper.vm` se casse à chaque refactor interne même si le comportement visible est inchangé. Un test qui interroge le DOM visible survit aux refactors internes.

### Props et événements émis

**Passer des props au montage :**

```ts
const wrapper = mount(FamilyCard, {
  props: { family: { id: 'fam-1', name: 'Les Martin', memberCount: 4 } },
})
```

**Mettre à jour les props après montage :**

```ts
await wrapper.setProps({ family: null })
// DOM mis à jour → on peut asserter l'état vide
```

**Vérifier les événements émis :** `wrapper.emitted(eventName)` retourne un tableau des appels à cet événement. Chaque entrée est un tableau des arguments passés lors de cet appel. Retourne `undefined` si l'événement n'a jamais été émis.

```ts
await wrapper.get('button').trigger('click')

// wrapper.emitted('select') = [['fam-1']] si un seul clic
expect(wrapper.emitted('select')).toHaveLength(1)          // un seul appel
expect(wrapper.emitted('select')![0]).toEqual(['fam-1'])   // args du 1er appel
expect(wrapper.emitted('select')).toBeUndefined()          // jamais émis
```

### États asynchrones dans un composant

Deux types d'asynchronisme dans les composants :

**1. Réactivité Vue** — après un `trigger` ou `setProps`, Vue met à jour le DOM de façon asynchrone via `nextTick`. Vue Test Utils retourne déjà une Promise depuis `trigger` et `setProps`, donc `await` suffit dans la grande majorité des cas :

```ts
await wrapper.get('button').trigger('click')
// DOM déjà mis à jour ici
```

**2. Promesses internes** (appel API dans `onMounted`, `setTimeout`) — il faut attendre que toutes les promesses en attente se résolvent avec `flushPromises` :

```ts
import { flushPromises } from '@vue/test-utils'

const wrapper = mount(FamilyCard, { props: { familyId: 'fam-1' } })
// Le composant lance un fetch dans onMounted — pas encore résolu
await flushPromises() // résout toutes les promesses en attente
expect(wrapper.get('h2').text()).toBe('Les Martin')
```

Pour asserter sur un élément qui **apparaît** après un délai, `@testing-library/vue` expose `findByRole(...)` — une Promise qui retente automatiquement jusqu'à ce que l'élément existe (avec timeout configurable).

### Testing Library vs Vue Test Utils

Ces deux outils ont des philosophies différentes et peuvent cohabiter :

| Critère | Vue Test Utils | @testing-library/vue |
|---|---|---|
| Approche | API orientée composant (`wrapper`) | API orientée DOM (`screen`) |
| Requêtes | CSS selectors, `.vm` accessible | `getByRole`, `findByText`, accessibilité first |
| Interactions | `trigger('click')`, `setValue` | `userEvent.click()`, `userEvent.type()` (plus fidèle) |
| Async | `flushPromises`, `await trigger` | `findBy*` avec retry automatique |
| Emits Vue | `wrapper.emitted('select')` | Callback prop mocké (`vi.fn()`) |
| Slots | `slots: { default: '...' }` | JSX dans `render()` |
| Shallow | `shallowMount` / `{ shallow: true }` | Non recommandé |
| Idéal pour | Emits, slots, v-model, lifecycle Vue | Tests orientés accessibilité, comportement utilisateur |

En pratique, les deux s'installent ensemble et partagent le même jsdom : Vue Test Utils gère les spécificités Vue (`emitted`, slots, `setProps`), Testing Library fournit des requêtes `getByRole` ergonomiques et AccessibilityTree-aware.

## 3. Worked examples

### Exemple A — Props, texte visible et état vide

Objectif : prouver que `FamilyCard` affiche les bonnes données selon la prop `family`, et bascule vers l'état vide quand elle est absente.

```ts
// src/components/FamilyCard.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FamilyCard from './FamilyCard.vue'

const mockFamily = { id: 'fam-1', name: 'Les Martin', memberCount: 4 }

describe('FamilyCard — affichage', () => {
  it('affiche le nom et le nombre de membres quand family est fournie', () => {
    const wrapper = mount(FamilyCard, {
      props: { family: mockFamily },
    })

    // .get() throw immédiatement si l'élément est absent — fail rapide et message clair
    expect(wrapper.get('h2').text()).toBe('Les Martin')
    // .text() sur le wrapper racine inclut tout le texte rendu dans le composant
    expect(wrapper.text()).toContain('4 membres')
    expect(wrapper.get('button').text()).toBe('Rejoindre')
  })

  it('affiche l\'état vide quand family est absent', () => {
    const wrapper = mount(FamilyCard)

    // role="status" annonce l'état vide aux technologies d'assistance (RGAA)
    expect(wrapper.get('[role="status"]').text()).toBe('Aucune famille disponible')
    // .find().exists() pour asserter l'ABSENCE sans throw
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('article').exists()).toBe(false)
  })

  it('bascule vers l\'état vide après setProps', async () => {
    const wrapper = mount(FamilyCard, { props: { family: mockFamily } })

    // setProps met à jour la prop ET attend le nextTick — toujours await
    await wrapper.setProps({ family: null })

    expect(wrapper.find('h2').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('Aucune famille')
  })
})
```

Pas-à-pas : (1) `mount` avec `props` injecte les données sans backend ni store ; (2) `.get('h2')` throw si absent — préférable à `.find().text()` silencieux ; (3) `.find(...).exists()` pour asserter l'absence sans lever d'erreur ; (4) `setProps` + `await` pour tester la transition d'état réactive.

### Exemple B — Émission d'événement au clic

Objectif : prouver que cliquer sur « Rejoindre » émet `select` avec le bon id, et qu'en état vide aucune émission n'est possible.

```ts
describe('FamilyCard — émission', () => {
  it('émet select avec l\'id famille au clic sur Rejoindre', async () => {
    const wrapper = mount(FamilyCard, {
      props: { family: mockFamily },
    })

    // trigger retourne une Promise résolue après nextTick → toujours await
    await wrapper.get('button').trigger('click')

    // wrapper.emitted('select') = [['fam-1']] pour un seul clic
    // Structure : tableau d'appels, chaque appel est un tableau d'arguments
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')![0]).toEqual(['fam-1'])
  })

  it('n\'émet rien si family est absent — le bouton n\'existe pas', () => {
    const wrapper = mount(FamilyCard)

    // emitted() retourne undefined si l'événement n'a jamais été émis
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('émet select à chaque clic (double clic = deux émissions)', async () => {
    const wrapper = mount(FamilyCard, { props: { family: mockFamily } })

    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('click')

    // Deux appels enregistrés
    expect(wrapper.emitted('select')).toHaveLength(2)
    expect(wrapper.emitted('select')![1]).toEqual(['fam-1'])
  })
})
```

Pas-à-pas : (1) `trigger('click')` est `await`-é — après cette ligne le DOM et les émissions sont à jour ; (2) `wrapper.emitted('select')![0]` — le `!` dit à TypeScript que ce n'est pas `undefined` (on vient de vérifier `toHaveLength(1)`) ; (3) `toBeUndefined()` pour l'état vide confirme qu'aucune émission n'a eu lieu ; (4) deux clics successifs = deux entrées dans le tableau `emitted`.

## 4. Pièges & misconceptions

- **Accéder à `wrapper.vm` (tester l'implémentation).** `expect(wrapper.vm.isSelected).toBe(false)` se casse au premier refactor interne même si le comportement visible n'a pas changé. *Correct* : asserter sur le DOM — `expect(wrapper.find('[aria-selected="true"]').exists()).toBe(false)`. L'accès à `wrapper.vm` n'est acceptable qu'en dernier recours pour une valeur sans représentation DOM.

- **Sélecteurs CSS fragiles.** `wrapper.get('.family-card__title')` se brise si on renomme la classe BEM ou change la structure interne. *Correct* : cibler par sémantique — `wrapper.get('h2')`, `wrapper.get('[role="status"]')`, ou avec `@testing-library/vue` : `screen.getByRole('heading', { name: /les martin/i })`. Bonus RGAA : un sélecteur par rôle qui échoue signale une régression d'accessibilité.

- **Oublier `await` sur `trigger` et `setProps`.** Sans `await`, l'assertion s'exécute avant que Vue ait mis à jour le DOM via `nextTick`. *Symptôme* : le test passe dans un sens mais échoue de façon aléatoire, ou passe toujours parce que la réactivité est synchrone dans ce cas précis. *Correct* : `await wrapper.get('button').trigger('click')` — `trigger` retourne une Promise résolue après `nextTick`.

- **Confondre `find` et `get`.** `wrapper.find(sel)` retourne un `ErrorWrapper` silencieux quand l'élément est absent — appeler `.text()` dessus retourne `''` sans erreur, masquant le bug. `wrapper.get(sel)` lève une erreur immédiate avec un message clair si l'élément est introuvable. *Règle* : `get` pour asserter la **présence** (fail rapide) ; `find().exists()` pour asserter l'**absence** sans throw.

- **Oublier `flushPromises` pour l'async interne.** Si le composant fait un appel API dans `onMounted`, `mount(...)` retourne avant que la promesse soit résolue. `await trigger(...)` ne résout que la réactivité Vue, pas les promesses applicatives. *Correct* : `await flushPromises()` après le montage pour résoudre toutes les promesses en attente avant d'asserter sur le contenu chargé.

## 5. Ancrage TribuZen

Couche fil-rouge : **tester le composant `FamilyCard` TribuZen — props famille, émission `select` au clic, état vide** (`smaurier/tribuzen`).

En session de travail concret :

- `FamilyCard.vue` est le premier composant Vue de l'interface TribuZen. Il reçoit une prop `family` (type `Family` — id, nom, nombre de membres) et émet `select` quand l'utilisateur clique « Rejoindre ».
- Les trois cas à couvrir — données visibles, état vide, émission — correspondent directement aux comportements que l'utilisateur final expérimente.
- Le `role="status"` sur l'état vide est un choix sémantique RGAA : l'attribut annonce l'état vide aux lecteurs d'écran. Le test qui cible `[role="status"]` échoue si cet attribut est absent — c'est une exigence d'accessibilité automatiquement vérifiée à chaque run CI.
- La liste des familles (`FamilyList.vue`) passera plus tard en test d'intégration avec Pinia — `FamilyCard` isolé se teste parfaitement ici, sans store, grâce à la DI par props.

## 6. Points clés

1. `mount(Component, { props })` monte le composant dans jsdom et retourne un `VueWrapper` pour interagir et asserter — `shallowMount` stubbe les enfants, mais `mount` est recommandé par défaut.
2. `wrapper.get(sel)` throw si l'élément est absent (fail rapide et message clair) ; `wrapper.find(sel).exists()` pour asserter l'absence sans throw.
3. Cibler par rôle ARIA (`[role="status"]`, `button`, `h2`) rend les tests robustes aux refactors CSS et aligne avec le RGAA — sélecteur fragile = classe CSS interne.
4. `trigger(eventName)` retourne une Promise — toujours `await` pour avoir le DOM à jour avant d'asserter.
5. `wrapper.emitted('select')` retourne `[['fam-1']]` pour un seul clic avec l'id `'fam-1'` ; `undefined` si l'événement n'a jamais été émis.
6. `setProps({ ... })` met à jour les props après montage et attend le `nextTick` — `await` obligatoire.
7. `await flushPromises()` résout toutes les promesses JS en attente dans le composant (appels API `onMounted`, `setTimeout`) — distinct de `await trigger` qui ne couvre que la réactivité Vue.
8. Vue Test Utils est idéal pour les spécificités Vue (`emitted`, `slots`, `setProps`, `vm`) ; Testing Library (`@testing-library/vue`) complète avec des requêtes `getByRole` ergonomiques et AccessibilityTree-aware — les deux cohabitent sur le même jsdom.

## 7. Seeds Anki

```
Quelle fonction de @vue/test-utils monte un composant Vue dans jsdom ?|mount(Component, { props, slots, global }) — retourne un VueWrapper
Différence entre wrapper.get() et wrapper.find() ?|get() throw si l'élément est absent (fail rapide) ; find() retourne un ErrorWrapper silencieux — utiliser find().exists() pour asserter l'absence
Comment vérifier qu'un composant a émis select avec l'id fam-1 ?|expect(wrapper.emitted('select')![0]).toEqual(['fam-1'])
Pourquoi await est obligatoire après trigger() et setProps() ?|Ces méthodes retournent une Promise résolue après le nextTick de Vue — sans await on asserterait avant que le DOM soit mis à jour
Qu'est-ce que flushPromises() résout ?|Toutes les promesses JS en attente dans le composant (fetch onMounted, setTimeout) — trigger seul ne suffit pas pour l'async interne
Pourquoi cibler par rôle accessible plutôt que par classe CSS ?|Le rôle est stable aux refactors internes et force une sémantique HTML correcte — bonus RGAA : un test getByRole détecte les régressions d'accessibilité gratuitement
Différence entre mount et shallowMount ?|mount rend le composant ET ses enfants (full, recommandé) ; shallowMount remplace les enfants par des stubs (isolation maximale, moins de fidélité)
Que retourne wrapper.emitted('select') si l'événement n'a jamais été émis ?|undefined — utiliser toBeUndefined() pour asserter l'absence d'émission
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-07-tests-composants/`. Tu y montes `FamilyCard` en **Vitest + @vue/test-utils réels**, testes les trois cas (props, état vide, émission au clic) et gères l'async avec `flushPromises`. Corrigé complet commenté + variante J+30 dans le README du lab.
