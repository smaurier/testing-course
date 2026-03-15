# Module 07 — Tests de composants

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 3/5        | 90 min        | [Lab 07](../labs/lab-07-tests-composants/) | [Quiz 07](../quizzes/quiz-07-composants.html) |

## Objectifs

- Comprendre ce qu'est un test de composant et sa place dans la pyramide des tests
- Adopter la philosophie "tester le comportement, pas l'implementation"
- Maîtriser les stratégies de rendu : full mount vs shallow mount
- Écrire des tests centres sur l'utilisateur avec la bonne priorite de selecteurs
- Tester props, events, slots, rendu conditionnel, listes, formulaires et états asynchrones
- Comparer les approches Vue Test Utils, React Testing Library et Angular TestBed

---

## Qu'est-ce qu'un test de composant ?

Un test de composant se situe entre le test unitaire pur et le test d'intégration. Il teste un composant UI de manière isolee, mais avec son rendu réel dans un DOM (réel ou simule).

```
                     Test unitaire
                         |
                         v
     Fonction pure  →  Composant isole  →  Plusieurs composants
                         ^                        ^
                    Test de composant       Test d'integration
                         |
                         v
                  Full mount (DOM)
```

### Comparaison avec les autres niveaux

```typescript
// Test unitaire : fonction pure, pas de DOM
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('should format euros correctly', () => {
    expect(formatCurrency(1234.5, 'EUR')).toBe('1 234,50 €');
  });
});

// Test de composant : rendu dans un DOM, interactions simulees
// (pseudo-code generique, framework-agnostic)
describe('PriceDisplay component', () => {
  it('should render formatted price with currency symbol', () => {
    const element = render(PriceDisplay, { props: { amount: 1234.5, currency: 'EUR' } });
    expect(element.textContent).toContain('1 234,50 €');
  });
});

// Test d'integration : plusieurs composants + store + router
describe('ProductPage integration', () => {
  it('should add product to cart and update header count', () => {
    const page = renderWithProviders(ProductPage, { store, router });
    clickButton(page, 'Ajouter au panier');
    expect(getHeaderCartCount(page)).toBe('1');
  });
});
```

### Quand écrire un test de composant ?

| Situation | Type recommande |
|-----------|----------------|
| Logique metier pure (calculs, transformations) | Test unitaire |
| Un composant avec ses props/events | **Test de composant** |
| Un composant avec ses enfants directs | **Test de composant** |
| Flux utilisateur complet (login → dashboard) | Test E2E |
| Composant + store + API réelle | Test d'intégration |

---

## Philosophie : tester le comportement, pas l'implementation

Le principe fondamental est de tester ce que l'utilisateur voit et fait, pas comment le composant fonctionne en interne.

### Anti-pattern : tester l'implementation

```typescript
// MAUVAIS — couplage a l'implementation interne
describe('Counter', () => {
  it('should increment internal state', () => {
    const wrapper = mount(Counter);

    // On accede a l'etat interne du composant
    expect(wrapper.vm.count).toBe(0);

    // On appelle une methode interne directement
    wrapper.vm.increment();

    // On verifie l'etat interne
    expect(wrapper.vm.count).toBe(1);
  });
});
```

### Bonne pratique : tester le comportement

```typescript
// BON — on teste comme un utilisateur
describe('Counter', () => {
  it('should display incremented value after clicking the button', () => {
    const wrapper = mount(Counter);

    // On verifie ce que l'utilisateur voit
    expect(wrapper.getByRole('status')).toHaveTextContent('0');

    // On interagit comme un utilisateur
    wrapper.getByRole('button', { name: /incrementer/i }).click();

    // On verifie ce que l'utilisateur voit apres l'interaction
    expect(wrapper.getByRole('status')).toHaveTextContent('1');
  });
});
```

### Le principe de Kent C. Dodds

> "The more your tests resemble the way your software is used,
> the more confidence they can give you."

Cela signifie :
- Pas d'acces a `wrapper.vm` ou `component.instance`
- Pas d'appel direct aux méthodes internes
- Chercher les éléments par leur role, label, ou texte visible
- Interagir via click, type, submit — pas via des appels programmatiques

