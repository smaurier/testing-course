# Screencast 02 — Anatomie d'un test

## Informations
- **Duree estimee** : 15-18 min
- **Module** : `modules/02-anatomie-dun-test.md`
- **Lab associe** : Lab 02
- **Prerequis** : Screencast 01

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Projet de demo avec Vitest installe
- [ ] Fichier `modules/02-anatomie-dun-test.md` ouvert

## Script

### [00:00-02:00] Introduction — Le pattern AAA

> Tout test, quel que soit le framework ou le langage, suit trois etapes : Arrange, Act, Assert. C'est le pattern AAA. Arrange prepare le contexte, Act execute l'action, Assert verifie le resultat.

**Action** : Creer `src/shopping-cart.test.ts`.

```typescript
import { describe, it, expect } from 'vitest';

describe('ShoppingCart', () => {
  it('should calculate total with discount', () => {
    // ARRANGE — preparer les donnees et le contexte
    const cart = new ShoppingCart();
    cart.addItem({ name: 'Laptop', price: 1000, quantity: 1 });
    cart.addItem({ name: 'Mouse', price: 25, quantity: 2 });
    cart.applyDiscount(0.1);

    // ACT — executer l'action a tester
    const total = cart.getTotal();

    // ASSERT — verifier le resultat
    expect(total).toBe(945); // (1000 + 50) * 0.9
  });
});
```

> Chaque section a un role precis. Si vous mettez de la logique dans Assert ou de la verification dans Arrange, le test devient confus.

### [02:00-05:00] Structure — describe, it, expect

> `describe` groupe les tests logiquement. `it` (ou `test`) definit un cas de test. `expect` cree une assertion. Cette structure est commune a Vitest, Jest, Mocha et Playwright.

**Action** : Montrer l'imbrication de `describe`.

```typescript
describe('UserService', () => {
  describe('create', () => {
    it('should create a user with valid data', () => { /* ... */ });
    it('should throw on duplicate email', () => { /* ... */ });
  });

  describe('delete', () => {
    it('should delete an existing user', () => { /* ... */ });
    it('should throw on non-existent user', () => { /* ... */ });
  });
});
```

> L'imbrication de `describe` cree une hierarchie claire dans le rapport de tests. Mais attention : ne pas imbriquer plus de 2-3 niveaux.

### [05:00-08:00] Nommage — La convention "should"

> Le nom d'un test doit decrire le comportement attendu, pas l'implementation. La convention "should" est la plus repandue.

**Action** : Comparer les bons et mauvais noms.

```typescript
// MAUVAIS — decrit l'implementation
it('calls the database', () => { /* ... */ });
it('returns an object', () => { /* ... */ });

// BON — decrit le comportement
it('should return the user when found', () => { /* ... */ });
it('should throw NotFoundError when user does not exist', () => { /* ... */ });

// ALTERNATIVE — format "given/when/then" dans le nom
it('given an expired token, should reject the request', () => { /* ... */ });
```

> Un bon test doit etre comprehensible sans lire le code. Le nom seul doit suffire a comprendre ce qui est teste.

### [08:00-11:00] Setup et teardown — beforeEach, afterEach

> Quand plusieurs tests partagent le meme setup, on utilise `beforeEach` et `afterEach` pour eviter la duplication.

**Action** : Creer un exemple avec setup/teardown.

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
    db.exec("INSERT INTO users VALUES (1, 'Alice')");
  });

  afterEach(() => {
    db.close();
  });

  it('should find user by id', () => {
    const user = db.get('SELECT * FROM users WHERE id = 1');
    expect(user.name).toBe('Alice');
  });

  it('should return null for unknown id', () => {
    const user = db.get('SELECT * FROM users WHERE id = 999');
    expect(user).toBeUndefined();
  });
});
```

> `beforeEach` s'execute avant CHAQUE test, pas une seule fois. C'est crucial pour l'isolation : chaque test part d'un etat propre.

### [11:00-14:00] Anti-patterns — Ce qu'il ne faut PAS faire

> Il y a des erreurs classiques que tout le monde fait au debut.

**Action** : Montrer les anti-patterns.

```typescript
// ANTI-PATTERN 1 : Plusieurs actions et assertions melangees
it('should handle the full workflow', () => {
  const user = createUser('Alice');     // Act 1
  expect(user.id).toBeDefined();        // Assert 1
  updateUser(user.id, { name: 'Bob' }); // Act 2
  expect(user.name).toBe('Bob');        // Assert 2
  deleteUser(user.id);                  // Act 3
  expect(findUser(user.id)).toBeNull(); // Assert 3
});
// → Diviser en 3 tests distincts

// ANTI-PATTERN 2 : Test qui depend d'un autre test
let userId: number;
it('should create user', () => {
  userId = createUser('Alice').id; // stocke dans une variable partagee
});
it('should find user', () => {
  expect(findUser(userId)).toBeDefined(); // depend du test precedent
});
// → Chaque test doit etre independant

// ANTI-PATTERN 3 : Logique conditionnelle dans un test
it('should work', () => {
  const result = process(input);
  if (result.type === 'success') {
    expect(result.data).toBeDefined();
  } else {
    expect(result.error).toBeDefined();
  }
});
// → Un test = un chemin, pas de if/else
```

### [14:00-16:00] L'isolation — Chaque test est une ile

> L'isolation est le principe le plus important. Chaque test doit pouvoir s'executer seul, dans n'importe quel ordre, sans dependre des autres.

**Action** : Afficher les regles d'isolation.

```
REGLES D'ISOLATION :
1. Pas de variable partagee entre tests (sauf via beforeEach)
2. Pas de dependance a l'ordre d'execution
3. Pas d'etat global mutable (DB, fichiers, singletons)
4. Chaque test cree et nettoie son propre contexte
5. Un test qui echoue ne doit pas faire echouer les suivants
```

### [16:00-17:30] Recapitulatif

> Recapitulons. Le pattern AAA structure tout test : Arrange, Act, Assert. `describe`/`it` organisent les tests en hierarchie. Les noms decrivent le comportement attendu. `beforeEach`/`afterEach` mutualisent le setup. Et chaque test doit etre isole des autres.

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Pattern AAA : Arrange → Act → Assert
2. Un test = un comportement = une assertion principale
3. Nommer les tests par le comportement, pas l'implementation
4. beforeEach/afterEach pour le setup partage
5. Isolation : pas de dependance entre tests

PROCHAINE ETAPE :
→ Screencast 03 : Vitest fondamentaux
```

## Points d'attention pour l'enregistrement
- Le pattern AAA est fondamental — bien marquer les trois sections avec des commentaires
- Les anti-patterns resonnent avec l'experience de chacun — y passer du temps
- Montrer l'execution des tests apres chaque exemple
- L'isolation est souvent negligee par les debutants — insister
