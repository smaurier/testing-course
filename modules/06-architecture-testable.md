# Module 06 — Architecture testable

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 3/5        | 90 min        | [Lab 06](../labs/lab-06-architecture-testable/) | [Quiz 06](../quizzes/quiz-06-architecture.html) |

## Objectifs

- Identifier pourquoi certains codes sont difficiles à tester
- Maîtriser l'injection de dépendances (constructeur, paramètre, factory)
- Exploiter les fonctions pures pour des tests simples et fiables
- Appliquer les principes SOLID sous l'angle de la testabilité
- Comprendre l'architecture hexagonale (Ports & Adapters)
- Implementer les patterns Repository et Service Layer
- Reconnaitre et refactorer les anti-patterns courants

---

## Pourquoi certains codes sont difficiles à tester

### Les symptomes

Quand écrire un test devient penible, c'est un signal de design :

```typescript
// DIFFICILE A TESTER : dependances cachees
export class OrderService {
  async placeOrder(items: CartItem[]): Promise<Order> {
    // Dependance cachee 1 : import direct de la DB
    const db = require('./database').default;

    // Dependance cachee 2 : appel direct a un singleton
    const config = AppConfig.getInstance();

    // Dependance cachee 3 : new direct d'un service
    const emailer = new EmailService();

    // Dependance cachee 4 : Date globale
    const now = new Date();

    // Dependance cachee 5 : appel statique
    const total = PriceCalculator.compute(items, config.taxRate);

    const order = await db.insert('orders', { items, total, createdAt: now });
    await emailer.sendConfirmation(order);

    return order;
  }
}
```

Pour tester cette classe, il faut :
1. Mocker le module `./database` (vi.mock)
2. Mocker le singleton `AppConfig.getInstance` (vi.spyOn)
3. Mocker `EmailService` (vi.mock ou vi.spyOn sur le constructeur)
4. Mocker `Date` (vi.useFakeTimers)
5. Mocker `PriceCalculator.compute` (vi.spyOn)

Résultat : un test fragile, verbeux, qui teste surtout les mocks.

### Les causes profondes

| Cause | Symptome | Solution |
|-------|----------|----------|
| Dependances hardcodees | `new Service()`, `require()` | Injection de dépendances |
| État global | Singletons, variables globales | Passer l'état en paramètre |
| Méthodes statiques | `Utils.calculate()` | Fonctions pures injectables |
| I/O melangee à la logique | `fetch` dans un calcul | Separation couches |
| God class | 1 classe, 20 méthodes, 500 lignes | Single Responsibility |

---

## L'injection de dépendances

### Principe

Au lieu de créer ses dépendances, un objet les recoit de l'exterieur.

### Injection par constructeur

La forme la plus courante et la plus recommandee :

```typescript
// AVANT : dependances hardcodees
class UserService {
  private db = new PostgresDatabase();
  private emailer = new SmtpEmailService();
  private logger = new FileLogger();

  async register(name: string, email: string): Promise<User> {
    this.logger.info(`Registering ${email}`);
    const user = await this.db.insert('users', { name, email });
    await this.emailer.send(email, 'Welcome!', `Hello ${name}`);
    return user;
  }
}

// APRES : injection par constructeur
interface Database {
  insert(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
  findById(table: string, id: number): Promise<Record<string, unknown> | null>;
}

interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

interface Logger {
  info(message: string): void;
  error(message: string): void;
}

class UserService {
  constructor(
    private readonly db: Database,
    private readonly emailer: EmailService,
    private readonly logger: Logger
  ) {}

  async register(name: string, email: string): Promise<User> {
    this.logger.info(`Registering ${email}`);
    const user = await this.db.insert('users', { name, email }) as User;
    await this.emailer.send(email, 'Welcome!', `Hello ${name}`);
    return user;
  }
}
```

```typescript
// TEST : injection de mocks par constructeur
describe('UserService', () => {
  let service: UserService;
  let mockDb: Database;
  let mockEmailer: EmailService;
  let mockLogger: Logger;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@test.com' }),
      findById: vi.fn(),
    };
    mockEmailer = {
      send: vi.fn().mockResolvedValue(undefined),
    };
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    service = new UserService(mockDb, mockEmailer, mockLogger);
  });

  it('should register user and send welcome email', async () => {
    const user = await service.register('Alice', 'alice@test.com');

    expect(user).toEqual({ id: 1, name: 'Alice', email: 'alice@test.com' });
    expect(mockDb.insert).toHaveBeenCalledWith('users', { name: 'Alice', email: 'alice@test.com' });
    expect(mockEmailer.send).toHaveBeenCalledWith('alice@test.com', 'Welcome!', 'Hello Alice');
  });

  it('should log registration', async () => {
    await service.register('Alice', 'alice@test.com');
    expect(mockLogger.info).toHaveBeenCalledWith('Registering alice@test.com');
  });

  it('should propagate database errors', async () => {
    vi.mocked(mockDb.insert).mockRejectedValue(new Error('Connection lost'));

    await expect(service.register('Alice', 'alice@test.com')).rejects.toThrow('Connection lost');
    expect(mockEmailer.send).not.toHaveBeenCalled(); // email non envoye
  });
});
```