---

## Full mount vs shallow mount

### Full mount (deep rendering)

Le composant et tous ses enfants sont rendus integralement.

```typescript
import { mount } from '@vue/test-utils'; // Vue
import { render } from '@testing-library/react'; // React

// Vue — full mount
const wrapper = mount(ProductCard, {
  props: {
    product: { id: 1, name: 'Laptop', price: 999, image: '/laptop.jpg' },
  },
});

// Le composant enfant <PriceDisplay> est rendu avec son HTML complet
expect(wrapper.html()).toContain('999,00 €');
```

### Shallow mount (rendu superficiel)

Les composants enfants sont remplaces par des stubs (placeholders).

```typescript
import { shallowMount } from '@vue/test-utils';

const wrapper = shallowMount(ProductCard, {
  props: {
    product: { id: 1, name: 'Laptop', price: 999, image: '/laptop.jpg' },
  },
});

// <PriceDisplay> est remplace par <price-display-stub>
// On ne peut pas verifier le formatage du prix
expect(wrapper.find('price-display-stub').exists()).toBe(true);
```

### Comparaison

| Critere | Full mount | Shallow mount |
|---------|-----------|---------------|
| Realisme | Rendu complet, proche de la realite | Stubs pour les enfants |
| Vitesse | Plus lent (plus de DOM a créer) | Plus rapide |
| Isolation | Moins isole (depend des enfants) | Plus isole |
| Confiance | Plus de confiance | Moins de confiance |
| Fragilite | Peut casser si un enfant change | Isole des changements enfants |
| Recommandation | Prefere par Testing Library | Traditionnel mais en declin |

### Recommandation actuelle

La tendance est au **full mount** car :
- Il teste ce que l'utilisateur voit réellement
- Il détecté les regressions dans les composants enfants
- Il est plus proche du comportement réel de l'application
- Les gains de vitesse du shallow mount sont negligeables avec les outils modernes

```typescript
// Recommande : full mount avec isolation selective
import { mount } from '@vue/test-utils';

const wrapper = mount(ProductCard, {
  props: { product },
  global: {
    // On ne stub que les dependances externes lourdes
    stubs: {
      // Remplacer un composant tiers lourd par un stub
      HeavyChartLibrary: { template: '<div data-testid="chart-stub" />' },
    },
    // Fournir les plugins necessaires
    plugins: [createTestPinia()],
  },
});
```

---

## Priorite des selecteurs

L'ordre de priorite pour trouver un élément dans le DOM teste reflete l'accessibilité et la robustesse :

### 1. getByRole — meilleur choix

```typescript
// Bouton
screen.getByRole('button', { name: /sauvegarder/i });

// Champ de saisie avec label
screen.getByRole('textbox', { name: /adresse email/i });

// Lien
screen.getByRole('link', { name: /voir le profil/i });

// Case a cocher
screen.getByRole('checkbox', { name: /accepter les conditions/i });

// Titre
screen.getByRole('heading', { name: /bienvenue/i, level: 1 });

// Zone de navigation
screen.getByRole('navigation');

// Element de liste
screen.getByRole('listitem');
```

### 2. getByLabelText — pour les champs de formulaire

```typescript
// Input avec <label for="email">Adresse email</label>
screen.getByLabelText(/adresse email/i);

// Input avec aria-label
screen.getByLabelText(/rechercher/i);

// Select avec label
screen.getByLabelText(/pays/i);
```

### 3. getByText — pour le contenu textuel

```typescript
// Paragraphe, span, ou tout element contenant ce texte
screen.getByText(/aucun resultat trouve/i);

// Message d'erreur
screen.getByText(/ce champ est obligatoire/i);

// Texte dans un element non-interactif
screen.getByText(/derniere mise a jour :/i);
```

### 4. getByTestId — dernier recours

```typescript
// Quand aucune autre query ne fonctionne
// Element sans texte visible, sans role semantique
screen.getByTestId('loading-spinner');
screen.getByTestId('avatar-placeholder');
```

### Tableau récapitulatif

