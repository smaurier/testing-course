# Module 09 — Tests d'intégration

| Difficulte | Duree estimee | Lab                                         | Quiz                                           |
| ---------- | ------------- | ------------------------------------------- | ---------------------------------------------- |
| 4/5        | 90 min        | [Lab 09](../labs/lab-09-tests-integration/) | [Quiz 09](../quizzes/quiz-09-integration.html) |

## Objectifs

- Définir clairement les limites d'un test d'intégration
- Tester des API Express/Fastify avec supertest
- Tester l'intégration base de donnees avec setup/teardown propres
- Combiner composant + store + router + API (MSW) cote frontend
- Gérer les fixtures avec des factories et des builders
- Utiliser Docker et Testcontainers pour des environnements reproductibles
- Éviter les pieges classiques : lenteur, flakiness, état partage

---

## Definition et limites

### Ou se situe le test d'intégration ?

```
        Unite            Integration            E2E
    ┌──────────┐     ┌──────────────┐     ┌──────────┐
    │ Fonction │     │ Service +    │     │ Browser  │
    │ pure     │     │ DB + API     │     │ reel     │
    │          │     │              │     │ full app │
    └──────────┘     └──────────────┘     └──────────┘
     Isole            2+ modules            Tout le
     Rapide           ensemble              systeme
     Pas de I/O       I/O reelles           Lent
```

### Qu'est-ce qu'un test d'intégration ?

Un test d'intégration vérifié que **deux ou plusieurs modules** fonctionnent correctement **ensemble**. Contrairement aux tests unitaires, il inclut au moins une dépendance réelle (base de donnees, API HTTP, système de fichiers, etc.).

| Critere             | Test unitaire     | Test d'intégration  | Test E2E            |
| ------------------- | ----------------- | ------------------- | ------------------- |
| Scope               | 1 fonction/classe | 2+ modules ensemble | Application entière |
| Dependances         | Toutes mockees    | Certaines reelles   | Toutes reelles      |
| Base de donnees     | Mockee            | Reelle (test DB)    | Reelle (staging)    |
| Réseau              | Mocke             | Reel ou MSW         | Reel                |
| Vitesse             | < 10ms            | 50ms - 2s           | 5s - 30s            |
| Confiance           | Moyenne           | Elevee              | Très elevee         |
| Cout de maintenance | Faible            | Moyen               | Eleve               |

### Ce qu'un test d'intégration couvre

```typescript
// Test unitaire : une seule fonction
function calculateDiscount(price: number, percentage: number): number {
  return price * (1 - percentage / 100);
}
// Test : calculateDiscount(100, 20) === 80 ✓

// Test d'integration : service + repository + database
// On teste que le service appelle le repository,
// qui execute la bonne requete SQL,
// qui retourne les bonnes donnees transformees
class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly discountService: DiscountService,
    private readonly emailService: EmailService,
  ) {}

  async createOrder(items: OrderItem[], userId: string): Promise<Order> {
    const discount = await this.discountService.getForUser(userId);
    const order = Order.create(items, discount);
    const saved = await this.orderRepo.save(order);
    await this.emailService.sendConfirmation(userId, saved);
    return saved;
  }
}

// Test d'integration : OrderService + OrderRepository + vraie DB
// EmailService reste mocke (effet de bord externe)
```

---

## Tests d'API avec Supertest

### Configuration de base

```typescript
// src/app.ts — l'application Express sans demarrer le serveur
import express from "express";
import { userRouter } from "./routes/userRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";

export function createApp(): express.Application {
  const app = express();

  app.use(express.json());
  app.use("/api/users", authMiddleware, userRouter);
  app.use(errorHandler);

  return app;
}
```

```typescript
// src/routes/userRoutes.ts
import { Router, type Request, type Response } from "express";
import { UserService } from "../services/UserService";

export function createUserRouter(userService: UserService): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    const users = await userService.findAll();
    res.json({ users, total: users.length });
  });

  router.get("/:id", async (req: Request, res: Response) => {
    const user = await userService.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  });

  router.post("/", async (req: Request, res: Response) => {
    const { name, email } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }

    const user = await userService.create({ name, email });
    res.status(201).json(user);
  });

  router.put("/:id", async (req: Request, res: Response) => {
    const updated = await userService.update(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated);
  });

  router.delete("/:id", async (req: Request, res: Response) => {
    const deleted = await userService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(204).send();
  });

  return router;
}
```