### Injection par paramètre

Pour les fonctions stateless, on injecte directement dans les paramètres :

```typescript
// AVANT
async function processPayment(orderId: number, amount: number): Promise<PaymentResult> {
  const gateway = new StripeGateway(); // hardcode
  const logger = getLogger();          // singleton
  // ...
}

// APRES
interface PaymentGateway {
  charge(amount: number, currency: string): Promise<ChargeResult>;
  refund(chargeId: string): Promise<void>;
}

async function processPayment(
  orderId: number,
  amount: number,
  deps: { gateway: PaymentGateway; logger: Logger }
): Promise<PaymentResult> {
  deps.logger.info(`Processing payment for order ${orderId}`);
  const charge = await deps.gateway.charge(amount, 'EUR');
  return { orderId, chargeId: charge.id, status: 'paid' };
}
```

```typescript
// TEST
it('should process payment successfully', async () => {
  const mockGateway: PaymentGateway = {
    charge: vi.fn().mockResolvedValue({ id: 'ch_123', status: 'succeeded' }),
    refund: vi.fn(),
  };
  const mockLogger: Logger = { info: vi.fn(), error: vi.fn() };

  const result = await processPayment(42, 99.99, {
    gateway: mockGateway,
    logger: mockLogger,
  });

  expect(result).toEqual({ orderId: 42, chargeId: 'ch_123', status: 'paid' });
  expect(mockGateway.charge).toHaveBeenCalledWith(99.99, 'EUR');
});
```

### Injection par factory

Utile quand on veut centraliser la création avec des valeurs par defaut :

```typescript
interface OrderServiceDeps {
  db: Database;
  emailer: EmailService;
  paymentGateway: PaymentGateway;
  logger: Logger;
  clock: { now: () => Date };
}

// Factory avec defauts pour la production
function createOrderService(overrides: Partial<OrderServiceDeps> = {}): OrderService {
  const deps: OrderServiceDeps = {
    db: overrides.db ?? new PostgresDatabase(),
    emailer: overrides.emailer ?? new SmtpEmailService(),
    paymentGateway: overrides.paymentGateway ?? new StripeGateway(),
    logger: overrides.logger ?? new ConsoleLogger(),
    clock: overrides.clock ?? { now: () => new Date() },
  };

  return new OrderService(deps);
}

// PRODUCTION
const orderService = createOrderService();

// TEST : ne surcharger que ce qui est necessaire
const orderService = createOrderService({
  db: mockDb,
  emailer: mockEmailer,
  clock: { now: () => new Date('2025-06-15T12:00:00Z') },
});
```

```typescript
// Exemple complet avec la factory
class OrderService {
  constructor(private readonly deps: OrderServiceDeps) {}

  async placeOrder(userId: number, items: CartItem[]): Promise<Order> {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await this.deps.db.insert('orders', {
      userId,
      items,
      total,
      createdAt: this.deps.clock.now(),
    }) as Order;

    await this.deps.paymentGateway.charge(total, 'EUR');
    await this.deps.emailer.send(
      `user-${userId}@example.com`,
      'Order Confirmation',
      `Your order #${order.id} for ${total}EUR has been placed.`
    );

    this.deps.logger.info(`Order ${order.id} placed for user ${userId}`);
    return order;
  }
}

describe('OrderService', () => {
  it('should place order with correct total', async () => {
    const mockDb: Database = {
      insert: vi.fn().mockResolvedValue({ id: 1, total: 250, userId: 1, items: [] }),
      findById: vi.fn(),
    };

    const service = createOrderService({
      db: mockDb,
      emailer: { send: vi.fn().mockResolvedValue(undefined) },
      paymentGateway: { charge: vi.fn().mockResolvedValue({ id: 'ch_1' }), refund: vi.fn() },
      clock: { now: () => new Date('2025-01-01') },
    });

    await service.placeOrder(1, [
      { productId: 1, price: 100, quantity: 2 },
      { productId: 2, price: 50, quantity: 1 },
    ]);

    expect(mockDb.insert).toHaveBeenCalledWith('orders', expect.objectContaining({
      total: 250,
      userId: 1,
    }));
  });
});
```

---

## Fonctions pures

### Definition

Une fonction pure :
1. Retourne toujours le même résultat pour les memes arguments
2. N'a aucun effet de bord (pas de mutation, pas d'I/O)

```typescript
// PURE — facile a tester, pas besoin de mock
function calculateDiscount(price: number, discountPercent: number): number {
  return price * (1 - discountPercent / 100);
}

