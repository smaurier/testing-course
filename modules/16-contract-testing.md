# Module 16 — Contract testing

| Difficulte | Duree estimee | Lab | Quiz |
|------------|---------------|-----|------|
| 5/5        | 90 min        | [Lab 16](../labs/lab-16-contract-testing/) | [Quiz 16](../quizzes/quiz-16-contract.html) |

## Objectifs

- Comprendre pourquoi les changements d'API cassent les consommateurs
- Maitriser le concept de consumer-driven contracts
- Configurer Pact avec TypeScript (consumer et provider)
- Utiliser Zod pour la validation de schemas partages
- Distinguer les changements cassants des non-cassants
- Decouvrir le contract testing pour GraphQL et gRPC

---

## Le probleme : les changements d'API cassants

### Scenario classique

```
  Team A (Frontend)              Team B (Backend API)
  ┌─────────────────┐           ┌─────────────────┐
  │  Fetches         │           │                 │
  │  GET /api/users  │──────────►│  Returns         │
  │                  │           │  { name, email } │
  │  Expects:        │           │                 │
  │  { name, email } │           │  Renames:        │
  │                  │◄──────────│  { fullName,     │
  │  CRASH !         │           │    emailAddress } │
  └─────────────────┘           └─────────────────┘
```

Team B renomme des champs. Ses propres tests passent. Team A decouvre la casse en staging (ou pire, en production).

### Pourquoi les tests classiques ne suffisent pas

| Type de test | Detecte le probleme ? | Pourquoi |
|-------------|----------------------|----------|
| Tests unitaires (Team B) | Non | Ne connaissent pas les attentes de Team A |
| Tests unitaires (Team A) | Non | Mockent l'API, pas le vrai contrat |
| Tests E2E | Oui, mais tard | Lents, fragiles, en fin de pipeline |
| Tests d'integration | Parfois | Necessitent les deux services deployes |
| **Contract tests** | **Oui, tot** | **Verifient le contrat explicitement** |

---

## Consumer-Driven Contracts

### Le principe

Le **consommateur** (frontend, autre service) definit ce qu'il attend de l'API. Le **fournisseur** (API) s'engage a respecter ces attentes.

```
  Consumer                      Pact Broker                    Provider
  ┌──────────┐                 ┌──────────┐                  ┌──────────┐
  │ Genere   │   Publie        │ Stocke   │    Verifie       │ Execute  │
  │ un Pact  ├────────────────►│ les      ├─────────────────►│ les      │
  │ (contrat)│                 │ contrats │                  │ requetes │
  └──────────┘                 └──────────┘                  └──────────┘
       │                                                          │
       │  "Je m'attends a                    "Mon API respecte    │
       │   un champ name"                     le contrat"         │
```

### Les 3 etapes

1. **Consumer** : ecrit un test qui genere un fichier Pact (contrat JSON)
2. **Broker** : stocke et versionne les contrats (optionnel mais recommande)
3. **Provider** : rejoue les requetes du contrat contre sa vraie API et verifie les reponses

---

## Pact avec TypeScript

### Installation

```bash
# Consumer side
pnpm add -D @pact-foundation/pact

# Provider side (peut etre un autre projet)
pnpm add -D @pact-foundation/pact
```

### Structure du projet

```
consumer/
  src/
    api/user-api.ts          # Client API
  tests/
    pact/
      user-api.pact.test.ts  # Test consumer
  pacts/                     # Contrats generes (JSON)

provider/
  src/
    routes/users.ts          # Routes API
  tests/
    pact/
      provider.pact.test.ts  # Verification provider
```

### Le client API (consumer)

```typescript
// consumer/src/api/user-api.ts
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

export class UserApi {
  constructor(private baseUrl: string) {}

  async getUser(id: number): Promise<User> {
    const response = await fetch(`${this.baseUrl}/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`User not found: ${response.status}`);
    }
    return response.json() as Promise<User>;
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await fetch(`${this.baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.status}`);
    }
    return response.json() as Promise<User>;
  }

  async listUsers(role?: string): Promise<User[]> {
    const url = role
      ? `${this.baseUrl}/api/users?role=${role}`
      : `${this.baseUrl}/api/users`;
    const response = await fetch(url);
    return response.json() as Promise<User[]>;
  }
}
```

### Test consumer (genere le contrat)

```typescript
// consumer/tests/pact/user-api.pact.test.ts
import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import { describe, it, expect } from 'vitest';
import { UserApi } from '../../src/api/user-api';