### Tests avec Supertest

```typescript
// src/__tests__/integration/users.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { Database } from "../../database";
import { UserService } from "../../services/UserService";
import { UserRepository } from "../../repositories/UserRepository";

describe("User API — Integration Tests", () => {
  let app: ReturnType<typeof createApp>;
  let db: Database;
  let authToken: string;

  beforeAll(async () => {
    // Connexion a la base de test
    db = new Database({
      host: "localhost",
      port: 5433, // Port dedie pour les tests
      database: "testdb",
      user: "test",
      password: "test",
    });
    await db.connect();
    await db.migrate();

    // Creer l'application avec les vrais services
    const userRepo = new UserRepository(db);
    const userService = new UserService(userRepo);
    app = createApp(userService);

    // Obtenir un token de test
    authToken = "Bearer test-token-123";
  });

  beforeEach(async () => {
    // Nettoyer les tables avant chaque test
    await db.query("DELETE FROM users");
    // Inserer des donnees de base
    await db.query(`
      INSERT INTO users (id, name, email, created_at) VALUES
      ('u1', 'Alice Martin', 'alice@example.com', NOW()),
      ('u2', 'Bob Dupont', 'bob@example.com', NOW())
    `);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  // --- GET /api/users ---

  describe("GET /api/users", () => {
    it("should return all users", async () => {
      const response = await request(app)
        .get("/api/users")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.users[0]).toMatchObject({
        name: "Alice Martin",
        email: "alice@example.com",
      });
    });

    it("should return 401 without auth token", async () => {
      await request(app).get("/api/users").expect(401);
    });
  });

  // --- GET /api/users/:id ---

  describe("GET /api/users/:id", () => {
    it("should return user by id", async () => {
      const response = await request(app)
        .get("/api/users/u1")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        id: "u1",
        name: "Alice Martin",
        email: "alice@example.com",
      });
    });

    it("should return 404 for unknown user", async () => {
      const response = await request(app)
        .get("/api/users/unknown-id")
        .set("Authorization", authToken)
        .expect(404);

      expect(response.body.error).toBe("User not found");
    });
  });

  // --- POST /api/users ---

  describe("POST /api/users", () => {
    it("should create a new user", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", authToken)
        .send({ name: "Charlie Durand", email: "charlie@example.com" })
        .expect(201);

      expect(response.body).toMatchObject({
        name: "Charlie Durand",
        email: "charlie@example.com",
      });
      expect(response.body.id).toBeDefined();

      // Verifier en base
      const dbUser = await db.query("SELECT * FROM users WHERE email = $1", [
        "charlie@example.com",
      ]);
      expect(dbUser.rows).toHaveLength(1);
    });

    it("should return 400 for missing required fields", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", authToken)
        .send({ name: "Charlie" }) // email manquant
        .expect(400);

      expect(response.body.error).toBe("Name and email are required");
    });

    it("should return 409 for duplicate email", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", authToken)
        .send({ name: "Alice Clone", email: "alice@example.com" })
        .expect(409);

      expect(response.body.error).toContain("already exists");
    });
  });

  // --- PUT /api/users/:id ---

  describe("PUT /api/users/:id", () => {
    it("should update an existing user", async () => {
      const response = await request(app)
        .put("/api/users/u1")
        .set("Authorization", authToken)
        .send({ name: "Alice Martin-Dupont" })
        .expect(200);

      expect(response.body.name).toBe("Alice Martin-Dupont");
      expect(response.body.email).toBe("alice@example.com"); // Inchange
    });

    it("should return 404 for unknown user", async () => {
      await request(app)
        .put("/api/users/unknown-id")
        .set("Authorization", authToken)
        .send({ name: "Ghost" })
        .expect(404);
    });
  });

  // --- DELETE /api/users/:id ---

  describe("DELETE /api/users/:id", () => {
    it("should delete an existing user", async () => {
      await request(app)
        .delete("/api/users/u1")
        .set("Authorization", authToken)
        .expect(204);

      // Verifier en base
      const dbUser = await db.query("SELECT * FROM users WHERE id = $1", [
        "u1",
      ]);
      expect(dbUser.rows).toHaveLength(0);
    });

    it("should return 404 for unknown user", async () => {
      await request(app)
        .delete("/api/users/unknown-id")
        .set("Authorization", authToken)
        .expect(404);
    });
  });
});
```

