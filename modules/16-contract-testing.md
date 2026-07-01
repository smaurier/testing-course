---
titre: Contract testing
cours: 06-testing
notions: [tests de contrat consumer-driven, consumer et provider, contrat comme source de vérité, Pact, vérification du provider, broker de contrats, vs tests d'intégration et e2e, cas d'usage microservices]
outcomes: [expliquer le contract testing consumer-driven, écrire un contrat côté consumer avec Pact, vérifier le contrat côté provider, situer le contract testing vs e2e]
prerequis: [15-tdd-et-bdd]
next: 17-performance-testing
libs: [{ name: vitest, version: ^4.1.9 }, { name: "@pact-foundation/pact", version: ^12 }]
tribuzen: contrat entre le front TribuZen et l'API famille/invitation (consumer-driven)
last-reviewed: 2026-07
---

# Contract testing

> **Outcomes — tu sauras FAIRE :** expliquer le contract testing consumer-driven, écrire un contrat côté consumer avec PactV3, vérifier le contrat côté provider avec `Verifier` et des `stateHandlers`, et situer le contract testing face aux tests d'intégration et e2e.
> **Difficulté :** :star::star::star::star:

## 1. Cas concret d'abord

L'équipe front TribuZen lit `GET /api/invitations/:id` et consomme les champs `id`, `familyId`, `email`, `status`. L'équipe API, de son côté, refactorise et renomme `familyId` en `groupId`. Chaque équipe fait passer ses propres tests unitaires — les unit tests du front mockent l'API, ceux de l'API ne connaissent pas les attentes du front. Résultat : les deux suites sont vertes, mais la feature d'invitation plante en staging.

```
Front TribuZen (consumer)           API TribuZen (provider)
┌──────────────────────┐            ┌──────────────────────┐
│ attend { familyId }  │            │ renomme → { groupId }│
│ unit tests : verts   │            │ unit tests : verts   │
│ → CRASH en staging   │            │ → ignore le consumer │
└──────────────────────┘            └──────────────────────┘
```

**Question centrale** : comment détecter cette rupture AVANT le déploiement, sans lancer deux services en parallèle ni écrire un test e2e lent ? Réponse : le **contract testing consumer-driven** avec Pact.

## 2. Théorie complète, concise

### Consumer-driven contracts — le principe