const { like, eachLike, integer, string, regex } = MatchersV3;

const provider = new PactV4({
  consumer: 'frontend-app',
  provider: 'user-api',
  dir: './pacts', // Dossier de sortie des contrats
});

describe('UserApi Pact', () => {
  describe('GET /api/users/:id', () => {
    it('should return a user when the user exists', async () => {
      await provider
        .addInteraction()
        .given('user 1 exists')
        .uponReceiving('a request for user 1')
        .withRequest('GET', '/api/users/1')
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              id: integer(1),
              name: string('Alice'),
              email: regex('alice@example.com', '^[\\w.+-]+@[\\w-]+\\.[\\w.]+$'),
              role: regex('admin', '^(admin|editor|viewer)$'),
            });
        })
        .executeTest(async (mockServer) => {
          const api = new UserApi(mockServer.url);
          const user = await api.getUser(1);

          expect(user.id).toBe(1);
          expect(user.name).toBe('Alice');
          expect(user.email).toBe('alice@example.com');
          expect(user.role).toBe('admin');
        });
    });

    it('should return 404 when user does not exist', async () => {
      await provider
        .addInteraction()
        .given('user 999 does not exist')
        .uponReceiving('a request for a non-existent user')
        .withRequest('GET', '/api/users/999')
        .willRespondWith(404, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              error: string('User not found'),
            });
        })
        .executeTest(async (mockServer) => {
          const api = new UserApi(mockServer.url);
          await expect(api.getUser(999)).rejects.toThrow('User not found');
        });
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      await provider
        .addInteraction()
        .uponReceiving('a request to create a user')
        .withRequest('POST', '/api/users', (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              name: string('Bob'),
              email: string('bob@example.com'),
              role: string('editor'),
            });
        })
        .willRespondWith(201, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              id: integer(2),
              name: string('Bob'),
              email: string('bob@example.com'),
              role: string('editor'),
            });
        })
        .executeTest(async (mockServer) => {
          const api = new UserApi(mockServer.url);
          const user = await api.createUser({
            name: 'Bob',
            email: 'bob@example.com',
            role: 'editor',
          });

          expect(user.id).toBe(2);
          expect(user.name).toBe('Bob');
        });
    });
  });

  describe('GET /api/users', () => {
    it('should return a list of users', async () => {
      await provider
        .addInteraction()
        .given('users exist')
        .uponReceiving('a request for all users')
        .withRequest('GET', '/api/users')
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody(
              eachLike({
                id: integer(1),
                name: string('Alice'),
                email: string('alice@example.com'),
                role: string('admin'),
              }),
            );
        })
        .executeTest(async (mockServer) => {
          const api = new UserApi(mockServer.url);
          const users = await api.listUsers();

          expect(users).toHaveLength(1);
          expect(users[0].id).toBe(1);
        });
    });
  });
});
```

### Contrat genere (Pact JSON)

```bash
# Apres execution du test consumer :
ls pacts/
# frontend-app-user-api.json
```

```json
{
  "consumer": { "name": "frontend-app" },
  "provider": { "name": "user-api" },
  "interactions": [
    {
      "description": "a request for user 1",
      "providerState": "user 1 exists",
      "request": {
        "method": "GET",
        "path": "/api/users/1"
      },
      "response": {
        "status": 200,
        "headers": { "Content-Type": "application/json" },
        "body": {
          "id": 1,
          "name": "Alice",
          "email": "alice@example.com",
          "role": "admin"
        },
        "matchingRules": {
          "body": {
            "$.id": { "matchers": [{ "match": "integer" }] },
            "$.name": { "matchers": [{ "match": "type" }] },
            "$.email": { "matchers": [{ "match": "regex", "regex": "^[\\w.+-]+@[\\w-]+\\.[\\w.]+$" }] },
            "$.role": { "matchers": [{ "match": "regex", "regex": "^(admin|editor|viewer)$" }] }
          }
        }
      }
    }
  ]
}
```

### Verification provider

```typescript
// provider/tests/pact/provider.pact.test.ts
import { Verifier } from '@pact-foundation/pact';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app';
import type { Server } from 'node:http';