---

## Tests d'intégration base de donnees

### Setup et teardown

```typescript
// test/helpers/database.ts
import { Pool, type PoolConfig } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

export class TestDatabase {
  private pool: Pool;

  constructor(config?: Partial<PoolConfig>) {
    this.pool = new Pool({
      host: process.env.TEST_DB_HOST ?? "localhost",
      port: Number(process.env.TEST_DB_PORT ?? 5433),
      database: process.env.TEST_DB_NAME ?? "testdb",
      user: process.env.TEST_DB_USER ?? "test",
      password: process.env.TEST_DB_PASSWORD ?? "test",
      max: 5,
      ...config,
    });
  }

  async setup(): Promise<void> {
    // Executer les migrations
    const migrationSQL = readFileSync(
      join(__dirname, "../../migrations/001_init.sql"),
      "utf-8",
    );
    await this.pool.query(migrationSQL);
  }

  async teardown(): Promise<void> {
    // Supprimer toutes les tables
    await this.pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
    `);
    await this.pool.end();
  }

  async clean(): Promise<void> {
    // Nettoyer les donnees entre les tests sans supprimer le schema
    const tables = await this.pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename != 'migrations'
    `);

    for (const { tablename } of tables.rows) {
      await this.pool.query(`TRUNCATE TABLE ${tablename} CASCADE`);
    }
  }

  async seed(fixtures: Record<string, unknown[]>): Promise<void> {
    for (const [table, rows] of Object.entries(fixtures)) {
      for (const row of rows) {
        const columns = Object.keys(row as Record<string, unknown>);
        const values = Object.values(row as Record<string, unknown>);
        const placeholders = values.map((_, i) => `$${i + 1}`);

        await this.pool.query(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
          values,
        );
      }
    }
  }

  getPool(): Pool {
    return this.pool;
  }
}
```

### Pattern : transaction rollback

Au lieu de nettoyer les donnees après chaque test, on peut encapsuler chaque test dans une transaction qu'on annule ensuite. C'est beaucoup plus rapide.

```typescript
// test/helpers/transactional.ts
import { type Pool, type PoolClient } from "pg";

export class TransactionalTestContext {
  private client: PoolClient | null = null;

  constructor(private readonly pool: Pool) {}

  async begin(): Promise<PoolClient> {
    this.client = await this.pool.connect();
    await this.client.query("BEGIN");

    // Creer un savepoint pour pouvoir rollback partiellement si besoin
    await this.client.query("SAVEPOINT test_start");

    return this.client;
  }

  async rollback(): Promise<void> {
    if (this.client) {
      await this.client.query("ROLLBACK");
      this.client.release();
      this.client = null;
    }
  }
}
```

```typescript
// Usage dans les tests
describe("OrderRepository — integration", () => {
  let testDb: TestDatabase;
  let txContext: TransactionalTestContext;
  let client: PoolClient;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
  });

  beforeEach(async () => {
    txContext = new TransactionalTestContext(testDb.getPool());
    client = await txContext.begin();

    // Inserer les fixtures dans la transaction
    await client.query(`
      INSERT INTO users (id, name, email) VALUES
      ('u1', 'Alice', 'alice@test.com')
    `);
  });

  afterEach(async () => {
    // Annuler la transaction — aucune donnee n'est commitee
    await txContext.rollback();
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  it("should create an order linked to a user", async () => {
    const repo = new OrderRepository(client); // Utiliser le client transactionnel

    const order = await repo.create({
      userId: "u1",
      items: [{ productId: "p1", quantity: 2, unitPrice: 29.99 }],
    });

    expect(order.id).toBeDefined();
    expect(order.userId).toBe("u1");
    expect(order.totalAmount).toBe(59.98);

    // Verifier en base (dans la meme transaction)
    const result = await client.query("SELECT * FROM orders WHERE id = $1", [
      order.id,
    ]);
    expect(result.rows).toHaveLength(1);
  });

  // Apres ce test, ROLLBACK — la base est propre pour le test suivant
});
```

---

## Intégration frontend : composant + store + router + API

### Configuration complete avec Pinia + Vue Router + MSW

```typescript
// test/helpers/renderWithProviders.ts
import { render, type RenderOptions } from "@testing-library/vue";
import { createTestingPinia, type TestingOptions } from "@pinia/testing";
import {
  createRouter,
  createMemoryHistory,
  type RouteRecordRaw,
} from "vue-router";
import { type Component } from "vue";

interface RenderWithProvidersOptions {
  piniaOptions?: TestingOptions;
  routes?: RouteRecordRaw[];
  initialRoute?: string;
  renderOptions?: Omit<RenderOptions, "global">;
}

export function renderWithProviders(
  component: Component,
  options: RenderWithProvidersOptions = {},
) {
  const {
    piniaOptions = {},
    routes = [{ path: "/", component: { template: "<div />" } }],
    initialRoute = "/",
    renderOptions = {},
  } = options;

  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  });

  // Naviguer a la route initiale
  router.push(initialRoute);

  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false, // Actions reelles pour les tests d'integration
    ...piniaOptions,
  });

  return {
    ...render(component, {
      ...renderOptions,
      global: {
        plugins: [pinia, router],
      },
    }),
    router,
    pinia,
  };
}
```

### Test d'intégration frontend complet

```typescript
// features/products/__tests__/ProductPage.integration.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { renderWithProviders } from "../../../../test/helpers/renderWithProviders";
import ProductPage from "../ProductPage.vue";
import CartSummary from "../../cart/CartSummary.vue";
import AppLayout from "../../../layouts/AppLayout.vue";

// Routes de l'application
const routes = [
  { path: "/", component: { template: "<div>Home</div>" } },
  { path: "/products", component: ProductPage },
  { path: "/products/:id", component: ProductPage },
  { path: "/cart", component: CartSummary },
];

describe("ProductPage — integration", () => {
  beforeEach(() => {
    // Handlers par defaut (happy path)
    server.use(
      http.get("/api/products", () => {
        return HttpResponse.json({
          products: [
            { id: "p1", name: "Clavier", price: 129.99, stock: 5 },
            { id: "p2", name: "Souris", price: 79.99, stock: 0 },
          ],
        });
      }),
      http.post("/api/cart/items", async ({ request }) => {
        const body = (await request.json()) as {
          productId: string;
          quantity: number;
        };
        return HttpResponse.json(
          {
            id: "ci1",
            productId: body.productId,
            quantity: body.quantity,
            addedAt: new Date().toISOString(),
          },
          { status: 201 },
        );
      }),
      http.get("/api/cart", () => {
        return HttpResponse.json({
          items: [{ id: "ci1", productId: "p1", quantity: 1, price: 129.99 }],
          total: 129.99,
          itemCount: 1,
        });
      }),
    );
  });

  it("should display products and add to cart", async () => {
    const user = userEvent.setup();

    renderWithProviders(AppLayout, {
      routes,
      initialRoute: "/products",
    });

    // Attendre le chargement des produits
    expect(await screen.findByText("Clavier")).toBeTruthy();
    expect(screen.getByText("129,99 €")).toBeTruthy();

    // Le bouton "Ajouter au panier" pour la souris doit etre desactive (stock 0)
    const addButtons = screen.getAllByRole("button", {
      name: /ajouter au panier/i,
    });
    expect(addButtons[1]).toBeDisabled(); // Souris en rupture

    // Ajouter le clavier au panier
    await user.click(addButtons[0]);

    // Verifier le feedback
    expect(await screen.findByText(/ajoute au panier/i)).toBeTruthy();

    // Le compteur du panier dans le header doit se mettre a jour
    await waitFor(() => {
      expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    });
  });

  it("should handle API error gracefully", async () => {
    server.use(
      http.get("/api/products", () => {
        return HttpResponse.json(
          { error: "Service unavailable" },
          { status: 503 },
        );
      }),
    );

    renderWithProviders(AppLayout, {
      routes,
      initialRoute: "/products",
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /impossible de charger les produits/i,
    );

    // Bouton de retry
    expect(screen.getByRole("button", { name: /reessayer/i })).toBeTruthy();
  });

  it("should navigate to cart after adding item", async () => {
    const user = userEvent.setup();

    const { router } = renderWithProviders(AppLayout, {
      routes,
      initialRoute: "/products",
    });

    await screen.findByText("Clavier");

    // Ajouter au panier
    const addButton = screen.getAllByRole("button", {
      name: /ajouter au panier/i,
    })[0];
    await user.click(addButton);

    // Cliquer sur "Voir le panier" dans la notification
    await user.click(
      await screen.findByRole("link", { name: /voir le panier/i }),
    );

    // Verifier la navigation
    await waitFor(() => {
      expect(router.currentRoute.value.path).toBe("/cart");
    });
  });
});
```

---

## Docker et Testcontainers

### Testcontainers pour Node.js

Testcontainers demarre automatiquement des conteneurs Docker pour vos tests.

```typescript
// test/helpers/testcontainers.ts
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";

let container: StartedPostgreSqlContainer;
let pool: Pool;

export async function startPostgresContainer(): Promise<{
  pool: Pool;
  connectionString: string;
}> {
  container = await new PostgreSqlContainer("postgres:17-alpine")
    .withDatabase("testdb")
    .withUsername("test")
    .withPassword("test")
    .withExposedPorts(5432)
    .start();

  const connectionString = container.getConnectionUri();

  pool = new Pool({ connectionString });

  // Executer les migrations
  const migrations = readFileSync(
    join(__dirname, "../../migrations/001_init.sql"),
    "utf-8",
  );
  await pool.query(migrations);

  return { pool, connectionString };
}

export async function stopPostgresContainer(): Promise<void> {
  await pool.end();
  await container.stop();
}

export function getPool(): Pool {
  return pool;
}
```

```typescript
// test/integration/withTestcontainers.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startPostgresContainer,
  stopPostgresContainer,
  getPool,
} from "../helpers/testcontainers";
import { UserRepository } from "../../src/repositories/UserRepository";

describe("UserRepository — with Testcontainers", () => {
  beforeAll(async () => {
    await startPostgresContainer();
  }, 60_000); // Timeout de 60s pour le demarrage du container

  afterAll(async () => {
    await stopPostgresContainer();
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query("TRUNCATE TABLE users CASCADE");
  });

  it("should insert and retrieve a user", async () => {
    const repo = new UserRepository(getPool());

    const created = await repo.create({
      name: "Alice",
      email: "alice@test.com",
    });

    expect(created.id).toBeDefined();

    const found = await repo.findById(created.id);
    expect(found).toMatchObject({
      name: "Alice",
      email: "alice@test.com",
    });
  });

  it("should enforce unique email constraint", async () => {
    const repo = new UserRepository(getPool());

    await repo.create({ name: "Alice", email: "alice@test.com" });

    await expect(
      repo.create({ name: "Alice Clone", email: "alice@test.com" }),
    ).rejects.toThrow(/unique/i);
  });
});
```

### Docker Compose pour les tests

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: testdb
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data # RAM disk = plus rapide
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d testdb"]
      interval: 2s
      timeout: 5s
      retries: 10

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
```

```json
// package.json — scripts
{
  "scripts": {
    "test:integration": "docker compose -f docker-compose.test.yml up -d --wait && vitest run --config vitest.integration.config.ts; docker compose -f docker-compose.test.yml down",
    "test:integration:watch": "docker compose -f docker-compose.test.yml up -d --wait && vitest --config vitest.integration.config.ts"
  }
}
```

---

## Fixture management : factories et builders

### Factory pattern

```typescript
// test/factories/userFactory.ts
import { type User } from "../../src/types";

let idCounter = 0;

function nextId(): string {
  idCounter++;
  return `user-${idCounter}`;
}

export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: nextId(),
    name: "John Doe",
    email: `john-${idCounter}@example.com`,
    role: "user",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    isActive: true,
    ...overrides,
  };
}