| Priorite | Query | Quand l'utiliser |
|----------|-------|------------------|
| 1 | `getByRole` | Éléments interactifs, headings, landmarks |
| 2 | `getByLabelText` | Champs de formulaire |
| 3 | `getByPlaceholderText` | Si pas de label (deconseille mais pragmatique) |
| 4 | `getByText` | Contenu textuel non-interactif |
| 5 | `getByDisplayValue` | Valeur actuelle d'un input |
| 6 | `getByAltText` | Images |
| 7 | `getByTitle` | Attribut title (peu accessible) |
| 8 | `getByTestId` | Dernier recours, aucune semantique |

---

## Patterns de test : rendu et vérification

### Pattern 1 : Render + Verify

Le pattern le plus simple — rendre le composant et vérifier le contenu affiche.

```typescript
// Illustration avec le DOM natif (sans framework)
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

function createUserCard(user: { name: string; email: string; role: string }): HTMLElement {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const document = dom.window.document;

  const card = document.createElement('article');
  card.setAttribute('role', 'article');

  card.innerHTML = `
    <h2>${user.name}</h2>
    <p data-field="email">${user.email}</p>
    <span class="badge badge--${user.role}">${user.role}</span>
  `;

  return card;
}

describe('UserCard (vanilla DOM)', () => {
  it('should render user information', () => {
    const card = createUserCard({
      name: 'Alice Martin',
      email: 'alice@example.com',
      role: 'admin',
    });

    expect(card.querySelector('h2')?.textContent).toBe('Alice Martin');
    expect(card.querySelector('[data-field="email"]')?.textContent).toBe('alice@example.com');
    expect(card.querySelector('.badge')?.textContent).toBe('admin');
    expect(card.querySelector('.badge')?.classList.contains('badge--admin')).toBe(true);
  });

  it('should have article role for accessibility', () => {
    const card = createUserCard({ name: 'Bob', email: 'bob@test.com', role: 'user' });
    expect(card.getAttribute('role')).toBe('article');
  });
});
```

### Pattern 2 : framework Vue avec Testing Library

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import UserCard from './UserCard.vue';

describe('UserCard', () => {
  const defaultUser = {
    name: 'Alice Martin',
    email: 'alice@example.com',
    role: 'admin' as const,
    avatar: '/avatars/alice.jpg',
  };

  it('should render user name as heading', () => {
    render(UserCard, { props: { user: defaultUser } });

    expect(screen.getByRole('heading', { name: /alice martin/i })).toBeTruthy();
  });

  it('should render email address', () => {
    render(UserCard, { props: { user: defaultUser } });

    expect(screen.getByText('alice@example.com')).toBeTruthy();
  });

  it('should render role badge with correct variant', () => {
    render(UserCard, { props: { user: defaultUser } });

    const badge = screen.getByText('admin');
    expect(badge.classList.contains('badge--admin')).toBe(true);
  });

  it('should render avatar with alt text', () => {
    render(UserCard, { props: { user: defaultUser } });

    const img = screen.getByRole('img', { name: /alice martin/i });
    expect(img.getAttribute('src')).toBe('/avatars/alice.jpg');
  });
});
```

---

## Simuler des interactions utilisateur

### Clics

```typescript
import { render, screen } from '@testing-library/vue';
import { userEvent } from '@testing-library/user-event';