describe('Pact Provider Verification', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr !== 'string') {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should honor the pact with frontend-app', async () => {
    const verifier = new Verifier({
      providerBaseUrl: `http://localhost:${port}`,
      pactUrls: ['../consumer/pacts/frontend-app-user-api.json'],

      // State handlers : mettre la DB dans l'etat requis
      stateHandlers: {
        'user 1 exists': async () => {
          // Seeder la base de donnees
          await seedUser({ id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' });
        },
        'user 999 does not exist': async () => {
          // S'assurer que l'utilisateur 999 n'existe pas
          await clearUser(999);
        },
        'users exist': async () => {
          await seedUsers([
            { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
            { id: 2, name: 'Bob', email: 'bob@example.com', role: 'editor' },
          ]);
        },
      },
    });

    await verifier.verifyProvider();
  });
});
```

---

## Pact Broker

Le Pact Broker centralise les contrats et permet la verification croisee.

### Avec Docker

```yaml
# docker-compose.yml
services:
  pact-broker:
    image: pactfoundation/pact-broker:latest
    ports:
      - "9292:9292"
    environment:
      PACT_BROKER_DATABASE_URL: sqlite:///pact_broker.sqlite3
      PACT_BROKER_LOG_LEVEL: INFO
```

### Publier un contrat

```bash
# Publier les pacts au broker
pnpm pact-broker publish ./pacts \
  --consumer-app-version=$(git rev-parse --short HEAD) \
  --broker-base-url=http://localhost:9292 \
  --tag=$(git branch --show-current)
```

### Verifier depuis le broker

```typescript
const verifier = new Verifier({
  providerBaseUrl: `http://localhost:${port}`,
  providerVersion: process.env.GIT_SHA,
  publishVerificationResult: true,

  // Recuperer les pacts depuis le broker
  pactBrokerUrl: 'http://localhost:9292',
  provider: 'user-api',

  // Verifier les pacts des branches deployees
  consumerVersionSelectors: [
    { mainBranch: true },
    { deployedOrReleased: true },
  ],

  stateHandlers: { /* ... */ },
});
```

### Can-I-Deploy

```bash
# Verifier si le consumer peut etre deploye sans casser le provider
pnpm pact-broker can-i-deploy \
  --pacticipant=frontend-app \
  --version=$(git rev-parse --short HEAD) \
  --to-environment=production \
  --broker-base-url=http://localhost:9292
```

---

## Validation de schemas avec Zod

### Le probleme avec les types TypeScript

Les types TypeScript disparaissent a l'execution. Un `interface User` ne valide rien au runtime.

```typescript
// Les types ne protegent pas au runtime
interface User {
  id: number;
  name: string;
}

// Ceci compile mais peut planter si l'API retourne autre chose
const user: User = await response.json();
// Si response.json() retourne { id: "abc", fullName: "..." }, TypeScript ne dit rien
```

### Zod : schemas partages consumer/provider

```typescript
// shared/schemas/user.schema.ts
import { z } from 'zod';

// Schema Zod = source de verite
export const UserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']),
  createdAt: z.string().datetime(),
});

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']),
});

export const UserListSchema = z.array(UserSchema);

// Types TypeScript derives automatiquement
export type User = z.infer<typeof UserSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
```

### Cote consumer : validation au runtime

```typescript
// consumer/src/api/user-api.ts
import { UserSchema, UserListSchema } from '@shared/schemas/user.schema';
import type { User, CreateUserRequest } from '@shared/schemas/user.schema';

export class UserApi {
  constructor(private baseUrl: string) {}