// Usage dans les tests
const admin = createUser({ name: "Admin", role: "admin" });
const inactiveUser = createUser({ isActive: false });
const users = Array.from({ length: 10 }, () => createUser());
```

### Builder pattern

```typescript
// test/factories/orderBuilder.ts
import { type Order, type OrderItem, type OrderStatus } from "../../src/types";

export class OrderBuilder {
  private order: Order;

  constructor() {
    this.order = {
      id: `order-${Date.now()}`,
      userId: "default-user",
      items: [],
      status: "pending",
      totalAmount: 0,
      createdAt: new Date(),
      shippingAddress: null,
      notes: null,
    };
  }

  withId(id: string): this {
    this.order.id = id;
    return this;
  }

  forUser(userId: string): this {
    this.order.userId = userId;
    return this;
  }

  withItem(item: Partial<OrderItem> & Pick<OrderItem, "productId">): this {
    const fullItem: OrderItem = {
      productId: item.productId,
      name: item.name ?? `Product ${item.productId}`,
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice ?? 9.99,
    };
    this.order.items.push(fullItem);
    this.order.totalAmount = this.order.items.reduce(
      (sum, i) => sum + i.quantity * i.unitPrice,
      0,
    );
    return this;
  }

  withStatus(status: OrderStatus): this {
    this.order.status = status;
    return this;
  }