describe('ToggleButton', () => {
  it('should toggle state on click', async () => {
    const user = userEvent.setup();
    render(ToggleButton, { props: { label: 'Mode sombre' } });

    const button = screen.getByRole('button', { name: /mode sombre/i });
    expect(button.getAttribute('aria-pressed')).toBe('false');

    await user.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    await user.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});
```

### Saisie de texte

```typescript
describe('SearchInput', () => {
  it('should emit search event on Enter', async () => {
    const user = userEvent.setup();
    const { emitted } = render(SearchInput);

    const input = screen.getByRole('searchbox');
    await user.type(input, 'testing library');
    await user.keyboard('{Enter}');

    expect(emitted().search).toBeTruthy();
    expect(emitted().search[0]).toEqual(['testing library']);
  });

  it('should clear input when clicking reset button', async () => {
    const user = userEvent.setup();
    render(SearchInput);

    const input = screen.getByRole('searchbox');
    await user.type(input, 'some text');
    expect(input).toHaveValue('some text');

    await user.click(screen.getByRole('button', { name: /effacer/i }));
    expect(input).toHaveValue('');
  });
});
```

### Selection dans un dropdown

```typescript
describe('LanguageSelector', () => {
  it('should update selected language', async () => {
    const user = userEvent.setup();
    render(LanguageSelector, {
      props: { languages: ['Francais', 'English', 'Nederlands'] },
    });

    const select = screen.getByRole('combobox', { name: /langue/i });
    await user.selectOptions(select, 'English');

    expect(select).toHaveValue('English');
  });
});
```

---

## Rendu conditionnel

```typescript
interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  dismissible?: boolean;
}

describe('AlertBanner', () => {
  it('should render message with correct type', () => {
    render(AlertBanner, {
      props: { type: 'error', message: 'Une erreur est survenue' },
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Une erreur est survenue');
    expect(alert.classList.contains('alert--error')).toBe(true);
  });

  it('should show dismiss button only when dismissible', () => {
    // Sans dismissible
    const { unmount } = render(AlertBanner, {
      props: { type: 'info', message: 'Information', dismissible: false },
    });

    expect(screen.queryByRole('button', { name: /fermer/i })).toBeNull();
    unmount();

    // Avec dismissible
    render(AlertBanner, {
      props: { type: 'info', message: 'Information', dismissible: true },
    });

    expect(screen.getByRole('button', { name: /fermer/i })).toBeTruthy();
  });

  it('should hide alert when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    render(AlertBanner, {
      props: { type: 'warning', message: 'Attention', dismissible: true },
    });

    expect(screen.getByRole('alert')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /fermer/i }));

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
```

---

## Tester des listes

```typescript
interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

describe('TaskList', () => {
  const tasks: Task[] = [
    { id: '1', title: 'Ecrire les tests', completed: false, priority: 'high' },
    { id: '2', title: 'Refactorer le code', completed: true, priority: 'medium' },
    { id: '3', title: 'Deployer en production', completed: false, priority: 'low' },
  ];

  it('should render all tasks', () => {
    render(TaskList, { props: { tasks } });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('should display task titles', () => {
    render(TaskList, { props: { tasks } });

    expect(screen.getByText('Ecrire les tests')).toBeTruthy();
    expect(screen.getByText('Refactorer le code')).toBeTruthy();
    expect(screen.getByText('Deployer en production')).toBeTruthy();
  });

  it('should mark completed tasks with strikethrough', () => {
    render(TaskList, { props: { tasks } });

    const completedTask = screen.getByText('Refactorer le code');
    expect(completedTask.closest('[data-completed="true"]')).toBeTruthy();
  });

  it('should render empty state when no tasks', () => {
    render(TaskList, { props: { tasks: [] } });

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText(/aucune tache/i)).toBeTruthy();
  });

  it('should sort tasks by priority', () => {
    render(TaskList, { props: { tasks, sortBy: 'priority' } });

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ecrire les tests');       // high
    expect(items[1]).toHaveTextContent('Refactorer le code');      // medium
    expect(items[2]).toHaveTextContent('Deployer en production');  // low
  });
});
```

---

## Tester des formulaires

```typescript
interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

describe('ContactForm', () => {
  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(ContactForm, { props: { onSubmit } });

    await user.type(screen.getByLabelText(/nom/i), 'Alice Martin');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.selectOptions(screen.getByLabelText(/sujet/i), 'Support technique');
    await user.type(screen.getByLabelText(/message/i), 'Bonjour, j\'ai un probleme...');

    await user.click(screen.getByRole('button', { name: /envoyer/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Alice Martin',
      email: 'alice@example.com',
      subject: 'Support technique',
      message: 'Bonjour, j\'ai un probleme...',
    });
  });

  it('should display validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    render(ContactForm, { props: { onSubmit: vi.fn() } });

    // Soumettre sans remplir les champs
    await user.click(screen.getByRole('button', { name: /envoyer/i }));

    expect(screen.getByText(/le nom est obligatoire/i)).toBeTruthy();
    expect(screen.getByText(/l'email est obligatoire/i)).toBeTruthy();
  });

  it('should display error for invalid email format', async () => {
    const user = userEvent.setup();
    render(ContactForm, { props: { onSubmit: vi.fn() } });

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /envoyer/i }));

    expect(screen.getByText(/format d'email invalide/i)).toBeTruthy();
  });

  it('should disable submit button while submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    render(ContactForm, { props: { onSubmit } });

    // Remplir tous les champs obligatoires
    await user.type(screen.getByLabelText(/nom/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@test.com');
    await user.type(screen.getByLabelText(/message/i), 'Hello');

    const submitButton = screen.getByRole('button', { name: /envoyer/i });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/envoi en cours/i)).toBeTruthy();
  });
});
```

---

## Etats de chargement asynchrone

```typescript
describe('UserProfile', () => {
  it('should show loading spinner initially', () => {
    render(UserProfile, { props: { userId: '123' } });

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('should display user data after loading', async () => {
    render(UserProfile, { props: { userId: '123' } });

    // Attendre que le contenu apparaisse
    const heading = await screen.findByRole('heading', { name: /alice martin/i });
    expect(heading).toBeTruthy();

    // Le spinner doit avoir disparu
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('should display error message on fetch failure', async () => {
    // Simuler une erreur API (via MSW ou mock)
    server.use(
      http.get('/api/users/123', () => {
        return HttpResponse.json(
          { error: 'User not found' },
          { status: 404 },
        );
      }),
    );

    render(UserProfile, { props: { userId: '123' } });

    const errorMessage = await screen.findByRole('alert');
    expect(errorMessage).toHaveTextContent(/utilisateur non trouve/i);
  });

  it('should retry on clicking retry button', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.get('/api/users/123', () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }
        return HttpResponse.json({ id: '123', name: 'Alice Martin' });
      }),
    );

    render(UserProfile, { props: { userId: '123' } });

    // Premiere tentative : erreur
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toBeTruthy();

    // Cliquer sur "Reessayer"
    await user.click(screen.getByRole('button', { name: /reessayer/i }));

    // Deuxieme tentative : succes
    const heading = await screen.findByRole('heading', { name: /alice martin/i });
    expect(heading).toBeTruthy();
  });
});
```

---

## Tester les props

```typescript
describe('Badge component', () => {
  it('should render with default variant', () => {
    render(Badge, { props: { label: 'Nouveau' } });

    const badge = screen.getByText('Nouveau');
    expect(badge.classList.contains('badge--default')).toBe(true);
  });

  it('should apply variant class', () => {
    const variants = ['success', 'warning', 'error', 'info'] as const;

    variants.forEach((variant) => {
      const { unmount } = render(Badge, {
        props: { label: `Test ${variant}`, variant },
      });

      const badge = screen.getByText(`Test ${variant}`);
      expect(badge.classList.contains(`badge--${variant}`)).toBe(true);
      unmount();
    });
  });

  it('should render as pill when rounded prop is true', () => {
    render(Badge, {
      props: { label: 'Pill', rounded: true },
    });

    const badge = screen.getByText('Pill');
    expect(badge.classList.contains('badge--rounded')).toBe(true);
  });

  it('should render icon when provided', () => {
    render(Badge, {
      props: { label: 'Avec icone', icon: 'check' },
    });

    expect(screen.getByRole('img', { name: /check/i })).toBeTruthy();
    expect(screen.getByText('Avec icone')).toBeTruthy();
  });
});
```

---

## Tester les events

```typescript
// Vue Test Utils
describe('ColorPicker (Vue)', () => {
  it('should emit color-change event on selection', async () => {
    const wrapper = mount(ColorPicker, {
      props: {
        colors: ['#FF0000', '#00FF00', '#0000FF'],
        modelValue: '#FF0000',
      },
    });

    await wrapper.find('[data-color="#00FF00"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#00FF00']);
  });

  it('should emit multiple events in sequence', async () => {
    const wrapper = mount(ColorPicker, {
      props: {
        colors: ['#FF0000', '#00FF00', '#0000FF'],
        modelValue: '#FF0000',
      },
    });

    await wrapper.find('[data-color="#00FF00"]').trigger('click');
    await wrapper.find('[data-color="#0000FF"]').trigger('click');

    const emitted = wrapper.emitted('update:modelValue')!;
    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toEqual(['#00FF00']);
    expect(emitted[1]).toEqual(['#0000FF']);
  });
});

