# Screencast 16 — Contract testing

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/16-contract-testing.md`
- **Lab associe** : Lab 16
- **Prérequis** : Screencast 15

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal intégré ouvert
- [ ] Projet de demo avec Pact et Zod installes
- [ ] Fichier `modules/16-contract-testing.md` ouvert

## Script

### [00:00-02:30] Introduction — Le problème des changements d'API cassants

> Imaginez : l'équipe backend renomme un champ `name` en `fullName`. Tous les tests backend passent. Mais le frontend s'attend a `name` et casse en production. Le contract testing empeche ça.

**Action** : Afficher le scenario.

```
  Team A (Frontend)              Team B (Backend API)
  ┌─────────────────┐           ┌─────────────────┐
  │  Fetches         │           │                 │
  │  GET /api/users  │──────────►│  Returns         │
  │                  │           │  { name, email } │
  │  Expects:        │           │                 │
  │  { name, email } │           │  Renames:        │
  │                  │◄──────────│  { fullName,     │
  │  CASSE !         │           │    email }       │
  └─────────────────┘           └─────────────────┘

  Les tests backend passent. Les tests frontend passent.
  L'integration casse en production.
```

### [02:30-06:00] Consumer-Driven Contracts avec Pact

> Pact est l'outil de référence pour le contract testing. Le consumer (frontend) définit ce qu'il attend. Le provider (backend) vérifié qu'il respecte le contrat.

**Action** : Écrire un test consumer (frontend).

```typescript
import { PactV4, MatchersV3 } from '@pact-foundation/pact';

const provider = new PactV4({
  consumer: 'TaskFrontend',
  provider: 'TaskAPI',
});

describe('Task API Contract', () => {
  it('should return task list', async () => {
    await provider
      .addInteraction()
      .given('tasks exist')
      .uponReceiving('a request for all tasks')
      .withRequest('GET', '/api/tasks')
      .willRespondWith(200, (builder) => {
        builder.jsonBody(
          MatchersV3.eachLike({
            id: MatchersV3.string('task-1'),
            title: MatchersV3.string('Write tests'),
            status: MatchersV3.string('todo'),
            priority: MatchersV3.string('high'),
          })
        );
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/tasks`);
        const tasks = await response.json();

        expect(tasks).toHaveLength(1);
        expect(tasks[0]).toHaveProperty('title');
        expect(tasks[0]).toHaveProperty('status');
      });
  });
});
```

> Le test généré un fichier "pact" (contrat JSON) dans le dossier `pacts/`. Ce fichier est partage avec l'équipe backend.

### [06:00-09:00] Vérification cote provider (backend)

**Action** : Écrire le test provider.

```typescript
import { Verifier } from '@pact-foundation/pact';

describe('Task API Provider Verification', () => {
  it('should satisfy the consumer contract', async () => {
    const verifier = new Verifier({
      providerBaseUrl: 'http://localhost:3001',
      pactUrls: ['./pacts/TaskFrontend-TaskAPI.json'],
      stateHandlers: {
        'tasks exist': async () => {
          // Preparer l'etat requis dans la DB
          await db.insert('tasks', {
            id: 'task-1',
            title: 'Write tests',
            status: 'todo',
            priority: 'high',
          });
        },
      },
    });

    await verifier.verifyProvider();
  });
});
```

> Le provider demarre son serveur, charge le contrat, et vérifié que ses réponses correspondent. Si l'équipe backend renomme `title` en `taskTitle`, ce test echoue AVANT le merge.

### [09:00-12:00] Validation de schemas avec Zod

> Zod offre une approche plus legere que Pact : partager des schemas TypeScript entre consumer et provider.

**Action** : Créer un schema partage.

```typescript
// shared/schemas/task.schema.ts
import { z } from 'zod';

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  createdAt: z.string().datetime(),
});

export type Task = z.infer<typeof TaskSchema>;

export const TaskListSchema = z.array(TaskSchema);
```

**Action** : Utiliser le schema dans les tests.

```typescript
// Test cote frontend
describe('Task API response validation', () => {
  it('should match Task schema', async () => {
    const response = await fetch('/api/tasks');
    const data = await response.json();

    // Zod valide la structure ET les types
    const result = TaskListSchema.safeParse(data);
    expect(result.success).toBe(true);

    if (!result.success) {
      console.error(result.error.format());
    }
  });
});

// Test cote backend
describe('Task API output', () => {
  it('should produce valid Task objects', async () => {
    const tasks = await taskService.findAll();
    const result = TaskListSchema.safeParse(tasks);
    expect(result.success).toBe(true);
  });
});
```

### [12:00-14:30] Changements cassants vs non-cassants

**Action** : Afficher la classification.

```
CHANGEMENT              | CASSANT ? | POURQUOI
------------------------|-----------|-----------------------------------
Ajouter un champ        | NON       | Le consumer ignore les champs inconnus
Supprimer un champ      | OUI       | Le consumer s'attend a le trouver
Renommer un champ       | OUI       | Equivalent a supprimer + ajouter
Changer un type         | OUI       | string → number casse le parsing
Ajouter une valeur enum | DEPEND    | OK si consumer gere les inconnues
Retirer une valeur enum | OUI       | Le consumer peut l'utiliser
Changer un URL          | OUI       | Le consumer ne trouve plus la route
```

> La regle de Postel : "Be conservative in what you send, be liberal in what you accept." Le provider doit respecter le contrat. Le consumer doit tolerer les champs inconnus.

### [14:30-16:30] Workflow en équipe — Pact Broker

**Action** : Afficher le workflow.

```
WORKFLOW CONTRACT TESTING :
━━━━━━━━━━━━━━━━━━━━━━━━━

1. Consumer ecrit un test Pact → genere un contrat (JSON)
2. Contrat publie sur le Pact Broker (ou partage via repo)
3. Provider CI telecharge le contrat
4. Provider verifie le contrat contre sa vraie API
5. Resultat publie sur le Pact Broker
6. "Can I Deploy?" → verifie la compatibilite avant deploiement

CONSUMER ──pact──► BROKER ──pact──► PROVIDER
                   ↑                    │
                   └── verification ────┘
```

### [16:30-18:30] Récapitulatif

**Action** : Afficher le récapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Contract testing = filet de securite entre teams/services
2. Pact : consumer definit ses attentes, provider les verifie
3. Zod : schemas partages pour une validation plus legere
4. Ajouter un champ = OK, supprimer/renommer = cassant
5. Pact Broker pour le workflow CI/CD multi-equipes
6. Complement aux tests d'integration, pas remplacement

PROCHAINE ETAPE :
→ Screencast 17 : Performance testing
```

## Points d'attention pour l'enregistrement
- Le diagramme du bug "name → fullName" est très parlant — y passer du temps
- La distinction consumer/provider doit etre claire avant de montrer le code
- Zod est plus simple que Pact — le présenter comme une alternative pragmatique
- Le tableau cassant/non-cassant est un référence utile