  withShippingAddress(address: string): this {
    this.order.shippingAddress = address;
    return this;
  }

  shipped(): this {
    this.order.status = "shipped";
    return this;
  }

  cancelled(): this {
    this.order.status = "cancelled";
    return this;
  }

  build(): Order {
    return { ...this.order, items: [...this.order.items] };
  }
}

// Usage
const order = new OrderBuilder()
  .forUser("u1")
  .withItem({ productId: "p1", quantity: 2, unitPrice: 29.99 })
  .withItem({ productId: "p2", quantity: 1, unitPrice: 49.99 })
  .withShippingAddress("123 Rue de Paris")
  .build();

// Scenario "commande livree"
const shippedOrder = new OrderBuilder()
  .forUser("u2")
  .withItem({ productId: "p1" })
  .shipped()
  .build();
```

### Seed data pour les tests

```typescript
// test/fixtures/seed.ts
import { createUser } from "../factories/userFactory";
import { OrderBuilder } from "../factories/orderBuilder";

export const seedData = {
  users: [
    createUser({
      id: "u1",
      name: "Alice Martin",
      email: "alice@test.com",
      role: "admin",
    }),
    createUser({ id: "u2", name: "Bob Dupont", email: "bob@test.com" }),
    createUser({
      id: "u3",
      name: "Charlie Durand",
      email: "charlie@test.com",
      isActive: false,
    }),
  ],

  orders: [
    new OrderBuilder()
      .withId("o1")
      .forUser("u1")
      .withItem({
        productId: "p1",
        name: "Clavier",
        quantity: 1,
        unitPrice: 129.99,
      })
      .build(),
    new OrderBuilder()
      .withId("o2")
      .forUser("u2")
      .withItem({
        productId: "p2",
        name: "Souris",
        quantity: 2,
        unitPrice: 79.99,
      })
      .shipped()
      .build(),
  ],
};
```

---

## Test de flux d'événements

```typescript
// Tester une chaine d'evenements : creation de commande → email → stock
describe("Order creation flow", () => {
  let orderService: OrderService;
  let emailService: EmailService;
  let stockService: StockService;
  let eventBus: EventBus;

  beforeEach(async () => {
    eventBus = new EventBus();

    // Services reels connectes a la vraie DB
    const orderRepo = new OrderRepository(getPool());
    const stockRepo = new StockRepository(getPool());

    // Email service mocke (on ne veut pas envoyer de vrais emails)
    emailService = {
      sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
      sendStockAlert: vi.fn().mockResolvedValue(undefined),
    };

    stockService = new StockService(stockRepo, eventBus);
    orderService = new OrderService(
      orderRepo,
      stockService,
      emailService,
      eventBus,
    );

    // Seed : produit avec stock = 2
    await getPool().query(`
      INSERT INTO products (id, name, stock) VALUES ('p1', 'Widget', 2)
    `);
  });

  it("should create order, decrement stock, and send confirmation email", async () => {
    const order = await orderService.createOrder({
      userId: "u1",
      items: [{ productId: "p1", quantity: 1 }],
    });

    // 1. La commande est creee en base
    expect(order.id).toBeDefined();
    expect(order.status).toBe("confirmed");

    // 2. Le stock est decremente
    const stock = await getPool().query(
      "SELECT stock FROM products WHERE id = $1",
      ["p1"],
    );
    expect(stock.rows[0].stock).toBe(1);

    // 3. L'email de confirmation est envoye
    expect(emailService.sendOrderConfirmation).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ id: order.id }),
    );
  });

  it("should send stock alert when stock reaches threshold", async () => {
    // Commander tout le stock
    await orderService.createOrder({
      userId: "u1",
      items: [{ productId: "p1", quantity: 2 }],
    });

    // Le stock est a 0 → alerte envoyee
    expect(emailService.sendStockAlert).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "p1", remainingStock: 0 }),
    );
  });

  it("should reject order when insufficient stock", async () => {
    await expect(
      orderService.createOrder({
        userId: "u1",
        items: [{ productId: "p1", quantity: 5 }], // Stock = 2, demande = 5
      }),
    ).rejects.toThrow(/insufficient stock/i);

    // Pas d'email envoye
    expect(emailService.sendOrderConfirmation).not.toHaveBeenCalled();

    // Stock inchange
    const stock = await getPool().query(
      "SELECT stock FROM products WHERE id = $1",
      ["p1"],
    );
    expect(stock.rows[0].stock).toBe(2);
  });
});
```

---

## Pieges classiques et solutions

### 1. Tests lents

```typescript
// MAUVAIS : chaque test cree et detruit la base
describe("Slow tests", () => {
  beforeEach(async () => {
    await createDatabase(); // 500ms
    await runMigrations(); // 300ms
    await seedData(); // 200ms
  });
  afterEach(async () => {
    await dropDatabase(); // 200ms
  });
  // Total overhead par test : ~1200ms
});