// Testing Library (framework-agnostic pattern)
describe('ColorPicker (Testing Library)', () => {
  it('should call onChange handler when color is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(ColorPicker, {
      props: {
        colors: ['#FF0000', '#00FF00', '#0000FF'],
        value: '#FF0000',
        onChange,
      },
    });

    await user.click(screen.getByRole('radio', { name: /vert/i }));

    expect(onChange).toHaveBeenCalledWith('#00FF00');
  });
});
```

---

## Tester les slots / children

```typescript
// Vue — testing slots
describe('Card component (Vue)', () => {
  it('should render default slot content', () => {
    const wrapper = mount(Card, {
      slots: {
        default: '<p>Contenu principal</p>',
      },
    });

    expect(wrapper.html()).toContain('Contenu principal');
  });

  it('should render named slots', () => {
    const wrapper = mount(Card, {
      slots: {
        header: '<h2>Titre de la carte</h2>',
        default: '<p>Contenu de la carte</p>',
        footer: '<button>Action</button>',
      },
    });

    expect(wrapper.find('.card__header h2').text()).toBe('Titre de la carte');
    expect(wrapper.find('.card__body p').text()).toBe('Contenu de la carte');
    expect(wrapper.find('.card__footer button').text()).toBe('Action');
  });

  it('should render scoped slot with provided data', () => {
    const wrapper = mount(DataTable, {
      props: {
        items: [
          { id: 1, name: 'Alice', score: 95 },
          { id: 2, name: 'Bob', score: 82 },
        ],
        columns: ['name', 'score'],
      },
      slots: {
        'cell-score': `
          <template #cell-score="{ value }">
            <span class="score" :class="{ 'score--high': value >= 90 }">
              {{ value }}
            </span>
          </template>
        `,
      },
    });

    const scores = wrapper.findAll('.score');
    expect(scores).toHaveLength(2);
    expect(scores[0].classes()).toContain('score--high');
    expect(scores[1].classes()).not.toContain('score--high');
  });
});