function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  });
  return formatter.format(amount);
}

function validateEmail(email: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!email.includes('@')) errors.push('Missing @');
  if (!email.includes('.')) errors.push('Missing domain extension');
  if (email.length < 5) errors.push('Too short');
  return { valid: errors.length === 0, errors };
}
```

```typescript
// Tests de fonctions pures : simples, rapides, sans setup
describe('calculateDiscount', () => {
  it.each([
    [100, 10, 90],
    [200, 25, 150],
    [50, 0, 50],
    [50, 100, 0],
    [99.99, 50, 49.995],
  ])('price=%d, discount=%d%% => %d', (price, discount, expected) => {
    expect(calculateDiscount(price, discount)).toBeCloseTo(expected);
  });
});

describe('validateEmail', () => {
  it('should accept valid email', () => {
    expect(validateEmail('alice@example.com')).toEqual({ valid: true, errors: [] });
  });

  it('should reject email without @', () => {
    const result = validateEmail('aliceexample.com');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing @');
  });
});
```

### Extraire la logique pure de l'I/O

```typescript
// AVANT : logique et I/O melangees
async function getOrderSummary(orderId: number): Promise<string> {
  const order = await db.findById('orders', orderId);        // I/O
  const user = await db.findById('users', order.userId);     // I/O
  const items = order.items as CartItem[];

  // Logique pure melangee avec I/O
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = subtotal * 0.2;
  const total = subtotal + tax;

  const lines = items.map((i) => `${i.quantity}x ${i.name}: ${i.price}EUR`);
  return [
    `Order #${orderId} for ${user.name}`,
    ...lines,
    `Subtotal: ${subtotal}EUR`,
    `Tax (20%): ${tax}EUR`,
    `Total: ${total}EUR`,
  ].join('\n');
}

// APRES : separation logique pure / I/O
// 1. Logique pure (facile a tester)
interface OrderData {
  id: number;
  userName: string;
  items: CartItem[];
  taxRate: number;
}

