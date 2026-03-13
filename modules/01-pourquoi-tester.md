# Module 01 — Pourquoi tester ?

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 1/5        | 60 min        | [Lab 01](../labs/lab-01-pourquoi-tester/) | [Quiz 01](../quizzes/quiz-01-pourquoi-tester.html) |

## Objectifs

- Comprendre le cout des bugs a chaque phase du cycle de vie
- Connaitre la pyramide de tests et ses variantes
- Savoir quand tester et quand ne PAS tester
- Evaluer le ROI du testing dans un projet reel

---

## Le cout des bugs

### La courbe exponentielle

Plus un bug est decouvert tard, plus il coute cher a corriger :

| Phase | Cout relatif | Exemple |
|-------|-------------|---------|
| Design | 1x | "Ce calcul devrait arrondir au centime" |
| Developpement | 5x | Bug trouve en code review |
| QA / Staging | 10x | Bug trouve en test manuel |
| Production | 100x | Bug decouvert par un client |
| Post-incident | 1000x | Fuite de donnees, perte de confiance |

```typescript
// Exemple concret : un bug de calcul de prix
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    // BUG : oubli de la quantite !
    return sum + item.price;
    // CORRECT : sum + item.price * item.quantity
  }, 0);
}

// En design : "n'oubliez pas la quantite" → 5 min
// En dev : code review detecte l'oubli → 30 min
// En QA : testeur remarque un total incorrect → 2h (reproduction, fix, re-test)
// En prod : client facture 1x au lieu de 3x → ???
```

### Les couts invisibles

Au-dela du fix technique :
- **Temps de debugging** : identifier la cause racine
- **Regression** : le fix introduit un nouveau bug
- **Confiance** : l'equipe doute de la qualite du code
- **Velocite** : chaque modification devient risquee sans tests

---

## La pyramide de tests

### Le modele classique

```
        /\
       /  \       E2E (5%)
      /    \      Lents, fragiles, couteux
     /------\
    /        \    Integration (25%)
   /          \   Moderement rapides
  /------------\
 /              \  Unit (70%)
/________________\ Rapides, isoles, nombreux
```

### Pourquoi cette repartition ?

```typescript
// UNIT TEST — rapide, isole, fiable
// Teste UNE fonction, UNE branche
function isAdult(age: number): boolean {
  return age >= 18;
}
// → Teste : isAdult(17) === false, isAdult(18) === true
// → Temps : < 1ms
// → Fiabilite : 100% deterministe

// INTEGRATION TEST — plus lent, teste l'assemblage
// Teste plusieurs composants ensemble
async function createOrder(userId: number, items: CartItem[]): Promise<Order> {
  const user = await userService.getById(userId);
  const total = calculateTotal(items);
  const order = await orderRepository.save({ userId: user.id, total, items });
  await emailService.sendConfirmation(user.email, order);
  return order;
}
// → Teste : le flux complet avec vraie DB + mock email
// → Temps : ~100ms
// → Fiabilite : 95% (depends de la DB)

// E2E TEST — lent, teste l'experience utilisateur
// → Teste : ouvrir le navigateur, naviguer, cliquer, verifier
// → Temps : ~5s
// → Fiabilite : 80% (navigateur, reseau, timing)
```

### La variante "Testing Trophy" (Kent C. Dodds)

```
     ___
    /   \      E2E
   /     \
  |-------|    Integration (MAJORITY)
  |       |
  |       |
  |-------|
   Static       (TypeScript, ESLint)
```

Difference clef : **plus de tests d'integration**, moins de tests unitaires.

Raisonnement : "Write tests. Not too many. Mostly integration."

```typescript
// Approche pyramide : tester calculateTotal et formatCurrency separement
// Approche trophy : tester le composant qui les utilise ensemble
// → Detecte les bugs d'integration que les tests unitaires ratent
```

### Quelle approche choisir ?

| Critere | Pyramide | Trophy |
|---------|----------|--------|
| Backend / logique metier | ✓ Beaucoup de logique pure | |
| Frontend / composants UI | | ✓ Interactions complexes |
| Algorithmes | ✓ Beaucoup de branches | |
| CRUD basique | | ✓ Integration suffit |
| Systeme critique (finance) | ✓ Maximum de couverture | |

---

## Types de tests

### Par portee

```typescript
// UNIT : une seule unite, isolee
describe('validateEmail', () => {
  it('should accept valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
});

// COMPONENT : un composant avec ses enfants
describe('LoginForm', () => {
  it('should show error on invalid email', async () => {
    render(LoginForm);
    await userEvent.type(screen.getByRole('textbox'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByText('Email invalide')).toBeVisible();
  });
});

// INTEGRATION : plusieurs modules ensemble
describe('POST /api/orders', () => {
  it('should create order and send email', async () => {
    const res = await request(app).post('/api/orders').send({ items: [{ id: 1, qty: 2 }] });
    expect(res.status).toBe(201);
    expect(emailMock).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Confirmation' }));
  });
});

// E2E : scenario utilisateur complet
test('user can checkout', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await page.getByRole('link', { name: 'Cart' }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.getByText('Order confirmed')).toBeVisible();
});
```