// React — testing children and render props
describe('Card component (React pattern)', () => {
  it('should render children', () => {
    render(
      <Card>
        <p>Contenu de la carte</p>
      </Card>
    );

    expect(screen.getByText('Contenu de la carte')).toBeTruthy();
  });

  it('should render header and footer via props', () => {
    render(
      <Card
        header={<h2>Mon titre</h2>}
        footer={<button>Valider</button>}
      >
        <p>Contenu</p>
      </Card>
    );

    expect(screen.getByRole('heading', { name: /mon titre/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /valider/i })).toBeTruthy();
  });
});
```

---

## Illustration vanilla DOM complete

Pour comprendre ce qui se passe "sous le capot", voici un composant et ses tests en pur TypeScript avec jsdom :

```typescript
// counter.ts — composant vanilla
export interface CounterOptions {
  initialValue?: number;
  min?: number;
  max?: number;
  step?: number;
}

export function createCounter(container: HTMLElement, options: CounterOptions = {}): {
  getValue: () => number;
  destroy: () => void;
} {
  const { initialValue = 0, min = -Infinity, max = Infinity, step = 1 } = options;
  let value = initialValue;

  // Creer le DOM
  const display = document.createElement('output');
  display.setAttribute('role', 'status');
  display.setAttribute('aria-live', 'polite');
  display.textContent = String(value);

  const decrementBtn = document.createElement('button');
  decrementBtn.setAttribute('aria-label', 'Diminuer');
  decrementBtn.textContent = '-';
  decrementBtn.disabled = value <= min;

  const incrementBtn = document.createElement('button');
  incrementBtn.setAttribute('aria-label', 'Augmenter');
  incrementBtn.textContent = '+';
  incrementBtn.disabled = value >= max;

  function updateDisplay(): void {
    display.textContent = String(value);
    decrementBtn.disabled = value <= min;
    incrementBtn.disabled = value >= max;
  }

  decrementBtn.addEventListener('click', () => {
    if (value > min) {
      value = Math.max(min, value - step);
      updateDisplay();
    }
  });

  incrementBtn.addEventListener('click', () => {
    if (value < max) {
      value = Math.min(max, value + step);
      updateDisplay();
    }
  });

  container.append(decrementBtn, display, incrementBtn);

  return {
    getValue: () => value,
    destroy: () => {
      container.innerHTML = '';
    },
  };
}
```

```typescript
// counter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createCounter } from './counter';