// BON : setup une fois, nettoyer entre les tests
describe("Fast tests", () => {
  beforeAll(async () => {
    await createDatabase(); // 500ms (une seule fois)
    await runMigrations(); // 300ms (une seule fois)
  });
  beforeEach(async () => {
    await truncateTables(); // 50ms
    await seedData(); // 100ms
  });
  afterAll(async () => {
    await dropDatabase(); // 200ms (une seule fois)
  });
  // Total overhead par test : ~150ms
});

// ENCORE MIEUX : transaction rollback
describe("Fastest tests", () => {
  beforeAll(async () => {
    /* setup DB */
  });
  beforeEach(async () => {
    await beginTransaction(); // 1ms
  });
  afterEach(async () => {
    await rollbackTransaction(); // 1ms
  });
  // Total overhead par test : ~2ms
});
```

### 2. Tests flaky (intermittents)

```typescript
// MAUVAIS : depend du temps reel
it("should expire token after 1 hour", async () => {
  const token = await authService.createToken(user);
  await sleep(3600_000); // Attendre 1 heure ?!
  await expect(authService.validate(token)).rejects.toThrow();
});

// BON : injecter le temps
it("should expire token after 1 hour", async () => {
  vi.useFakeTimers();
  const token = await authService.createToken(user);

  vi.advanceTimersByTime(3600_000);

  await expect(authService.validate(token)).rejects.toThrow(/expired/);
  vi.useRealTimers();
});
```

```typescript
// MAUVAIS : ordre d'execution non garanti
it("should list users in alphabetical order", async () => {
  const users = await userService.findAll({ sort: "name" });
  // Si la DB retourne un ordre different quand il n'y a pas d'ORDER BY...
  expect(users[0].name).toBe("Alice"); // FLAKY!
});

