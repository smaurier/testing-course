# Lab 07 — Tests de composants

> **Outcome :** à la fin, tu sais monter un composant Vue en test avec `@vue/test-utils`, interroger le DOM par rôle accessible, simuler un clic et vérifier l'émission, et gérer l'async avec `flushPromises` — en **Vitest + @vue/test-utils réels**.
> **Vrai outil :** Vitest + `@vue/test-utils` v2. Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Code de départ — le composant `FamilyCard.vue` (déjà fourni, **ne le modifie pas** — tu écris les tests) :

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

Ta mission : écrire `FamilyCard.test.ts` qui couvre les trois comportements du composant — **sans navigateur, sans backend**.

## Étapes (en friction)

1. **Montage avec props.** Crée un `mockFamily` (`{ id: 'fam-1', name: 'Les Martin', memberCount: 4 }`). Monte `FamilyCard` avec cette prop. Vérifie que `h2` contient `'Les Martin'` et que le texte `'4 membres'` est présent.
2. **État vide.** Monte `FamilyCard` sans prop `family`. Vérifie que `[role="status"]` contient `'Aucune famille disponible'` et que le bouton n'existe pas (`find('button').exists() === false`).
3. **Émission au clic.** Monte avec `mockFamily`. `await trigger('click')` sur le bouton. Assert que `wrapper.emitted('select')` a une entrée et que son premier appel est `['fam-1']`.
4. **setProps + transition d'état.** Après le montage avec `mockFamily`, `await wrapper.setProps({ family: null })`. Assert que le `h2` disparaît et que l'état vide s'affiche.
5. **Async interne.** Monte le composant, appelle `await flushPromises()`, et vérifie que le DOM est cohérent. (Cf. le corrigé pour le pattern complet avec un composant qui charge ses données en interne.)

Contrainte : **n'accède pas à `wrapper.vm`** — tout doit passer par le DOM observable.

## Corrigé complet commenté

```ts
// src/components/FamilyCard.test.ts
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FamilyCard from './FamilyCard.vue'

// Donnée de test réutilisable — définie une seule fois en tête de fichier
const mockFamily = { id: 'fam-1', name: 'Les Martin', memberCount: 4 }

describe('FamilyCard', () => {
  // ── Étape 1 : affichage des données famille ────────────────────────────────
  it('affiche le nom et le nombre de membres quand family est fournie', () => {
    const wrapper = mount(FamilyCard, {
      props: { family: mockFamily },
    })

    // .get() throw immédiatement si l'élément est absent — fail rapide, message clair
    expect(wrapper.get('h2').text()).toBe('Les Martin')
    // .text() sur le wrapper racine inclut tout le texte rendu dans le composant
    expect(wrapper.text()).toContain('4 membres')
    expect(wrapper.get('button').text()).toBe('Rejoindre')
  })

  // ── Étape 2 : état vide ───────────────────────────────────────────────────
  it('affiche l\'état vide quand family est absent', () => {
    const wrapper = mount(FamilyCard) // pas de prop family

    // role="status" annonce l'état vide aux technologies d'assistance (RGAA)
    // Si cet attribut est absent du composant, ce test échoue → régression RGAA détectée
    expect(wrapper.get('[role="status"]').text()).toBe('Aucune famille disponible')
    // .find().exists() = false pour asserter l'ABSENCE sans throw
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('article').exists()).toBe(false)
  })

  // ── Étape 3 : émission au clic ────────────────────────────────────────────
  it('émet select avec l\'id famille au clic sur Rejoindre', async () => {
    const wrapper = mount(FamilyCard, {
      props: { family: mockFamily },
    })

    // trigger retourne une Promise résolue après le nextTick de Vue
    // → toujours await pour que le DOM et les émissions soient à jour
    await wrapper.get('button').trigger('click')

    // wrapper.emitted('select') = [['fam-1']] pour un seul clic
    // Structure : tableau d'appels, chaque appel = tableau d'arguments
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')![0]).toEqual(['fam-1'])
    // Le ! dit à TypeScript que ce n'est pas undefined (on vient de vérifier toHaveLength)
  })

  it('n\'émet rien si family est absent (le bouton n\'existe pas)', () => {
    const wrapper = mount(FamilyCard)

    // wrapper.emitted('eventName') retourne undefined si l'événement n'a jamais été émis
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  // ── Étape 4 : setProps + transition d'état ────────────────────────────────
  it('bascule vers l\'état vide après setProps({ family: null })', async () => {
    const wrapper = mount(FamilyCard, { props: { family: mockFamily } })

    // setProps met à jour la prop ET attend le nextTick de Vue — await obligatoire
    await wrapper.setProps({ family: null })

    // L'article avec les données a disparu
    expect(wrapper.find('h2').exists()).toBe(false)
    // L'état vide est maintenant affiché
    expect(wrapper.get('[role="status"]').text()).toContain('Aucune famille')
  })

  // ── Étape 5 : async interne avec flushPromises ────────────────────────────
  it('affiche les données après résolution de la promesse interne', async () => {
    // Pattern illustré : si FamilyCard charge ses données via onMounted() + fetch,
    // flushPromises() attend que TOUTES les promesses JS en attente se résolvent.
    // trigger() ne couvre que la réactivité Vue, pas les promesses applicatives.
    const wrapper = mount(FamilyCard, {
      props: { family: mockFamily }, // ici prop directe, mais le pattern s'applique à un fetch
    })

    // flushPromises résout toutes les promesses en attente dans le composant
    // → indispensable quand onMounted() lance un fetch ou un setTimeout
    await flushPromises()

    // Le composant est dans son état final — on peut asserter en toute confiance
    expect(wrapper.get('h2').text()).toBe('Les Martin')
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false) // plus de spinner
  })
})
```

Points de validation par le coach : (a) aucun accès à `wrapper.vm` — tout passe par le DOM observable ; (b) `get` vs `find` correctement discriminés — présence via `get`, absence via `find().exists()` ; (c) `await` systématique sur `trigger` et `setProps` ; (d) structure `wrapper.emitted('select')![0]` == `['fam-1']` bien comprise ; (e) `flushPromises` présent pour l'async interne, distinct du `await trigger`.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 20 min**. Ajoute une contrainte : `FamilyCard` accepte maintenant une prop `disabled?: boolean`. Quand `disabled` est `true`, le bouton « Rejoindre » est désactivé (`disabled` HTML) et un clic ne doit pas émettre `select`.

1. Écris le test du cas `disabled: true` — vérifie que le bouton a l'attribut `disabled` ET que `wrapper.emitted('select')` reste `undefined` après tentative de clic.
2. Vérifie que `disabled: false` (valeur par défaut) fonctionne normalement — le bouton est actif et émet `select`.
3. Bonus : réécris les assertions avec `@testing-library/vue` (`screen.getByRole('button', { name: /rejoindre/i })`) et compare l'ergonomie avec Vue Test Utils — laquelle est plus lisible pour un reviewer ?

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée ou adapte `src/components/FamilyCard.vue` avec la structure donnée dans l'énoncé.
2. Vérifie que l'état vide a bien `role="status"` dans le template — si ce n'est pas le cas, corrige-le maintenant (le test l'a détecté comme régression RGAA).
3. Écris `src/components/FamilyCard.test.ts` avec les 5 tests du corrigé, en Vitest + `@vue/test-utils` réels (`vitest run`, déjà configuré dans le repo).
4. Commit : `test(FamilyCard): mount + emitted + état vide — @vue/test-utils`.