function computeOrderTotals(items: CartItem[], taxRate: number) {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

function formatOrderSummary(data: OrderData): string {
  const { subtotal, tax, total } = computeOrderTotals(data.items, data.taxRate);
  const lines = data.items.map((i) => `${i.quantity}x ${i.name}: ${i.price}EUR`);
  return [
    `Order #${data.id} for ${data.userName}`,
    ...lines,
    `Subtotal: ${subtotal}EUR`,
    `Tax (${data.taxRate * 100}%): ${tax}EUR`,
    `Total: ${total}EUR`,
  ].join('\n');
}

// 2. Orchestration I/O (fine couche)
async function getOrderSummary(orderId: number): Promise<string> {
  const order = await db.findById('orders', orderId);
  const user = await db.findById('users', order.userId);
  return formatOrderSummary({
    id: orderId,
    userName: user.name,
    items: order.items,
    taxRate: 0.2,
  });
}
```

```typescript
// Tests PURS : zero mock
describe('computeOrderTotals', () => {
  it('should compute subtotal, tax and total', () => {
    const items = [
      { name: 'Book', price: 20, quantity: 2 },
      { name: 'Pen', price: 5, quantity: 3 },
    ];

    const result = computeOrderTotals(items, 0.2);

    expect(result.subtotal).toBe(55);
    expect(result.tax).toBeCloseTo(11);
    expect(result.total).toBeCloseTo(66);
  });
});

describe('formatOrderSummary', () => {
  it('should format summary with all details', () => {
    const summary = formatOrderSummary({
      id: 42,
      userName: 'Alice',
      items: [{ name: 'Book', price: 20, quantity: 1 }],
      taxRate: 0.2,
    });

    expect(summary).toContain('Order #42 for Alice');
    expect(summary).toContain('1x Book: 20EUR');
    expect(summary).toContain('Total: 24EUR');
  });
});
```

---

## SOLID sous l'angle de la testabilité

### S — Single Responsibility Principle

Une classe = une raison de changer = facile à tester en isolation.

```typescript
// MAUVAIS : OrderService fait tout
class OrderService {
  async placeOrder(data: OrderData): Promise<Order> {
    // Validation (responsabilite 1)
    if (!data.items.length) throw new Error('Empty cart');
    if (data.items.some((i) => i.quantity <= 0)) throw new Error('Invalid quantity');

    // Calcul du prix (responsabilite 2)
    const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = data.couponCode ? await this.lookupDiscount(data.couponCode) : 0;
    const total = subtotal * (1 - discount);

    // Persistence (responsabilite 3)
    const order = await this.db.insert('orders', { ...data, total });

    // Notification (responsabilite 4)
    await this.emailer.send(data.email, 'Confirmation', `Total: ${total}`);

    return order;
  }
}

// BON : une classe par responsabilite
class OrderValidator {
  validate(data: OrderData): ValidationResult {
    const errors: string[] = [];
    if (!data.items.length) errors.push('Empty cart');
    if (data.items.some((i) => i.quantity <= 0)) errors.push('Invalid quantity');
    return { valid: errors.length === 0, errors };
  }
}

class PriceCalculator {
  calculate(items: CartItem[], discount: number): PriceBreakdown {
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal * (1 - discount);
    return { subtotal, discount: subtotal * discount, total };
  }
}

class OrderRepository {
  constructor(private readonly db: Database) {}
  async save(order: Omit<Order, 'id'>): Promise<Order> {
    return this.db.insert('orders', order) as Promise<Order>;
  }
}

class OrderNotifier {
  constructor(private readonly emailer: EmailService) {}
  async notifyConfirmation(email: string, order: Order): Promise<void> {
    await this.emailer.send(email, 'Confirmation', `Total: ${order.total}`);
  }
}
```

Chaque classe se teste independamment, sans mock des autres.

### O — Open/Closed Principle

Ouvert a l'extension, ferme à la modification.

```typescript
// Strategie pattern pour les methodes de paiement
interface PaymentStrategy {
  process(amount: number): Promise<PaymentResult>;
}

class CreditCardPayment implements PaymentStrategy {
  async process(amount: number): Promise<PaymentResult> {
    // ... traitement carte
    return { method: 'card', amount, transactionId: 'tx_123' };
  }
}

class PayPalPayment implements PaymentStrategy {
  async process(amount: number): Promise<PaymentResult> {
    // ... traitement PayPal
    return { method: 'paypal', amount, transactionId: 'pp_456' };
  }
}

// Ajouter une methode de paiement = ajouter une classe, pas modifier PaymentProcessor
class PaymentProcessor {
  constructor(private readonly strategy: PaymentStrategy) {}

  async pay(amount: number): Promise<PaymentResult> {
    if (amount <= 0) throw new Error('Invalid amount');
    return this.strategy.process(amount);
  }
}
```

```typescript
// TEST : injecter n'importe quelle strategie
describe('PaymentProcessor', () => {
  it('should process payment with given strategy', async () => {
    const mockStrategy: PaymentStrategy = {
      process: vi.fn().mockResolvedValue({
        method: 'test',
        amount: 100,
        transactionId: 'tx_test',
      }),
    };

    const processor = new PaymentProcessor(mockStrategy);
    const result = await processor.pay(100);

    expect(result.transactionId).toBe('tx_test');
    expect(mockStrategy.process).toHaveBeenCalledWith(100);
  });

  it('should reject negative amounts', async () => {
    const mockStrategy: PaymentStrategy = { process: vi.fn() };
    const processor = new PaymentProcessor(mockStrategy);

    await expect(processor.pay(-10)).rejects.toThrow('Invalid amount');
    expect(mockStrategy.process).not.toHaveBeenCalled();
  });
});
```

### D — Dependency Inversion Principle

Dependre d'abstractions (interfaces), pas de concretions (classes).

```typescript
// MAUVAIS : depend de la concretion
class ReportGenerator {
  private storage = new S3Storage(); // depend de S3 !

  async generate(data: ReportData): Promise<string> {
    const report = this.format(data);
    const url = await this.storage.upload(report);
    return url;
  }
}

// BON : depend de l'abstraction
interface FileStorage {
  upload(content: string): Promise<string>;
  download(key: string): Promise<string>;
}

class ReportGenerator {
  constructor(private readonly storage: FileStorage) {}

  async generate(data: ReportData): Promise<string> {
    const report = this.format(data);
    const url = await this.storage.upload(report);
    return url;
  }
}

// En prod : new ReportGenerator(new S3Storage())
// En test : new ReportGenerator(mockStorage)
// En dev  : new ReportGenerator(new LocalFileStorage())
```

---

## Architecture hexagonale (Ports & Adapters)

### Le concept

```
          Adapters                  Core Domain               Adapters
          (driving)                (pure logic)              (driven)
         ┌──────────┐           ┌──────────────┐          ┌──────────┐
HTTP ───>│ REST      │──Port──>│  Use Cases    │──Port──>│ Postgres │
         │ Controller│          │  Entities     │          │ Adapter  │
         └──────────┘          │  Value Objects│          └──────────┘
         ┌──────────┐          │               │          ┌──────────┐
CLI ────>│ CLI      │──Port──>│               │──Port──>│ SMTP     │
         │ Adapter  │          │               │          │ Adapter  │
         └──────────┘          └──────────────┘          └──────────┘
```

- **Ports** = interfaces (abstractions)
- **Adapters** = implementations concretes
- **Core** = logique metier pure, ne connait que les ports

### Implementation

```typescript
// === PORTS (interfaces) ===

// Port entrant (driving)
interface PlaceOrderUseCase {
  execute(input: PlaceOrderInput): Promise<PlaceOrderOutput>;
}

// Ports sortants (driven)
interface OrderRepository {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
}

interface PaymentPort {
  charge(amount: number, currency: string): Promise<ChargeResult>;
}

interface NotificationPort {
  sendOrderConfirmation(email: string, order: Order): Promise<void>;
}
```

```typescript
// === CORE : Use Case (logique metier) ===

class PlaceOrderHandler implements PlaceOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly payment: PaymentPort,
    private readonly notifier: NotificationPort
  ) {}

  async execute(input: PlaceOrderInput): Promise<PlaceOrderOutput> {
    // Validation metier (logique pure)
    if (input.items.length === 0) {
      throw new DomainError('Cannot place empty order');
    }

    const total = input.items.reduce((s, i) => s + i.price * i.quantity, 0);
    if (total <= 0) {
      throw new DomainError('Order total must be positive');
    }

    // Orchestration via les ports
    const charge = await this.payment.charge(total, 'EUR');

    const order: Order = {
      id: crypto.randomUUID(),
      items: input.items,
      total,
      chargeId: charge.id,
      status: 'confirmed',
      createdAt: new Date(),
    };

    const savedOrder = await this.orderRepo.save(order);
    await this.notifier.sendOrderConfirmation(input.email, savedOrder);

    return { orderId: savedOrder.id, total, status: 'confirmed' };
  }
}
```

```typescript
// === ADAPTERS (implementations concretes) ===