// BON : trier dans le test ou verifier le tri
it("should list users in alphabetical order", async () => {
  const users = await userService.findAll({ sort: "name" });
  const names = users.map((u) => u.name);
  const sorted = [...names].sort();
  expect(names).toEqual(sorted); // Verifie que c'est trie, peu importe l'ordre initial
});
```

### 3. État partage entre tests

```typescript
// MAUVAIS : variable partagee modifiee par les tests
let sharedUser: User;

describe("UserService", () => {
  beforeAll(async () => {
    sharedUser = await userService.create({ name: "Shared" });
  });

  it("test 1 — modifies shared user", async () => {
    await userService.update(sharedUser.id, { name: "Modified" });
    // sharedUser.name est maintenant 'Modified' pour les tests suivants !
  });

  it("test 2 — expects original name", async () => {
    const user = await userService.findById(sharedUser.id);
    expect(user.name).toBe("Shared"); // ECHOUE si test 1 s'execute avant !
  });
});

// BON : chaque test cree ses propres donnees
describe("UserService", () => {
  it("test 1", async () => {
    const user = await userService.create({ name: "User1" });
    await userService.update(user.id, { name: "Modified" });
    // Pas d'impact sur les autres tests
  });

  it("test 2", async () => {
    const user = await userService.create({ name: "User2" });
    const found = await userService.findById(user.id);
    expect(found.name).toBe("User2"); // Toujours OK
  });
});
```

### 4. Dependance a l'ordre d'exécution

```typescript
// MAUVAIS : test 2 depend de test 1
it("should create a user", async () => {
  const user = await request(app).post("/api/users").send({ name: "Alice" });
  expect(user.status).toBe(201);
});

