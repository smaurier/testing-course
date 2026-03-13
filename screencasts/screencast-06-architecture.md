# Screencast 06 — Architecture testable

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/06-architecture-testable.md`
- **Lab associe** : Lab 06
- **Prerequis** : Screencast 05

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] Projet de demo avec Vitest installe
- [ ] Fichier `modules/06-architecture-testable.md` ouvert

## Script

### [00:00-02:30] Introduction — Pourquoi certains codes sont difficiles a tester

> Si ecrire un test est penible, c'est souvent un signal de design, pas un probleme de testing. Les dependances cachees, l'etat global et le couplage fort rendent le code difficile a tester.

**Action** : Montrer un code difficile a tester.

```typescript
// DIFFICILE A TESTER — dependances cachees
export class OrderService {
  async placeOrder(items: CartItem[]): Promise<Order> {
    const db = require('./database').default;          // import cache
    const emailService = require('./email').default;   // import cache
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const order = await db.insert('orders', { items, total });
    await emailService.send(order.userId, 'Commande confirmee');
    return order;
  }
}
// Comment tester sans base de donnees ? Sans serveur email ?
```

### [02:30-06:00] Injection de dependances — La solution

> L'injection de dependances consiste a passer les dependances en parametre au lieu de les creer a l'interieur du code.

**Action** : Refactorer avec injection de dependances.

```typescript
// FACILE A TESTER — dependances injectees
interface OrderRepository {
  insert(table: string, data: unknown): Promise<Order>;
}

interface NotificationService {
  send(userId: string, message: string): Promise<void>;
}

export class OrderService {
  constructor(
    private repo: OrderRepository,
    private notifier: NotificationService
  ) {}

  async placeOrder(items: CartItem[]): Promise<Order> {
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const order = await this.repo.insert('orders', { items, total });
    await this.notifier.send(order.userId, 'Commande confirmee');
    return order;
  }
}
```

**Action** : Ecrire le test.

```typescript
describe('OrderService', () => {
  it('should create order and notify user', async () => {
    const mockRepo: OrderRepository = {
      insert: vi.fn().mockResolvedValue({ id: '1', userId: 'u1', items: [], total: 100 }),
    };
    const mockNotifier: NotificationService = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const service = new OrderService(mockRepo, mockNotifier);
    const order = await service.placeOrder([{ name: 'Book', price: 100, quantity: 1 }]);

    expect(order.id).toBe('1');
    expect(mockNotifier.send).toHaveBeenCalledWith('u1', 'Commande confirmee');
  });
});
```

### [06:00-09:00] Fonctions pures — Le graal de la testabilite

> Une fonction pure est la forme de code la plus facile a tester : meme entrees = meme sortie, pas d'effet de bord.

**Action** : Montrer l'extraction de logique pure.

```typescript
// AVANT — logique metier melangee avec I/O
async function processPayment(userId: string, amount: number) {
  const user = await db.findUser(userId);
  const fee = amount > 1000 ? amount * 0.02 : amount * 0.03;
  const total = amount + fee;
  if (user.balance < total) throw new Error('Insufficient funds');
  await db.updateBalance(userId, user.balance - total);
}

// APRES — logique pure extraite
export function calculateFee(amount: number): number {
  return amount > 1000 ? amount * 0.02 : amount * 0.03;
}

export function canAfford(balance: number, amount: number, fee: number): boolean {
  return balance >= amount + fee;
}

// Test trivial — pas de mock, pas d'async
describe('calculateFee', () => {
  it('should apply 3% for amounts <= 1000', () => {
    expect(calculateFee(100)).toBe(3);
  });
  it('should apply 2% for amounts > 1000', () => {
    expect(calculateFee(2000)).toBe(40);
  });
});
```

> La strategie : extraire la logique metier dans des fonctions pures, et garder le minimum de code "impure" (I/O, DB, API) dans une fine couche orchestratrice.

### [09:00-12:30] Architecture hexagonale — Ports & Adapters

> L'architecture hexagonale formalise cette separation : le domaine est au centre, les I/O sont aux bords.

**Action** : Afficher le diagramme.

```
                    ┌──────────────────┐
    HTTP  ──────►   │    PORT           │
    CLI   ──────►   │  (interface)      │
                    │                   │
                    │   DOMAINE         │
                    │   (logique pure)  │
                    │                   │
                    │    PORT           │   ──────► PostgreSQL
                    │  (interface)      │   ──────► Redis
                    └──────────────────┘   ──────► SMTP

    ADAPTERS         HEXAGONE             ADAPTERS
    (entree)         (domaine)            (sortie)
```

> Les ports sont des interfaces TypeScript. Les adapters sont des implementations concretes. Pour les tests, on injecte des fakes (InMemoryRepository) au lieu des vrais adapters.

### [12:30-15:30] Pattern Repository — Abstraction de la persistance

**Action** : Implementer un repository avec son fake.

```typescript
// Port (interface)
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// Adapter reel (production)
class PostgresUserRepository implements UserRepository { /* ... */ }

// Fake (tests)
class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
}

// Test avec le fake
describe('UserService', () => {
  it('should save and retrieve user', async () => {
    const repo = new InMemoryUserRepository();
    const service = new UserService(repo);

    await service.register({ id: '1', name: 'Alice', email: 'a@test.com' });
    const user = await service.getById('1');

    expect(user?.name).toBe('Alice');
  });
});
```

> Le fake est plus realiste qu'un mock car il a un vrai comportement. Il detecte des bugs que le mock ne detecterait pas.

### [15:30-18:00] SOLID sous l'angle de la testabilite

**Action** : Afficher le resume.

```
PRINCIPE | IMPACT SUR LA TESTABILITE
---------|---------------------------------------------
S (SRP)  | Chaque classe a une seule raison de changer → tests cibles
O (OCP)  | Extension sans modification → tests stables
L (LSP)  | Substitution → fakes et mocks fiables
I (ISP)  | Interfaces fines → mocks simples
D (DIP)  | Depend des abstractions → injection facile
```

### [18:00-19:30] Recapitulatif

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Code difficile a tester = signal de design
2. Injection de dependances : passer les deps en parametre
3. Fonctions pures : extraire la logique metier de l'I/O
4. Architecture hexagonale : domaine au centre, I/O aux bords
5. Fakes > mocks pour les comportements realistes
6. SOLID rend le code naturellement testable

PROCHAINE ETAPE :
→ Screencast 07 : Tests de composants
```

## Points d'attention pour l'enregistrement
- Le refactoring avant/apres est le moment cle — montrer la difference de testabilite
- L'architecture hexagonale peut sembler abstraite — utiliser le diagramme
- Le fake InMemoryRepository est plus parlant qu'un mock — insister
- Ne pas etre dogmatique sur SOLID — presenter comme un guide