// Adapter driven : Postgres
class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async save(order: Order): Promise<Order> {
    const result = await this.pool.query(
      'INSERT INTO orders (id, items, total, charge_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [order.id, JSON.stringify(order.items), order.total, order.chargeId, order.status]
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<Order | null> {
    const result = await this.pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  private mapRow(row: Record<string, unknown>): Order { /* ... */ }
}

// Adapter driven : Stripe
class StripePaymentAdapter implements PaymentPort {
  constructor(private readonly stripe: Stripe) {}

  async charge(amount: number, currency: string): Promise<ChargeResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
    });
    return { id: intent.id, status: intent.status };
  }
}
```

```typescript
// === TESTS : le coeur se teste avec des fakes/mocks ===

describe('PlaceOrderHandler', () => {
  let handler: PlaceOrderHandler;
  let mockRepo: OrderRepository;
  let mockPayment: PaymentPort;
  let mockNotifier: NotificationPort;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockImplementation(async (order) => order),
      findById: vi.fn(),
    };
    mockPayment = {
      charge: vi.fn().mockResolvedValue({ id: 'ch_123', status: 'succeeded' }),
    };
    mockNotifier = {
      sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
    };

    handler = new PlaceOrderHandler(mockRepo, mockPayment, mockNotifier);
  });

  it('should place order with correct total', async () => {
    const result = await handler.execute({
      email: 'alice@test.com',
      items: [
        { name: 'Book', price: 25, quantity: 2 },
        { name: 'Pen', price: 5, quantity: 3 },
      ],
    });

    expect(result.total).toBe(65); // 50 + 15
    expect(result.status).toBe('confirmed');
    expect(mockPayment.charge).toHaveBeenCalledWith(65, 'EUR');
  });

  it('should reject empty order', async () => {
    await expect(handler.execute({
      email: 'alice@test.com',
      items: [],
    })).rejects.toThrow('Cannot place empty order');

    expect(mockPayment.charge).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should send confirmation notification', async () => {
    await handler.execute({
      email: 'alice@test.com',
      items: [{ name: 'Book', price: 25, quantity: 1 }],
    });

    expect(mockNotifier.sendOrderConfirmation).toHaveBeenCalledWith(
      'alice@test.com',
      expect.objectContaining({ total: 25, status: 'confirmed' })
    );
  });
});
```

---

## Le pattern Repository

### Interface

```typescript
interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<boolean>;
}