it("should list the created user", async () => {
  const res = await request(app).get("/api/users");
  expect(res.body.users).toHaveLength(1); // Depend de test 1 !
});

// BON : chaque test est autonome
it("should list all users", async () => {
  // Arrange : creer les donnees necessaires
  await request(app).post("/api/users").send({ name: "Alice" });
  await request(app).post("/api/users").send({ name: "Bob" });

  // Act
  const res = await request(app).get("/api/users");

  // Assert
  expect(res.body.users).toHaveLength(2);
});
```

---

## Checklist : quand écrire un test d'intégration ?

- [ ] Le code combine plusieurs modules (service + repository + validation)
- [ ] Le code interagit avec une base de donnees (requêtes SQL, ORM)
- [ ] Le code expose une API HTTP (routes, middleware, serialisation)
- [ ] Le code implique un flux d'événements (création → notification → stock)
- [ ] Le code combine frontend + store + router + API
- [ ] Les tests unitaires ne donnent pas assez de confiance
- [ ] Un bug est passe malgre les tests unitaires (regression test)

---

## Exercice pratique

Implementez les tests d'intégration pour un mini blog :

- API Express avec routes CRUD (`/api/posts`, `/api/posts/:id`, `/api/posts/:id/comments`)
- Repository PostgreSQL avec vraie base de test
- Factories pour les posts et les commentaires
- Tests : CRUD complet, validation, pagination, filtres, cascade delete
- Frontend : page de detail de post avec commentaires (composant + store + MSW)

> Solution dans le [Lab 09](../labs/lab-09-tests-integration/)

---

## Navigation

| Précédent                                                    | Suivant                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [08 - MSW Mock Service Worker](./08-msw-mock-service-worker) | [10 - Playwright fondamentaux](./10-playwright-fondamentaux) |

---

## Ressources

- [Quiz 09 : Testez vos connaissances](../quizzes/quiz-09-integration.html)
- [Lab 09 : Tests d'intégration](../labs/lab-09-tests-integration/)
- Supertest — [Documentation](https://github.com/ladjs/supertest)
- Testcontainers — [Node.js](https://node.testcontainers.org/)
- Martin Fowler — [IntegrationTest](https://martinfowler.com/bliki/IntegrationTest.html)
- Ham Vocke — [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

---

<!-- parcours-recommande -->

::: tip Parcours recommandé

1. **Screencast** : [screencast 09 intégration](../screencasts/screencast-09-integration.md)
2. **Lab** : [lab-09-tests-intégration](../labs/lab-09-tests-integration/README)
3. **Quiz** : [quiz 09 intégration](../quizzes/quiz-09-integration.html)
   :::
