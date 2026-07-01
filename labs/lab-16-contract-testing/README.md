# Lab 16 — Contract testing

> **Outcome :** à la fin, tu sais écrire un contrat consumer PactV3 pour l'API invitation TribuZen, générer le pact file, et vérifier le contrat côté provider avec `Verifier` et des `stateHandlers` — en **`@pact-foundation/pact` réel**.
> **Vrai outil :** `@pact-foundation/pact` v12 (`PactV3`, `MatchersV3`, `Verifier`), Vitest. Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Le front TribuZen consomme deux endpoints de l'API invitation :

```ts
// src/api/invitation-api-client.ts  (déjà fourni — ne pas modifier)
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

Ta mission en deux temps :

1. **Consumer** : écrire `invitation-api-client.pact.test.ts` qui génère `pacts/tribu-front-tribu-api.json`.
2. **Provider** : écrire `provider.pact.test.ts` qui vérifie le pact file contre un stub de l'API.

## Étapes (en friction)

1. **Installer les dépendances.** `pnpm add -D @pact-foundation/pact vitest`. Vérifier que la version installée est bien v12.

2. **Instancier PactV3.** Dans le fichier consumer, crée `new PactV3({ consumer: 'tribu-front', provider: 'tribu-api', dir: './pacts', logLevel: 'warn' })`. Identifie les imports nécessaires depuis `@pact-foundation/pact`.

3. **Premier contrat — GET.** Écris l'interaction pour `GET /api/invitations/inv-1` :
   - `given('invitation inv-1 exists')`
   - body avec `string()` sur chaque champ (pas de valeurs exactes)
   - `executeTest` : instancie le **vrai** `InvitationApiClient(mockServer.url)` et assert `inv.familyId === 'fam-1'`

4. **Deuxième contrat — POST.** Même approche pour `POST /api/invitations` (status 201, body complet avec matchers).

5. **Vérifier le pact file généré.** Lance le test consumer (`vitest run`). Ouvre `pacts/tribu-front-tribu-api.json` et vérifie que les deux interactions sont présentes et que les `matchingRules` contiennent `"match": "type"` sur chaque champ.

6. **Vérification provider.** Dans `provider.pact.test.ts`, instancie un faux serveur Express minimal qui répond aux deux routes, puis utilise `Verifier` avec `pactUrls` et les `stateHandlers` correspondants (`'invitation inv-1 exists'` et `'family fam-1 exists'`).

7. **Simuler une rupture.** Renomme `familyId` en `groupId` dans la réponse de ton faux serveur. Lance `vitest run` sur la vérification provider. Le test doit **échouer** avec un message Pact indiquant le champ manquant. Restaure ensuite.

## Corrigé complet commenté

```ts
// src/api/invitation-api-client.pact.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { describe, it, expect } from 'vitest';
import { InvitationApiClient } from './invitation-api-client';

const { string } = MatchersV3;

// PactV3 : un objet par paire consumer/provider
// dir : dossier de sortie du pact file JSON
const pact = new PactV3({
  consumer: 'tribu-front',
  provider: 'tribu-api',
  dir: './pacts',
  logLevel: 'warn', // réduire le bruit en CI
});