  async getUser(id: number): Promise<User> {
    const response = await fetch(`${this.baseUrl}/api/users/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // Validation Zod au runtime !
    const result = UserSchema.safeParse(data);
    if (!result.success) {
      console.error('API contract violation:', result.error.flatten());
      throw new Error('Invalid API response');
    }

    return result.data;
  }

  async listUsers(): Promise<User[]> {
    const response = await fetch(`${this.baseUrl}/api/users`);
    const data = await response.json();
    return UserListSchema.parse(data); // Throw si invalide
  }
}
```

### Cote provider : validation des requetes

```typescript
// provider/src/routes/users.ts
import express from 'express';
import { CreateUserSchema } from '@shared/schemas/user.schema';

const router = express.Router();

router.post('/api/users', async (req, res) => {
  // Valider le body avec le meme schema Zod
  const result = CreateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const user = await createUser(result.data);
  return res.status(201).json(user);
});

export default router;
```

### Tests de schema (consumer et provider)

```typescript
// shared/schemas/__tests__/user.schema.test.ts
import { describe, it, expect } from 'vitest';
import { UserSchema, CreateUserSchema } from '../user.schema';

describe('UserSchema', () => {
  it('should accept a valid user', () => {
    const result = UserSchema.safeParse({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'admin',
      createdAt: '2025-01-15T10:30:00Z',
    });

    expect(result.success).toBe(true);
  });

  it('should reject user with invalid email', () => {
    const result = UserSchema.safeParse({
      id: 1,
      name: 'Alice',
      email: 'not-an-email',
      role: 'admin',
      createdAt: '2025-01-15T10:30:00Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
    }
  });

  it('should reject unknown role', () => {
    const result = UserSchema.safeParse({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'superadmin', // N'existe pas
      createdAt: '2025-01-15T10:30:00Z',
    });

    expect(result.success).toBe(false);
  });

  it('should reject negative id', () => {
    const result = UserSchema.safeParse({
      id: -1,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'admin',
      createdAt: '2025-01-15T10:30:00Z',
    });

    expect(result.success).toBe(false);
  });
});

describe('CreateUserSchema', () => {
  it('should accept valid creation data', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Bob',
      email: 'bob@example.com',
      role: 'editor',
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = CreateUserSchema.safeParse({
      name: '',
      email: 'bob@example.com',
      role: 'editor',
    });

    expect(result.success).toBe(false);
  });

  it('should strip unknown fields', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Bob',
      email: 'bob@example.com',
      role: 'editor',
      isAdmin: true, // Champ inconnu
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect('isAdmin' in result.data).toBe(false);
    }
  });
});
```

---

## Changements cassants vs non-cassants

### Non-cassants (backward compatible)

| Changement | Exemple | Pourquoi c'est OK |
|-----------|---------|-------------------|
| Ajouter un champ optionnel | `+ avatar?: string` | Les anciens consumers l'ignorent |
| Ajouter un endpoint | `+ GET /api/users/search` | N'affecte pas les routes existantes |
| Ajouter une valeur d'enum | `role: 'admin' \| 'super-admin'` | Si le consumer ne filtre pas |
| Assouplir une validation | `min(3)` -> `min(1)` | Accepte plus, rejette moins |

### Cassants (breaking changes)

| Changement | Exemple | Pourquoi ca casse |
|-----------|---------|-------------------|
| Renommer un champ | `name` -> `fullName` | Le consumer cherche `name` |
| Supprimer un champ | `- email` | Le consumer l'utilise |
| Changer un type | `id: number` -> `id: string` | Parsing different |
| Rendre obligatoire | `bio?` -> `bio` (required) | Les requests sans `bio` echouent |
| Restreindre une validation | `min(1)` -> `min(5)` | Des inputs valides deviennent invalides |
| Changer un status code | `201` -> `200` | Le consumer check le status |

### Detection automatique avec Zod

```typescript
// scripts/check-breaking-changes.ts
import { z } from 'zod';

// Ancien schema (version N)
const UserV1 = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

// Nouveau schema (version N+1)
const UserV2 = z.object({
  id: z.number(),
  fullName: z.string(), // Renomme !
  email: z.string().email(),
  avatar: z.string().optional(), // Ajoute (OK)
});

// Test de compatibilite : les donnees V2 passent-elles le schema V1 ?
function checkBackwardCompatibility(
  oldSchema: z.ZodSchema,
  sampleNewData: unknown,
): void {
  const result = oldSchema.safeParse(sampleNewData);
  if (!result.success) {
    console.error('BREAKING CHANGE detected !');
    console.error('V2 data does not satisfy V1 schema:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  console.log('No breaking changes detected.');
}

// Tester
checkBackwardCompatibility(UserV1, {
  id: 1,
  fullName: 'Alice', // V1 attend "name", pas "fullName"
  email: 'alice@example.com',
  avatar: 'https://...',
});
// Output: BREAKING CHANGE detected !
// { name: ['Required'] }
```

---

## API versioning

### Strategies

| Strategie | Exemple | Avantage | Inconvenient |
|-----------|---------|----------|-------------|
| URL path | `/api/v1/users` | Simple, explicite | Duplication de routes |
| Header | `Accept: application/vnd.api+json;version=2` | URL propre | Cache complique |
| Query param | `/api/users?version=2` | Simple | Peut etre oublie |

### Implementation avec Express

```typescript
// provider/src/routes/users.ts
import express from 'express';
import { UserSchemaV1, UserSchemaV2 } from '@shared/schemas/user.schema';

const router = express.Router();

// V1 : ancien format (maintenu pour compatibilite)
router.get('/api/v1/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);
  return res.json({
    id: user.id,
    name: user.name,           // V1 : "name"
    email: user.email,
  });
});

// V2 : nouveau format
router.get('/api/v2/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);
  return res.json({
    id: user.id,
    fullName: user.name,       // V2 : "fullName"
    email: user.email,
    avatar: user.avatar ?? null,
    createdAt: user.createdAt,
  });
});

export default router;
```

### Contract tests par version

```typescript
describe('User API v1 contract', () => {
  it('should return user with "name" field', async () => {
    const response = await fetch(`${baseUrl}/api/v1/users/1`);
    const data = await response.json();
    const result = UserSchemaV1.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('User API v2 contract', () => {
  it('should return user with "fullName" field', async () => {
    const response = await fetch(`${baseUrl}/api/v2/users/1`);
    const data = await response.json();
    const result = UserSchemaV2.safeParse(data);
    expect(result.success).toBe(true);
  });
});
```

---

## GraphQL contract testing

### Le probleme specifique a GraphQL

GraphQL n'a pas de routes/endpoints distincts. Le contrat est defini par le **schema** et les **queries/mutations** utilisees par chaque consumer.

### Approche : schema-first + operation testing

```graphql
# schema.graphql
type User {
  id: ID!
  name: String!
  email: String!
  role: Role!
  posts: [Post!]!
}

enum Role {
  ADMIN
  EDITOR
  VIEWER
}

type Post {
  id: ID!
  title: String!
  content: String!
}

type Query {
  user(id: ID!): User
  users(role: Role): [User!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
}

input CreateUserInput {
  name: String!
  email: String!
  role: Role!
}
```

### Test de non-regression du schema

```typescript
// tests/schema-compat.test.ts
import { describe, it, expect } from 'vitest';
import { buildSchema, findBreakingChanges } from 'graphql';
import { readFileSync } from 'node:fs';

describe('GraphQL Schema Compatibility', () => {
  it('should not have breaking changes compared to published schema', () => {
    const publishedSchema = buildSchema(
      readFileSync('schemas/published/schema.graphql', 'utf-8'),
    );
    const currentSchema = buildSchema(
      readFileSync('schemas/current/schema.graphql', 'utf-8'),
    );

    const breakingChanges = findBreakingChanges(publishedSchema, currentSchema);

    if (breakingChanges.length > 0) {
      console.error('Breaking changes detected:');
      breakingChanges.forEach((change) => {
        console.error(`  - ${change.type}: ${change.description}`);
      });
    }

    expect(breakingChanges).toHaveLength(0);
  });
});
```

### Test des operations consumer

```typescript
// consumer/tests/graphql-contract.test.ts
import { describe, it, expect } from 'vitest';
import { graphql, buildSchema } from 'graphql';
import { readFileSync } from 'node:fs';

const schema = buildSchema(
  readFileSync('schemas/current/schema.graphql', 'utf-8'),
);

describe('Consumer GraphQL operations', () => {
  it('UserProfile query should be valid against schema', () => {
    // La query utilisee par le consumer
    const query = `
      query UserProfile($id: ID!) {
        user(id: $id) {
          id
          name
          email
          role
        }
      }
    `;

    // Valider que la query est valide contre le schema
    const errors = graphql({
      schema,
      source: query,
      // Pas besoin de resolvers pour la validation syntaxique
    });

    // Si la query est invalide, graphql retourne des erreurs
    expect(errors).toBeDefined();
  });

  it('CreateUser mutation should be valid', () => {
    const mutation = `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          name
          email
        }
      }
    `;

    const { errors } = require('graphql').validate(schema, require('graphql').parse(mutation));
    expect(errors).toHaveLength(0);
  });
});
```

---

## gRPC et Protocol Buffers

### Compatibilite Protobuf

Protocol Buffers ont des regles de compatibilite intrinseques :

```protobuf
// user.proto — version 1
syntax = "proto3";

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
}

// user.proto — version 2 (compatible)
message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
  string avatar = 4;      // AJOUT OK : nouveau champ optionnel
  // reserved 5;           // Reserver les numeros supprimes
}
```

### Regles de compatibilite Protobuf

| Action | Compatible ? | Explication |
|--------|-------------|-------------|
| Ajouter un champ | Oui | Les anciens clients l'ignorent |
| Supprimer un champ | Oui* | Avec `reserved`, les anciens clients ignorent sa valeur |
| Renommer un champ | Oui | Le numero de champ est ce qui compte, pas le nom |
| Changer le type | Non | `int32` != `string` |
| Changer le numero | Non | Le numero identifie le champ dans le wire format |

### Test de compatibilite

```typescript
// tests/proto-compat.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('Protobuf backward compatibility', () => {
  it('should not have breaking changes', () => {
    // Utiliser buf (outil de linting protobuf)
    const result = execSync(
      'buf breaking proto/current --against proto/published',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );

    expect(result).toBe('');
  });
});
```

---

## Workflow CI complet pour le contract testing

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  consumer-tests:
    name: Consumer Contract Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Run consumer pact tests
        run: pnpm vitest run tests/pact/