describe('createCounter (vanilla DOM)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should render with initial value', () => {
    createCounter(container, { initialValue: 5 });

    const output = container.querySelector('[role="status"]');
    expect(output?.textContent).toBe('5');
  });

  it('should increment on click', () => {
    createCounter(container);

    const incrementBtn = container.querySelector('[aria-label="Augmenter"]') as HTMLButtonElement;
    const output = container.querySelector('[role="status"]');

    incrementBtn.click();
    expect(output?.textContent).toBe('1');

    incrementBtn.click();
    expect(output?.textContent).toBe('2');
  });

  it('should decrement on click', () => {
    createCounter(container, { initialValue: 10 });

    const decrementBtn = container.querySelector('[aria-label="Diminuer"]') as HTMLButtonElement;
    const output = container.querySelector('[role="status"]');

    decrementBtn.click();
    expect(output?.textContent).toBe('9');
  });

  it('should respect min boundary', () => {
    createCounter(container, { initialValue: 0, min: 0 });

    const decrementBtn = container.querySelector('[aria-label="Diminuer"]') as HTMLButtonElement;
    const output = container.querySelector('[role="status"]');

    expect(decrementBtn.disabled).toBe(true);
    decrementBtn.click();
    expect(output?.textContent).toBe('0');
  });

  it('should respect max boundary', () => {
    createCounter(container, { initialValue: 10, max: 10 });

    const incrementBtn = container.querySelector('[aria-label="Augmenter"]') as HTMLButtonElement;
    expect(incrementBtn.disabled).toBe(true);
  });

  it('should use custom step', () => {
    createCounter(container, { initialValue: 0, step: 5 });

    const incrementBtn = container.querySelector('[aria-label="Augmenter"]') as HTMLButtonElement;
    const output = container.querySelector('[role="status"]');

    incrementBtn.click();
    expect(output?.textContent).toBe('5');

    incrementBtn.click();
    expect(output?.textContent).toBe('10');
  });
});
```

---

## Comparaison cross-framework

| Fonctionnalite | Vue Test Utils | React Testing Library | Angular TestBed |
|----------------|---------------|----------------------|-----------------|
| **Rendu** | `mount(Comp, { props })` | `render(<Comp prop={v} />)` | `TestBed.createComponent(Comp)` |
| **Shallow render** | `shallowMount(Comp)` | Non recommande | `NO_ERRORS_SCHEMA` |
| **Trouver élément** | `wrapper.find('.class')` | `screen.getByRole(...)` | `fixture.debugElement.query(By.css(...))` |
| **Clic** | `wrapper.trigger('click')` | `userEvent.click(el)` | `el.triggerEventHandler('click')` |
| **Saisie texte** | `wrapper.setValue('text')` | `userEvent.type(el, 'text')` | `input.value = 'text'; dispatchEvent(...)` |
| **Vérifier events** | `wrapper.emitted('event')` | `vi.fn()` callback prop | `spyOn(comp.eventEmitter, 'emit')` |
| **Attente async** | `await nextTick()` | `await findBy...()` | `fixture.detectChanges()` |
| **Props** | `wrapper.setProps({...})` | `rerender(<Comp newProp />)` | `comp.input = val; detectChanges()` |
| **Slots / Children** | `slots: { default: '...' }` | JSX children | `<ng-content>` + wrapper comp |
| **Store intégration** | `createTestPinia()` | `<Provider store={store}>` | `provideMockStore()` |
| **Router** | `global: { plugins: [router] }` | `<MemoryRouter>` | `RouterTestingModule` |
| **Philosophie** | Acces au `wrapper.vm` possible | Interdit acces interne | Mixte (DI accessible) |

### Exemple comparatif — même composant, 3 frameworks

```typescript
// === VUE TEST UTILS ===
import { mount } from '@vue/test-utils';