interface UserRepository extends Repository<User, number> {
  findByEmail(email: string): Promise<User | null>;
  findActiveUsers(): Promise<User[]>;
}
```

### Fake repository pour les tests

```typescript
class FakeUserRepository implements UserRepository {
  private store = new Map<number, User>();
  private nextId = 1;

  async findById(id: number): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findActiveUsers(): Promise<User[]> {
    return [...this.store.values()].filter((u) => u.active);
  }

  async findAll(): Promise<User[]> {
    return [...this.store.values()];
  }

  async save(user: User): Promise<User> {
    const saved = { ...user, id: user.id || this.nextId++ };
    this.store.set(saved.id, saved);
    return saved;
  }

  async delete(id: number): Promise<boolean> {
    return this.store.delete(id);
  }

  // Helper pour les tests
  seed(users: User[]): void {
    for (const user of users) {
      this.store.set(user.id, user);
      if (user.id >= this.nextId) this.nextId = user.id + 1;
    }
  }
}
```

```typescript
describe('User registration with FakeRepository', () => {
  let repo: FakeUserRepository;
  let service: RegistrationService;

  beforeEach(() => {
    repo = new FakeUserRepository();
    service = new RegistrationService(repo);
  });

  it('should register a new user', async () => {
    const user = await service.register({ name: 'Alice', email: 'alice@test.com' });

    expect(user.id).toBeDefined();
    expect(user.name).toBe('Alice');

    // Verifier dans le repo
    const found = await repo.findById(user.id);
    expect(found).toEqual(user);
  });

  it('should reject duplicate email', async () => {
    repo.seed([{ id: 1, name: 'Alice', email: 'alice@test.com', active: true }]);

    await expect(
      service.register({ name: 'Bob', email: 'alice@test.com' })
    ).rejects.toThrow('Email already registered');
  });
});
```

---

## Le pattern Service Layer

```typescript
// Service : orchestre la logique metier, delegue l'I/O aux repositories/ports
class RegistrationService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly emailer: NotificationPort,
    private readonly hasher: { hash: (password: string) => Promise<string> }
  ) {}

  async register(input: RegisterInput): Promise<User> {
    // Validation
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new ConflictError('Email already registered');

    // Logique metier
    const hashedPassword = await this.hasher.hash(input.password);
    const user: User = {
      id: 0, // auto-generated
      name: input.name,
      email: input.email,
      password: hashedPassword,
      active: true,
      createdAt: new Date(),
    };

    // Persistence
    const saved = await this.userRepo.save(user);

    // Side effect
    await this.emailer.sendOrderConfirmation(input.email, saved as unknown as Order);

    return saved;
  }
}
```

---

## Anti-patterns et refactoring

### 1. God class

```typescript
// MAUVAIS : une classe qui fait tout
class AppManager {
  async handleUserRegistration(data: any) { /* ... */ }
  async processOrder(data: any) { /* ... */ }
  async generateReport(type: string) { /* ... */ }
  async sendNewsletter(template: string) { /* ... */ }
  async backupDatabase() { /* ... */ }
  async clearCache() { /* ... */ }
  // ... 30 autres methodes
}

// BON : separer en services dedies
class UserService { /* registration, profile, auth */ }
class OrderService { /* place, cancel, refund */ }
class ReportService { /* generate, export */ }
class NewsletterService { /* compose, send */ }
```

### 2. Dependances cachees (hidden dependencies)

```typescript
// MAUVAIS : dependances non visibles dans la signature
function calculateShipping(order: Order): number {
  const config = Config.getInstance();           // Hidden !
  const rates = ShippingRates.getLatest();       // Hidden !
  const geoService = new GeocodingService();     // Hidden !

  const distance = geoService.getDistance(order.address);
  return distance * rates[order.shippingMethod] * config.shippingMultiplier;
}

// BON : tout est visible dans la signature
interface ShippingDeps {
  rates: Record<string, number>;
  multiplier: number;
  getDistance: (address: Address) => number;
}