describe('InvitationApiClient — contrat Pact (consumer)', () => {
  it('GET /api/invitations/:id — récupère une invitation existante', async () => {
    await pact
      .addInteraction()
      // given = clé que le provider utilisera dans ses stateHandlers
      .given('invitation inv-1 exists')
      // description unique qui identifie l'interaction dans le pact file
      .uponReceiving('une demande GET /api/invitations/inv-1')
      .withRequest({ method: 'GET', path: '/api/invitations/inv-1' })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          // string(example) : impose le TYPE string, pas la valeur littérale
          // → le contrat reste valide même si l'API change l'ID en prod
          id:       string('inv-1'),
          familyId: string('fam-1'),  // CE champ DOIT exister et être une string
          email:    string('alice@tribu.fr'),
          status:   string('pending'),
        },
      })
      .executeTest(async (mockServer) => {
        // instancie le VRAI client — aucun mock ici
        const client = new InvitationApiClient(mockServer.url);
        const inv = await client.getInvitation('inv-1');

        // on assert sur le résultat du vrai client contre le mock server Pact
        expect(inv.id).toBe('inv-1');
        expect(inv.familyId).toBe('fam-1');
        expect(inv.status).toBe('pending');
      });
    // si executeTest est vert → pacts/tribu-front-tribu-api.json est écrit/mis à jour
  });

  it('POST /api/invitations — envoie une invitation', async () => {
    await pact
      .addInteraction()
      .given('family fam-1 exists')
      .uponReceiving('une demande POST /api/invitations')
      .withRequest({
        method: 'POST',
        path: '/api/invitations',
        headers: { 'Content-Type': 'application/json' },
        // matchers sur le body de la requête : impose le type des champs envoyés
        body: {
          familyId: string('fam-1'),
          email:    string('bob@tribu.fr'),
        },
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
        expect(inv.email).toBe('bob@tribu.fr');
      });
  });
});
```

```ts
// tests/pact/provider.pact.test.ts
import { Verifier } from '@pact-foundation/pact';
import { describe, it, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// --- Faux serveur provider (stub minimal) ---
// En vrai projet : importer createApp() depuis src/app.ts
function createStubApp() {
  const app = express();
  app.use(express.json());

  // GET /api/invitations/:id — répond avec familyId (conforme au contrat)
  app.get('/api/invitations/:id', (req, res) => {
    res.json({
      id: req.params.id,
      familyId: 'fam-1',         // champ attendu par le contrat consumer
      email: 'alice@tribu.fr',
      status: 'pending',
    });
  });

  // POST /api/invitations — crée et renvoie une invitation
  app.post('/api/invitations', (req, res) => {
    res.status(201).json({
      id: 'inv-new',
      familyId: req.body.familyId,
      email: req.body.email,
      status: 'pending',
    });
  });

  return app;
}

describe('tribu-api — vérification du contrat Pact', () => {
  let server: Server;
  let port: number;

  // démarrer le serveur stub avant les tests
  beforeAll(async () => {
    const app = createStubApp();
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
      // URL de la vraie API (ici notre stub)
      providerBaseUrl: `http://localhost:${port}`,

      // pact file produit par le test consumer
      pactUrls: ['./pacts/tribu-front-tribu-api.json'],

      // state handlers : exécutés AVANT chaque interaction
      // → correspondent aux given() du côté consumer
      stateHandlers: {
        'invitation inv-1 exists': async () => {
          // en vrai : seedInvitation({ id: 'inv-1', familyId: 'fam-1', ... })
          // ici le stub retourne toujours les bonnes données — pas de seed nécessaire
        },
        'family fam-1 exists': async () => {
          // en vrai : s'assurer qu'aucune invitation en doublon n'existe
          // ici : no-op
        },
      },
    }).verifyProvider();
    // Pact rejoue GET /api/invitations/inv-1 et POST /api/invitations
    // et compare les réponses réelles aux matchingRules du pact file
    // → si familyId est absent ou renommé : ÉCHEC ici, pas en prod
  });
});
```

Points de validation par le coach : (a) le pact file `tribu-front-tribu-api.json` existe et contient deux interactions ; (b) les `matchingRules` utilisent `"match": "type"` et non des valeurs exactes ; (c) le test consumer utilise le **vrai** `InvitationApiClient` pointé sur `mockServer.url` ; (d) chaque `given` a un `stateHandler` correspondant ; (e) renommer `familyId` en `groupId` dans le stub fait échouer la vérification provider.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 25 min**, avec ces contraintes supplémentaires :

1. Ajoute une troisième interaction : `DELETE /api/invitations/:id` retourne `204` (no body). Écris le contrat consumer puis le state handler provider.
2. Dans le contrat GET, remplace `string('pending')` par `regex('pending', '^(pending|accepted|declined)$')` depuis `MatchersV3`. Explique à voix haute pourquoi un regex matcher est plus précis qu'un type matcher ici.
3. Simule un **changement non cassant** (ajouter un champ optionnel `sentAt?: string` dans la réponse GET). Vérifie que le contrat existant reste vert sans modification.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `apps/web/src/api/invitation-api-client.ts` (interfaces `Invitation` + classe `InvitationApiClient`) à partir des types existants dans `types/index.ts`.
2. Écris `apps/web/src/api/invitation-api-client.pact.test.ts` avec `PactV3` réel — l'URL du mock server Pact remplace l'URL de l'API de dev.
3. Crée `apps/api/tests/pact/provider.pact.test.ts` avec `Verifier` qui pointe vers `apps/web/pacts/tribu-front-tribu-api.json` et l'app NestJS réelle démarrée sur un port aléatoire.
4. Commit dans `smaurier/tribuzen` : `test(pact): contrat consumer-driven front ↔ API invitation (PactV3)`.