it('should add item to todo list', async () => {
  const wrapper = mount(TodoApp);

  await wrapper.find('input[type="text"]').setValue('Nouveau todo');
  await wrapper.find('form').trigger('submit');

  expect(wrapper.findAll('[data-testid="todo-item"]')).toHaveLength(1);
  expect(wrapper.text()).toContain('Nouveau todo');
});

// === REACT TESTING LIBRARY ===
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should add item to todo list', async () => {
  const user = userEvent.setup();
  render(<TodoApp />);

  await user.type(screen.getByRole('textbox'), 'Nouveau todo');
  await user.click(screen.getByRole('button', { name: /ajouter/i }));

  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('Nouveau todo')).toBeTruthy();
});

// === ANGULAR TESTBED ===
import { ComponentFixture, TestBed } from '@angular/core/testing';

it('should add item to todo list', () => {
  const fixture: ComponentFixture<TodoAppComponent> = TestBed.createComponent(TodoAppComponent);
  fixture.detectChanges();

  const input = fixture.nativeElement.querySelector('input[type="text"]');
  input.value = 'Nouveau todo';
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();

  const form = fixture.nativeElement.querySelector('form');
  form.dispatchEvent(new Event('submit'));
  fixture.detectChanges();

  const items = fixture.nativeElement.querySelectorAll('[data-testid="todo-item"]');
  expect(items.length).toBe(1);
  expect(fixture.nativeElement.textContent).toContain('Nouveau todo');
});
```

---

## Bonnes pratiques — résumé

1. **Tester le comportement** : ce que l'utilisateur voit et fait
2. **Preferer getByRole** : meilleur pour l'accessibilité et la robustesse
3. **Full mount par defaut** : plus realiste, plus de confiance
4. **userEvent > fireEvent** : simule mieux le comportement réel (hover, focus, etc.)
5. **Un seul concept par test** : facile a diagnostiquer en cas d'echec
6. **Noms descriptifs** : le nom du test doit decrire le scenario
7. **Pas de `wrapper.vm`** : ne pas acceder a l'état interne du composant
8. **findBy pour l'async** : utiliser `findByRole`, `findByText` pour les éléments qui apparaissent après un delai
9. **cleanup automatique** : Testing Library nettoie le DOM entre chaque test
10. **Pas de snapshots DOM** : fragiles et peu informatifs, préférer des assertions explicites

---

## Exercice pratique

Creez les tests de composant pour un composant `ProductCard` qui :
- Affiche le nom, le prix, l'image et la description d'un produit
- A un bouton "Ajouter au panier" qui emet un événement avec le produit
- Affiche "En rupture de stock" si `stock === 0` et désactivé le bouton
- Affiche un badge "Promotion" si `discount > 0`
- Le prix barre et le prix remise doivent s'afficher correctement

> Solution dans le [Lab 07](../labs/lab-07-tests-composants/)

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [06 - Architecture testable](./06-architecture-testable) | [08 - MSW Mock Service Worker](./08-msw-mock-service-worker) |

---

## Ressources

- [Quiz 07 : Testez vos connaissances](../quizzes/quiz-07-composants.html)
- [Lab 07 : Tests de composants](../labs/lab-07-tests-composants/)
- Kent C. Dodds — [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details)
- Testing Library — [Guiding Principles](https://testing-library.com/docs/guiding-principles)
- Testing Library — [Which Query Should I Use?](https://testing-library.com/docs/queries/about#priority)
- Vue Test Utils — [Documentation](https://test-utils.vuejs.org/)
- Angular — [Component Testing](https://angular.dev/guide/testing/components-scenarios)

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 07 composants](../screencasts/screencast-07-composants.md)
2. **Lab** : [lab-07-tests-composants](../labs/lab-07-tests-composants/README)
3. **Quiz** : [quiz 07 composants](../quizzes/quiz-07-composants.html)
:::