function calculateShipping(order: Order, deps: ShippingDeps): number {
  const distance = deps.getDistance(order.address);
  return distance * deps.rates[order.shippingMethod] * deps.multiplier;
}
```

### 3. Méthodes statiques avec état

```typescript
// MAUVAIS : statique avec etat global
class Analytics {
  private static instance: Analytics;
  private events: AnalyticsEvent[] = [];

  static track(event: string, data: Record<string, unknown>): void {
    Analytics.getInstance().events.push({ event, data, timestamp: Date.now() });
  }

  // Impossible a tester proprement : etat partage entre tests !
}

// BON : instance injectable
class AnalyticsService {
  private events: AnalyticsEvent[] = [];

  track(event: string, data: Record<string, unknown>): void {
    this.events.push({ event, data, timestamp: Date.now() });
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
}

// Chaque test cree sa propre instance — isolation parfaite
```

---

## Exemple complet : refactoring d'un OrderService couple

### AVANT : code difficile à tester

```typescript
// src/services/order-service-v1.ts
import { pool } from '../database/connection';
import { StripeClient } from '../payments/stripe';
import { Mailer } from '../email/mailer';

export class OrderServiceV1 {
  async placeOrder(userId: number, items: CartItem[]): Promise<void> {
    // Validation + calcul (melange)
    if (items.length === 0) throw new Error('Empty cart');
    let total = 0;
    for (const item of items) {
      const product = await pool.query('SELECT price FROM products WHERE id = $1', [item.productId]);
      if (!product.rows[0]) throw new Error(`Product ${item.productId} not found`);
      total += product.rows[0].price * item.quantity;
    }

    // Paiement (dependance directe)
    const stripe = new StripeClient(process.env.STRIPE_SECRET_KEY!);
    await stripe.charge(total * 100, 'eur');

    // Persistence (dependance directe)
    await pool.query(
      'INSERT INTO orders (user_id, items, total, created_at) VALUES ($1, $2, $3, NOW())',
      [userId, JSON.stringify(items), total]
    );

    // Notification (dependance directe)
    const user = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const mailer = new Mailer();
    await mailer.send(user.rows[0].email, 'Order Confirmation', `Your total: ${total}EUR`);
  }
}
```

### APRES : code testable

```typescript
// === Interfaces (Ports) ===

interface ProductCatalog {
  getPrice(productId: number): Promise<number>;
}

interface OrderStore {
  save(order: OrderData): Promise<{ id: number }>;
}

interface PaymentProcessor {
  charge(amountCents: number, currency: string): Promise<{ chargeId: string }>;
}

interface Notifier {
  notify(email: string, subject: string, body: string): Promise<void>;
}

interface UserDirectory {
  getEmail(userId: number): Promise<string>;
}
```

```typescript
// === Logique pure ===

function computeTotal(prices: { price: number; quantity: number }[]): number {
  return prices.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function formatConfirmationBody(total: number): string {
  return `Your total: ${total}EUR. Thank you for your order!`;
}
```

```typescript
// === Service refactore ===

interface OrderServiceDeps {
  catalog: ProductCatalog;
  store: OrderStore;
  payment: PaymentProcessor;
  notifier: Notifier;
  users: UserDirectory;
}

class OrderServiceV2 {
  constructor(private readonly deps: OrderServiceDeps) {}

  async placeOrder(userId: number, items: CartItem[]): Promise<{ orderId: number; total: number }> {
    if (items.length === 0) throw new Error('Empty cart');

    // Recuperer les prix via le port
    const priced = await Promise.all(
      items.map(async (item) => ({
        price: await this.deps.catalog.getPrice(item.productId),
        quantity: item.quantity,
      }))
    );

    // Logique pure
    const total = computeTotal(priced);

    // Paiement via le port
    await this.deps.payment.charge(total * 100, 'eur');

    // Persistence via le port
    const { id: orderId } = await this.deps.store.save({ userId, items, total });

    // Notification via le port
    const email = await this.deps.users.getEmail(userId);
    await this.deps.notifier.notify(email, 'Order Confirmation', formatConfirmationBody(total));

    return { orderId, total };
  }
}
```

```typescript
// === Tests ===

describe('OrderServiceV2', () => {
  let service: OrderServiceV2;
  let deps: OrderServiceDeps;

  beforeEach(() => {
    deps = {
      catalog: {
        getPrice: vi.fn().mockImplementation(async (id: number) => {
          const prices: Record<number, number> = { 1: 25, 2: 10, 3: 50 };
          if (!prices[id]) throw new Error(`Product ${id} not found`);
          return prices[id];
        }),
      },
      store: {
        save: vi.fn().mockResolvedValue({ id: 42 }),
      },
      payment: {
        charge: vi.fn().mockResolvedValue({ chargeId: 'ch_123' }),
      },
      notifier: {
        notify: vi.fn().mockResolvedValue(undefined),
      },
      users: {
        getEmail: vi.fn().mockResolvedValue('alice@test.com'),
      },
    };

    service = new OrderServiceV2(deps);
  });

  it('should calculate total from catalog prices', async () => {
    const result = await service.placeOrder(1, [
      { productId: 1, quantity: 2 }, // 25 * 2 = 50
      { productId: 2, quantity: 3 }, // 10 * 3 = 30
    ]);

    expect(result.total).toBe(80);
  });

  it('should charge the correct amount in cents', async () => {
    await service.placeOrder(1, [{ productId: 1, quantity: 1 }]);

    expect(deps.payment.charge).toHaveBeenCalledWith(2500, 'eur'); // 25 * 100
  });

  it('should save order with all data', async () => {
    const items = [{ productId: 1, quantity: 2 }];
    await service.placeOrder(7, items);

    expect(deps.store.save).toHaveBeenCalledWith({
      userId: 7,
      items,
      total: 50,
    });
  });

  it('should notify user by email', async () => {
    await service.placeOrder(1, [{ productId: 3, quantity: 1 }]);

    expect(deps.users.getEmail).toHaveBeenCalledWith(1);
    expect(deps.notifier.notify).toHaveBeenCalledWith(
      'alice@test.com',
      'Order Confirmation',
      expect.stringContaining('50EUR')
    );
  });

  it('should reject empty cart', async () => {
    await expect(service.placeOrder(1, [])).rejects.toThrow('Empty cart');

    expect(deps.payment.charge).not.toHaveBeenCalled();
    expect(deps.store.save).not.toHaveBeenCalled();
  });

  it('should propagate catalog errors', async () => {
    await expect(
      service.placeOrder(1, [{ productId: 999, quantity: 1 }])
    ).rejects.toThrow('Product 999 not found');

    expect(deps.payment.charge).not.toHaveBeenCalled();
  });

  it('should not save order if payment fails', async () => {
    vi.mocked(deps.payment.charge).mockRejectedValue(new Error('Card declined'));

    await expect(
      service.placeOrder(1, [{ productId: 1, quantity: 1 }])
    ).rejects.toThrow('Card declined');

    expect(deps.store.save).not.toHaveBeenCalled();
    expect(deps.notifier.notify).not.toHaveBeenCalled();
  });
});

// Tests de la logique pure — zero mock
describe('computeTotal', () => {
  it.each([
    [[], 0],
    [[{ price: 10, quantity: 1 }], 10],
    [[{ price: 10, quantity: 3 }, { price: 5, quantity: 2 }], 40],
    [[{ price: 0.1, quantity: 3 }], 0.30000000000000004], // floating point
  ])('should compute total for %j => %d', (items, expected) => {
    expect(computeTotal(items)).toBeCloseTo(expected, 10);
  });
});
```

---

## Checklist : mon code est-il testable ?

Avant d'écrire un test, verifiez :

- [ ] Les dépendances sont-elles injectees (pas de `new` ou `import` d'I/O dans la logique) ?
- [ ] La logique pure est-elle separee des effets de bord ?
- [ ] Chaque classe/fonction a-t-elle une seule responsabilite ?
- [ ] Les interfaces sont-elles definies pour les dépendances externes ?
- [ ] Le code evite-t-il les singletons et l'état global ?
- [ ] Les fonctions sont-elles déterministes (même entree = même sortie) ?
- [ ] Les méthodes statiques sont-elles limitees aux utilitaires purs ?

Si une de ces cases n'est pas cochee, considerez un refactoring **avant** d'écrire le test.

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [05 - Tests asynchrones](./05-tests-asynchrones) | [07 - Tests de composants](./07-tests-de-composants) |

---

## Ressources

- [Quiz 06 : Testez vos connaissances](../quizzes/quiz-06-architecture.html)
- [Lab 06 : Architecture testable](../labs/lab-06-architecture-testable/)
- Martin Fowler — [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html)
- Alistair Cockburn — [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- Robert C. Martin — [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- Mark Seemann — [Dependency Injection in .NET](https://www.manning.com/books/dependency-injection-principles-practices-patterns) (principes applicables a tout langage)

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 06 architecture](../screencasts/screencast-06-architecture.md)
2. **Lab** : [lab-06-architecture-testable](../labs/lab-06-architecture-testable/README)
3. **Quiz** : [quiz 06 architecture](../quizzes/quiz-06-architecture.html)
:::
