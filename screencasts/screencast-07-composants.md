# Screencast 07 — Tests de composants

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/07-tests-de-composants.md`
- **Lab associe** : Lab 07
- **Prerequis** : Screencast 06

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Projet de demo avec Vitest + jsdom
- [ ] Fichier `modules/07-tests-de-composants.md` ouvert

## Script

### [00:00-02:00] Introduction — Qu'est-ce qu'un test de composant ?

> Un test de composant se situe entre le test unitaire pur et le test d'integration. Il teste un composant UI de maniere isolee, avec son rendu reel dans un DOM simule.

**Action** : Afficher la place dans la pyramide.

```
    Fonction pure  →  Composant isole  →  Plusieurs composants  →  App complete
         ^                  ^                     ^                      ^
    Test unitaire    Test de composant    Test d'integration         Test E2E
```

> La philosophie cle : tester le COMPORTEMENT, pas l'IMPLEMENTATION. On ne verifie pas que `setState` a ete appele — on verifie que l'utilisateur voit le bon texte.

### [02:00-05:00] Philosophie — Tester comme un utilisateur

> Le mantra de Kent C. Dodds : "The more your tests resemble the way your software is used, the more confidence they can give you."

**Action** : Comparer les deux approches.

```typescript
// MAUVAIS — teste l'implementation
it('should set isOpen to true when button is clicked', () => {
  const wrapper = mount(Dropdown);
  wrapper.find('button').trigger('click');
  expect(wrapper.vm.isOpen).toBe(true); // acces a l'etat interne
});

// BON — teste le comportement
it('should show dropdown content when button is clicked', () => {
  const wrapper = mount(Dropdown);
  wrapper.find('button').trigger('click');
  expect(wrapper.find('.dropdown-content').isVisible()).toBe(true);
});
```

> Si on refactore `isOpen` en `expanded`, le mauvais test casse. Le bon test reste vert car le comportement n'a pas change.

### [05:00-08:30] Priorite des selecteurs

> Comment trouver un element dans le DOM ? Il y a une hierarchie de selecteurs, du plus resilient au plus fragile.

**Action** : Afficher la hierarchie.

```
PRIORITE | SELECTEUR              | EXEMPLE                         | POURQUOI
---------|------------------------|---------------------------------|----------
1        | role + accessible name | getByRole('button', {name: 'Submit'}) | WCAG
2        | label text             | getByLabelText('Email')         | Formulaires
3        | placeholder            | getByPlaceholderText('Search')  | Visible
4        | text content           | getByText('Bienvenue')          | Visible
5        | test id                | getByTestId('submit-btn')       | Dernier recours
---      | CSS class / tag        | find('.btn-primary')            | FRAGILE
```

> Les selecteurs bases sur le role et le texte visible sont les plus resilients car ils correspondent a ce que l'utilisateur voit. Les selecteurs CSS cassent au moindre refactoring.

### [08:30-12:00] Demo — Tester un formulaire complet

**Action** : Creer un test de formulaire (approche framework-agnostique).

```typescript
import { describe, it, expect } from 'vitest';

// Exemple avec une approche DOM-based generique
describe('LoginForm', () => {
  it('should submit with valid credentials', async () => {
    // ARRANGE — rendre le composant
    const { getByLabelText, getByRole } = render(LoginForm);

    // ACT — remplir et soumettre
    await userEvent.type(getByLabelText('Email'), 'alice@test.com');
    await userEvent.type(getByLabelText('Mot de passe'), 'secret123');
    await userEvent.click(getByRole('button', { name: 'Se connecter' }));

    // ASSERT — verifier le comportement
    expect(emitted('submit')).toEqual([
      [{ email: 'alice@test.com', password: 'secret123' }]
    ]);
  });

  it('should show error on empty email', async () => {
    const { getByRole, getByText } = render(LoginForm);

    await userEvent.click(getByRole('button', { name: 'Se connecter' }));

    expect(getByText('Email requis')).toBeVisible();
  });

  it('should disable button while submitting', async () => {
    const { getByRole, getByLabelText } = render(LoginForm);

    await userEvent.type(getByLabelText('Email'), 'alice@test.com');
    await userEvent.type(getByLabelText('Mot de passe'), 'secret123');
    await userEvent.click(getByRole('button', { name: 'Se connecter' }));

    expect(getByRole('button', { name: 'Se connecter' })).toBeDisabled();
  });
});
```

### [12:00-14:30] Props, events, slots — Les contrats du composant

> Chaque composant a un contrat : les props qu'il recoit, les events qu'il emet, et les slots qu'il expose.

**Action** : Montrer les tests par contrat.

```typescript
describe('UserCard', () => {
  // Props
  it('should display user name from props', () => {
    const { getByText } = render(UserCard, {
      props: { user: { name: 'Alice', role: 'Admin' } }
    });
    expect(getByText('Alice')).toBeVisible();
    expect(getByText('Admin')).toBeVisible();
  });

  // Events
  it('should emit delete event when button clicked', async () => {
    const { getByRole, emitted } = render(UserCard, {
      props: { user: { id: '1', name: 'Alice', role: 'Admin' } }
    });
    await userEvent.click(getByRole('button', { name: 'Supprimer' }));
    expect(emitted('delete')).toEqual([['1']]);
  });

  // Rendu conditionnel
  it('should show admin badge only for admin role', () => {
    const { queryByText } = render(UserCard, {
      props: { user: { name: 'Bob', role: 'User' } }
    });
    expect(queryByText('Admin')).toBeNull();
  });
});
```

### [14:30-16:30] Etats asynchrones — Loading, error, success

**Action** : Tester les differents etats.

```typescript
describe('UserList', () => {
  it('should show loading state initially', () => {
    const { getByText } = render(UserList);
    expect(getByText('Chargement...')).toBeVisible();
  });

  it('should show users after loading', async () => {
    const { getByText, findByText } = render(UserList);
    // findByText attend que l'element apparaisse (retries automatiques)
    expect(await findByText('Alice')).toBeVisible();
    expect(await findByText('Bob')).toBeVisible();
  });

  it('should show error message on failure', async () => {
    // Override MSW handler pour simuler une erreur
    server.use(http.get('/api/users', () => HttpResponse.error()));
    const { findByText } = render(UserList);
    expect(await findByText('Erreur de chargement')).toBeVisible();
  });
});
```

### [16:30-18:30] Recapitulatif

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Tester le COMPORTEMENT, pas l'IMPLEMENTATION
2. Selecteurs : role > label > text > testId > CSS class
3. Tester le contrat : props, events, slots
4. Couvrir les 3 etats : loading, success, error
5. findBy pour les elements asynchrones, queryBy pour l'absence

PROCHAINE ETAPE :
→ Screencast 08 : MSW (Mock Service Worker)
```

## Points d'attention pour l'enregistrement
- La comparaison implementation vs comportement est le moment cle
- La hierarchie des selecteurs est un reference a afficher en plein ecran
- Le formulaire de login est un cas concret que tout le monde comprend
- Montrer findBy vs getBy vs queryBy clairement