Dans le contract testing **consumer-driven**, c'est le **consommateur** (le front, un autre microservice) qui définit ce qu'il attend du **fournisseur** (l'API). Le fournisseur s'engage à respecter ces attentes. C'est l'inverse du contrat imposé par le provider (OpenAPI first).

```
Consumer                   Pact file (JSON)            Provider
┌──────────┐  génère       ┌──────────────┐  vérifie   ┌──────────┐
│ test     ├──────────────►│ interactions │────────────►│ Verifier │
│ consumer │               │ (source de   │             │ rejoue   │
└──────────┘               │  vérité)     │             │ requêtes │
                           └──────────────┘             └──────────┘
```

### Consumer et provider — deux rôles, deux moments

| Rôle | Quand s'exécute | Ce qu'il fait |
|------|-----------------|---------------|
| **Consumer** | dans son propre pipeline CI | écrit les interactions, exécute contre un mock server Pact, génère le pact file |
| **Provider** | dans son propre pipeline CI | récupère le pact file, rejoue chaque interaction contre sa vraie API, publie le résultat |

Les deux pipelines sont **indépendants**. Ils ne nécessitent pas de lancer les deux services en même temps.

### Le contrat comme source de vérité

Le **pact file** est un fichier JSON généré automatiquement lors du test consumer. Il contient la liste des **interactions** : pour chaque cas, la requête attendue et la réponse minimale requise. Ce fichier est **versionné** et partagé entre les équipes (via le broker ou le VCS).

```json
{
  "consumer": { "name": "tribu-front" },
  "provider": { "name": "tribu-api" },
  "interactions": [
    {
      "description": "une demande GET /api/invitations/inv-1",
      "providerState": "invitation inv-1 exists",
      "request": { "method": "GET", "path": "/api/invitations/inv-1" },
      "response": {
        "status": 200,
        "body": { "id": "inv-1", "familyId": "fam-1", "email": "alice@tribu.fr", "status": "pending" },
        "matchingRules": {
          "body": {
            "$.id":       { "matchers": [{ "match": "type" }] },
            "$.familyId": { "matchers": [{ "match": "type" }] },
            "$.email":    { "matchers": [{ "match": "type" }] },
            "$.status":   { "matchers": [{ "match": "type" }] }
          }
        }
      }
    }
  ]
}
```

### Pact — l'outil

**Pact** est la librairie de référence pour le contract testing consumer-driven. En TypeScript/Node.js, `@pact-foundation/pact` v12 expose `PactV3` (interactions HTTP REST) et `PactV4` (messages asynchrones, transports non-HTTP).

**PactV3 — côté consumer** : chaîne fluente pour décrire une interaction.

```
pact.addInteraction()
  .given(...)           // état requis du provider
  .uponReceiving(...)   // description humaine de l'interaction
  .withRequest(...)     // méthode + path + headers + body attendus
  .willRespondWith(...) // status + body + headers retournés
  .executeTest(async (mockServer) => { ... }) // appelle le vrai client contre le mock
```

Pendant `executeTest`, Pact démarre un **mock server** qui simule le provider selon les règles définies. Le test instancie le client HTTP réel en le pointant sur ce mock server. Si la requête ne correspond pas à l'interaction enregistrée, Pact échoue. À la fin du test réussi, le pact file est écrit sur disque.

**MatchersV3** — les matchers permettent d'écrire des contrats **flexibles** plutôt que rigides (valeurs exactes) :

| Matcher | Import | Vérifie |
|---------|--------|---------|
| `like(value)` | `MatchersV3` | le **type** de `value` (string, number, boolean…) |
| `string(example)` | `MatchersV3` | que le champ est de type string |
| `integer(example)` | `MatchersV3` | que le champ est un entier |
| `decimal(example)` | `MatchersV3` | que le champ est un décimal |
| `eachLike(template)` | `MatchersV3` | que le champ est un tableau dont chaque item satisfait `template` |
| `regex(example, pattern)` | `MatchersV3` | que le champ correspond à l'expression régulière |

Règle d'or : préférer `string`/`integer`/`like` aux valeurs exactes. Un contrat qui vérifie le **type** reste valide même si l'API renvoie un ID différent à chaque run.

**PactV3 — vérification provider** : `Verifier` rejoue chaque interaction du pact file contre la vraie API.

```typescript
await new Verifier({
  providerBaseUrl: 'http://localhost:3000',
  pactUrls: ['./pacts/tribu-front-tribu-api.json'],
  stateHandlers: {
    'invitation inv-1 exists': async () => { /* seed DB */ },
  },
}).verifyProvider();
```

Les **state handlers** sont des fonctions exécutées avant chaque interaction pour mettre la base de données dans l'état requis par le champ `given`. Sans eux, le provider reçoit des requêtes sans données et retourne 404.

### Broker de contrats

Le **Pact Broker** (self-hosted ou PactFlow SaaS) centralise le stockage et le versionnement des pact files. Les deux pipelines — consumer et provider — s'y connectent pour publier et récupérer les contrats.

La commande `can-i-deploy` interroge le broker pour savoir si une version donnée du consumer peut être déployée sans casser le provider déjà en production :

```bash
pnpm pact-broker can-i-deploy \
  --pacticipant tribu-front \
  --version $(git rev-parse --short HEAD) \
  --to-environment production \
  --broker-base-url http://pact-broker:9292
```

Sans broker, les pact files s'échangent via le VCS ou les artefacts CI — faisable pour deux services, ingérable pour une dizaine.

### Contract testing vs intégration vs e2e

| Critère | Unit (avec mock) | Contract (Pact) | Intégration | E2E |
|---------|-----------------|-----------------|-------------|-----|
| Services déployés | 0 | 0 | 2+ | tous |
| Vitesse | ms | secondes | minutes | minutes-heures |
| Détecte les ruptures de contrat | non | oui | oui | oui |
| Isole les équipes | oui | oui | non | non |
| Flakiness | nulle | faible | moyenne | élevée |

Le contract testing ne remplace ni l'e2e (qui couvre les scénarios end-to-end réels) ni les tests d'intégration (qui vérifient la persistance, la sécurité, etc.). Il couvre le **gap spécifique** de la rupture de contrat d'API inter-équipes.

### Cas d'usage microservices

Le contract testing prend toute sa valeur quand plusieurs équipes consomment la même API :

```
tribu-front   ──────────────────────────────────────────┐
mobile-app    ──── chacun génère son pact ─────────────►│ tribu-api
admin-panel   ──────────────────────────────────────────┘
```

Le provider exécute une vérification par consumer. Si `tribu-front` attend `familyId` et que `mobile-app` attend `groupId`, le renommage est détecté comme cassant pour `tribu-front` mais pas pour `mobile-app`. Granularité impossible avec un test e2e unique.

## 3. Worked examples

### Exemple A — contrat consumer avec PactV3

Le front TribuZen expose un `InvitationApiClient` qui appelle `GET /api/invitations/:id`. On écrit le contrat qui fige le champ `familyId` comme attendu.

```ts
// src/api/invitation-api-client.ts
export interface Invitation {
  id: string;
  familyId: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
}

export class InvitationApiClient {
  constructor(private baseUrl: string) {}

  async getInvitation(id: string): Promise<Invitation> {
    const res = await fetch(`${this.baseUrl}/api/invitations/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<Invitation>;
  }

  async sendInvitation(familyId: string, email: string): Promise<Invitation> {
    const res = await fetch(`${this.baseUrl}/api/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId, email }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<Invitation>;
  }
}
```

```ts
// src/api/invitation-api-client.pact.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { describe, it, expect } from 'vitest';
import { InvitationApiClient } from './invitation-api-client';

const { string } = MatchersV3;

// 1. Instanciation du pact : consumer = front, provider = API
const pact = new PactV3({
  consumer: 'tribu-front',
  provider: 'tribu-api',
  dir: './pacts',   // le pact file JSON sera écrit ici
  logLevel: 'warn',
});

describe('InvitationApiClient — contrat Pact', () => {
  it('récupère une invitation existante (GET /api/invitations/:id)', async () => {
    await pact
      // 2. given = état requis du provider (utilisé par les stateHandlers côté provider)
      .addInteraction()
      .given('invitation inv-1 exists')
      // 3. description humaine de l'interaction (clé de correspondance dans le pact file)
      .uponReceiving('une demande GET /api/invitations/inv-1')
      // 4. requête que le client va émettre
      .withRequest({ method: 'GET', path: '/api/invitations/inv-1' })
      // 5. réponse minimale que le consumer exige — string() vérifie le TYPE, pas la valeur exacte
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id:       string('inv-1'),      // type string suffisant
          familyId: string('fam-1'),      // CE champ doit exister et être une string
          email:    string('alice@tribu.fr'),
          status:   string('pending'),
        },
      })
      // 6. executeTest démarre le mock server et y pointe le vrai client
      .executeTest(async (mockServer) => {
        const client = new InvitationApiClient(mockServer.url);
        const inv = await client.getInvitation('inv-1');

        // on assert sur le vrai client, pas sur le mock
        expect(inv.id).toBe('inv-1');
        expect(inv.familyId).toBe('fam-1');
        expect(inv.status).toBe('pending');
      });
    // après le test réussi → pacts/tribu-front-tribu-api.json est généré/mis à jour
  });

  it('envoie une invitation (POST /api/invitations)', async () => {
    await pact
      .addInteraction()
      .given('family fam-1 exists')
      .uponReceiving('une demande POST /api/invitations')
      .withRequest({
        method: 'POST',
        path: '/api/invitations',
        headers: { 'Content-Type': 'application/json' },
        body: { familyId: string('fam-1'), email: string('bob@tribu.fr') },
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id:       string('inv-new'),
          familyId: string('fam-1'),
          email:    string('bob@tribu.fr'),
          status:   string('pending'),
        },
      })
      .executeTest(async (mockServer) => {
        const client = new InvitationApiClient(mockServer.url);
        const inv = await client.sendInvitation('fam-1', 'bob@tribu.fr');

        expect(inv.status).toBe('pending');
        expect(inv.familyId).toBe('fam-1');
      });
  });
});
```

Pas-à-pas : (1) `PactV3({ consumer, provider, dir })` configure l'instance ; (2) `given` pose l'état que le provider devra préparer ; (3) `string(example)` impose le **type** string — si l'API renvoie un nombre à la place, le contrat échoue ; (4) `executeTest` reçoit le `mockServer` : on instancie le **vrai** `InvitationApiClient` dessus (pas un mock) ; (5) le pact file est écrit **uniquement** si le test est vert.

### Exemple B — vérification provider avec Verifier

Le provider (`tribu-api`) récupère le pact file et rejoue chaque interaction contre sa vraie API en cours de démarrage.

```ts
// tests/pact/provider.pact.test.ts  (dans le repo tribu-api)
import { Verifier } from '@pact-foundation/pact';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app';
import type { Server } from 'node:http';

// helpers de seed (à adapter à ta stack — Prisma, Drizzle, etc.)
import { seedInvitation, clearInvitations } from '../helpers/db-seed';

describe('tribu-api — vérification du contrat Pact', () => {
  let server: Server;
  let port: number;

  // démarrage de la vraie API sur un port aléatoire
  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr !== 'string') port = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('satisfait le contrat tribu-front-tribu-api', async () => {
    await new Verifier({
      // URL de la vraie API démarrée ci-dessus
      providerBaseUrl: `http://localhost:${port}`,

      // chemin vers le pact file généré par le consumer
      // (en CI : artefact téléchargé ou récupéré depuis le broker)
      pactUrls: ['./pacts/tribu-front-tribu-api.json'],

      // state handlers : préparent la DB AVANT chaque interaction
      stateHandlers: {
        'invitation inv-1 exists': async () => {
          await clearInvitations();
          await seedInvitation({
            id: 'inv-1',
            familyId: 'fam-1',
            email: 'alice@tribu.fr',
            status: 'pending',
          });
        },
        'family fam-1 exists': async () => {
          await clearInvitations();
          // pas d'invitation à pré-charger — POST créera la nouvelle
        },
      },
    }).verifyProvider();
    // Pact rejoue GET /api/invitations/inv-1 et POST /api/invitations
    // et compare les réponses réelles aux matchers du pact file
  });
});
```

Pas-à-pas : (1) la vraie app démarre sur un port aléatoire — pas de mock ; (2) `pactUrls` pointe vers le pact file produit par le test consumer ; (3) chaque `stateHandler` est appelé juste avant l'interaction correspondante — il seed ou nettoie la DB pour que la requête ait une réponse valide ; (4) si `tribu-api` renomme `familyId` en `groupId`, Pact échoue ici car le matcher `string('fam-1')` vérifie que le champ `familyId` existe dans la réponse.

## 4. Pièges & misconceptions

- **Contract test qui teste la logique métier.** Vérifier dans un contract test que le service refuse une invitation en doublon, qu'un email est valide, ou qu'un RBAC est appliqué — c'est faux. Le contract test ne couvre que le **format du contrat** (champs, types, status codes). La logique métier reste dans les tests unitaires. *Correct* : chaque test Pact décrit une interaction atomique et ne contient pas d'assertions sur des règles de gestion.

- **Contrat non partagé entre équipes.** Envoyer le pact file par email, le commit dans le mauvais repo, ou laisser chaque équipe le reconstruire à la main — le contrat n'est plus une source de vérité commune. *Correct* : publier le pact file via le Pact Broker (ou via un artefact CI) et l'adresser par une URL stable dans le `Verifier`.

- **Confondre contract testing et e2e.** Un contract test ne démarre pas l'UI, ne simule pas un utilisateur, n'a pas besoin d'une base populée en permanence. Il ne remplace pas les e2e. *Correct* : contract test = vérification du **format de communication** entre deux services ; e2e = vérification des **scénarios utilisateur end-to-end**.

- **Matchers trop stricts (valeurs exactes).** Écrire `id: 'inv-1'` au lieu de `id: string('inv-1')` → le contrat exige la valeur exacte `'inv-1'`. Si le provider retourne un vrai UUID en prod, le contrat échoue inutilement. *Correct* : utiliser `string`, `integer`, `like` pour les champs dont la valeur change ; réserver les valeurs exactes aux champs sémantiquement fixes (ex. `status: 'pending'`).

- **Oublier les state handlers.** Sans state handler pour `'invitation inv-1 exists'`, le provider reçoit `GET /api/invitations/inv-1` alors que la DB est vide — il renvoie 404 et la vérification échoue pour la mauvaise raison. *Correct* : chaque `given` du consumer **doit** avoir un state handler correspondant côté provider.

## 5. Ancrage TribuZen

Couche fil-rouge : **contrat entre le front TribuZen et l'API famille/invitation (consumer-driven)** (`smaurier/tribuzen`).

- `InvitationApiClient` (front) consomme `GET /api/invitations/:id` et `POST /api/invitations`. Ces deux endpoints sont précisément ceux pour lesquels on écrit les contrats Pact côté consumer.
- L'équipe API (ou toi seul en solo) peut faire évoluer les routes NestJS sans craindre de casser le front : la suite Pact détecte tout renommage de champ, tout changement de status code, tout retrait de champ dans la réponse.
- Le pact file `tribu-front-tribu-api.json` engagé dans le repo est la preuve formelle que les deux couches se parlent — bien plus fiable qu'un commentaire dans le code ou une documentation OpenAPI non vérifiée.
- En solo, le broker est optionnel : un artefact CI ou un chemin relatif entre les deux projets suffit. Le broker devient indispensable dès qu'il y a plus d'un consumer (ex. mobile TribuZen).

## 6. Points clés

1. Le contract testing consumer-driven inverse la responsabilité : c'est le **consumer** qui définit ses attentes, pas le provider.
2. **Consumer** = génère le pact file via un test contre un mock server ; **Provider** = vérifie le pact file contre sa vraie API.
3. Le **pact file JSON** est la source de vérité partagée entre les deux équipes — le renommer ou le reconstruire à la main brise le modèle.
4. `PactV3({ consumer, provider, dir })` + chaîne `.addInteraction().given().uponReceiving().withRequest().willRespondWith().executeTest()` — API consommateur.
5. `MatchersV3` : `string`, `integer`, `like`, `eachLike`, `regex` — préférer le **type** à la valeur exacte pour des contrats durables.
6. `Verifier({ providerBaseUrl, pactUrls, stateHandlers })` + `.verifyProvider()` — API provider ; les `stateHandlers` seedent la DB avant chaque interaction.
7. Le **Pact Broker** centralise le versionnement des contrats ; `can-i-deploy` bloque un déploiement si le contrat n'est pas vérifié par le provider cible.
8. Contract testing ≠ e2e : pas de services déployés ensemble, pas d'UI, pas de scénarios utilisateur — uniquement la vérification du format de communication.

## 7. Seeds Anki

```
Qu'est-ce que le contract testing consumer-driven ?|Le consumer définit ses attentes (contrat) ; le provider s'engage à les respecter — chaque équipe valide indépendamment
Quels sont les deux rôles dans Pact ?|Consumer (génère le pact file contre un mock server) et Provider (vérifie le pact file contre sa vraie API)
Qu'est-ce qu'un pact file ?|Un fichier JSON généré automatiquement par le test consumer, contenant toutes les interactions — source de vérité partagée
Différence entre string() et une valeur exacte dans MatchersV3 ?|string() vérifie uniquement que le champ est de type string ; une valeur exacte impose la valeur littérale — préférer string() pour des contrats stables
À quoi servent les state handlers côté provider ?|À préparer la base de données (seed/cleanup) dans l'état requis par le champ given avant que Pact rejoue chaque interaction
Qu'est-ce que can-i-deploy ?|Commande Pact Broker qui vérifie si une version du consumer (ou provider) peut être déployée sans casser les participants déjà en production
Contract testing vs e2e — différence clé ?|Contract testing est rapide, isolé, sans environnement déployé ; e2e est lent, nécessite tous les services actifs, couvre les scénarios utilisateur
Quel piège se cache derrière les matchers trop stricts ?|Vérifier des valeurs exactes rend le contrat fragile — si l'API retourne des IDs dynamiques (UUID), le contrat échoue inutilement
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-16-contract-testing/`. Tu y écris le contrat consumer PactV3 pour l'API invitation TribuZen (GET + POST), puis tu vérifies le provider avec `Verifier` et des `stateHandlers` — en `@pact-foundation/pact` réel. Corrigé complet commenté + variante J+30 dans le README du lab.