### Par intention

| Type | Question | Quand |
|------|----------|-------|
| **Regression** | "Ca marche encore ?" | Apres chaque changement |
| **Smoke** | "L'app demarre ?" | Deploiement, CI |
| **Sanity** | "Les fonctions critiques marchent ?" | Apres un hotfix |
| **Acceptance** | "Le client est satisfait ?" | Fin de sprint |
| **Exploratoire** | "Que se passe-t-il si... ?" | Manuellement, ad hoc |

---

## Quand NE PAS tester

### Le testing a un cout

```typescript
// NE PAS TESTER : code trivial sans logique
export function getFullName(first: string, last: string): string {
  return `${first} ${last}`;
}
// → Le test serait une copie du code. Zero valeur.

// NE PAS TESTER : prototype / POC
// Si le code sera jete dans 2 semaines, le tester est du gaspillage.

// NE PAS TESTER : code genere
// ORMs, SDK clients generes, types auto-generes — testez les utilisations, pas le code genere.

// NE PAS TESTER : implementation details
// ❌ Mauvais : "le state interne passe de X a Y"
// ✓ Bon : "le composant affiche le bon resultat"
```

### La regle des 80/20

> Testez les 20% du code qui causent 80% des bugs.

En pratique :
- **Toujours tester** : logique metier, calculs financiers, validation, auth
- **Souvent tester** : composants avec interactions, flux API, stores
- **Rarement tester** : code de configuration, constantes, layouts statiques
- **Jamais tester** : librairies tierces (elles ont leurs propres tests)

---

## ROI du testing

### Quantifier la valeur

```typescript
// Sans tests :
// - Temps de debug moyen par bug : 2h
// - Bugs en prod par mois : 15
// - Cout : 15 × 2h = 30h/mois

// Avec tests (80% couverture) :
// - Temps d'ecriture des tests : 20h initial + 5h/mois maintenance
// - Bugs en prod par mois : 3
// - Temps de debug par bug : 30min (le test indique ou chercher)
// - Cout : 5h + 3 × 0.5h = 6.5h/mois

// ROI = (30h - 6.5h) / 5h = 4.7x
// → Chaque heure investie en tests economise 4.7h de debug
```

### Les benefices non-mesurables

1. **Confiance pour refactorer** — les tests garantissent que le comportement est preserve
2. **Documentation vivante** — les tests decrivent le comportement attendu
3. **Design feedback** — du code dur a tester = du code mal concu
4. **Onboarding** — les nouveaux lisent les tests pour comprendre le code
5. **Deploiement continu** — impossible sans tests automatises

---

## Test-first vs Test-last

### Test-last (le plus courant)

```
1. Ecrire le code
2. Ca marche (manuellement)
3. Ecrire les tests
4. Les tests passent
```

**Avantages** : plus naturel, rapide pour du prototypage
**Inconvenients** : on oublie des cas, on teste l'implementation au lieu du comportement

### Test-first (TDD)

```
1. Ecrire un test qui echoue (RED)
2. Ecrire le minimum de code pour qu'il passe (GREEN)
3. Refactorer (REFACTOR)
4. Repeter
```

**Avantages** : design emerge, couverture maximale, zero code inutile
**Inconvenients** : courbe d'apprentissage, plus lent au debut

```typescript
// TDD en action : implementer isPalindrome

// RED : ecrire le test d'abord
it('should detect palindromes', () => {
  expect(isPalindrome('racecar')).toBe(true);
  expect(isPalindrome('hello')).toBe(false);
});
// → TypeError: isPalindrome is not defined

// GREEN : implementation minimale
function isPalindrome(str: string): boolean {
  return str === str.split('').reverse().join('');
}
// → Test passe

// REFACTOR : ameliorer si necessaire
// → Deja clean, on passe au test suivant

// RED : nouveau test
it('should be case-insensitive', () => {
  expect(isPalindrome('Racecar')).toBe(true);
});
// → Echoue

// GREEN : ajuster
function isPalindrome(str: string): boolean {
  const normalized = str.toLowerCase();
  return normalized === normalized.split('').reverse().join('');
}
// → Passe
```

Le Module 15 approfondira TDD et BDD.

---

## Exercice mental

Avant de passer au lab, reflechissez :

> Pour votre dernier projet, quels bugs auriez-vous pu eviter avec des tests ?
> Ou se situaient-ils dans la courbe de cout ?

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| [00 - Prerequis et introduction](./00-prerequis-et-introduction) | [02 - Anatomie d'un test](./02-anatomie-dun-test) |

---

## Ressources

- [Quiz 01 : Testez vos connaissances](../quizzes/quiz-01-pourquoi-tester.html)
- [Lab 01 : Premiers tests pratiques](../labs/lab-01-pourquoi-tester/)
- [Visualisation : Pyramide de tests interactive](../visualizations/test-pyramid.html)
- Martin Fowler — [Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
- Kent C. Dodds — [Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests)