      - name: Upload pact files
        uses: actions/upload-artifact@v4
        with:
          name: pacts
          path: pacts/

  provider-verification:
    name: Provider Verification
    needs: consumer-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: my-org/user-api # Le repo du provider
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Download pact files
        uses: actions/download-artifact@v4
        with:
          name: pacts
          path: pacts/

      - name: Verify provider against pacts
        run: pnpm vitest run tests/pact/provider.pact.test.ts

  schema-validation:
    name: Schema Validation (Zod)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Run schema tests
        run: pnpm vitest run shared/schemas/

      - name: Check backward compatibility
        run: pnpm tsx scripts/check-breaking-changes.ts
```

---

## Checklist du module

- [ ] Je comprends pourquoi les tests classiques ne detectent pas les ruptures de contrat
- [ ] Je sais configurer Pact (consumer + provider) avec TypeScript
- [ ] Je sais utiliser les matchers Pact (like, eachLike, regex, integer)
- [ ] Je comprends le role du Pact Broker et de can-i-deploy
- [ ] J'utilise Zod pour valider les schemas au runtime
- [ ] Je distingue les changements cassants des non-cassants
- [ ] Je connais les approches pour GraphQL et gRPC
- [ ] Mon pipeline CI inclut les contract tests

---

## Exercice pratique

1. Creez un client API avec 3 operations (GET, POST, LIST)
2. Ecrivez les tests Pact cote consumer
3. Verifiez le contrat cote provider
4. Creez les schemas Zod partages
5. Simulez un changement cassant et verifiez que les tests le detectent
6. Corrigez avec du versioning

> Solution dans le [Lab 16](../labs/lab-16-contract-testing/)

---

## Navigation

| Precedent | Suivant |
|-----------|---------|
| [15 - TDD et BDD](./15-tdd-et-bdd) | [17 - Performance testing](./17-performance-testing) |

---

## Ressources

- [Quiz 16 : Testez vos connaissances](../quizzes/quiz-16-contract.html)
- [Lab 16 : Contract testing](../labs/lab-16-contract-testing/)
- [Pact Documentation](https://docs.pact.io/)
- [Zod Documentation](https://zod.dev/)
- [Martin Fowler — Consumer-Driven Contracts](https://martinfowler.com/articles/consumerDrivenContracts.html)
- [GraphQL — findBreakingChanges](https://graphql.org/graphql-js/utilities/#findbreakingchanges)
- [Buf — Protobuf Linting](https://buf.build/)
