---
titre: Architecture testable
cours: 06-testing
notions: [injection de dépendances pour la testabilité, fonctions pures vs effets de bord, ports et adaptateurs, humble object pattern, coutures seams pour isoler, séparer logique métier et I/O, testabilité par conception]
outcomes: [concevoir du code isolable par injection de dépendances, séparer la logique pure des effets de bord, introduire des coutures pour tester du code couplé]
prerequis: [05-tests-asynchrones]
next: 07-tests-de-composants
libs: [{ name: vitest, version: ^4.1.9 }]
tribuzen: refactorer le service d'invitation TribuZen pour le rendre testable (DI du mailer et du repository)
last-reviewed: 2026-07
---

# Architecture testable

> **Outcomes — tu sauras FAIRE :** concevoir du code isolable par injection de dépendances, séparer la logique pure des effets de bord, introduire des coutures pour tester du code couplé.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, le service d'invitation ressemble à ceci avant tout refactoring :

```ts
// src/invitation/invitation-service.ts  — VERSION INTESTABLE
import { db } from '../db';                    // couplage dur à Postgres
import { mailer } from '../mailer';            // couplage dur au SMTP

export async function inviteMember(familyId: string, email: string) {
  const res = await db.query(
    'SELECT id FROM invitations WHERE family_id = $1 AND email = $2 AND status = $2',
    [familyId, email, 'pending']
  );
  if (res.rows.length) throw new Error('ALREADY_INVITED');

  const inserted = await db.query(
    'INSERT INTO invitations (family_id, email, status) VALUES ($1, $2, $3) RETURNING id',
    [familyId, email, 'pending']
  );
  await mailer.send({
    to: email,
    subject: 'Vous êtes invité dans une famille TribuZen',
    text: `Rejoignez la famille ${familyId}`,
  });
  return { id: inserted.rows[0].id as string };
}
```

**Problème** : pour tester `inviteMember`, il faut une vraie instance Postgres ET un vrai serveur SMTP. Si l'un est absent, le test échoue pour des raisons d'infrastructure, pas de logique. Écrire le test dans cet état force à mocker le module `../db` et `../mailer` avec `vi.mock` — solution fragile qui teste l'implémentation, pas le comportement.

La question centrale : comment concevoir ce code pour que les dépendances soient *substituables* sans toucher à la logique ? La réponse est dans ce module.

## 2. Théorie complète, concise

### Injection de dépendances (DI) pour la testabilité

La DI est le levier #1 de testabilité. Au lieu de créer ou importer ses dépendances, un composant les **reçoit de l'extérieur**. La signature devient le contrat visible — rien n'est caché.

Trois formes :

**Injection par constructeur** (recommandée pour les services avec état) :

```ts
// Interfaces = ports que le service consomme
export interface InvitationRepository {
  existsPending(familyId: string, email: string): Promise<boolean>;
  save(familyId: string, email: string): Promise<{ id: string }>;
}

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export class InvitationService {
  constructor(
    private readonly repo: InvitationRepository,
    private readonly mailer: Mailer
  ) {}

  async invite(familyId: string, email: string): Promise<{ id: string }> {
    if (await this.repo.existsPending(familyId, email)) {
      throw new Error('ALREADY_INVITED');
    }
    const invitation = await this.repo.save(familyId, email);
    await this.mailer.send(email, 'Invitation TribuZen', `Famille ${familyId}`);
    return invitation;
  }
}
```

En production : `new InvitationService(new PrismaInvitationRepo(prisma), new NodeMailer())`.  
En test : `new InvitationService(stubRepo, spyMailer)` — zéro `vi.mock`.

**Injection par paramètre** (recommandée pour les fonctions stateless) :

```ts
async function processInvite(
  familyId: string,
  email: string,
  deps: { repo: InvitationRepository; mailer: Mailer }
): Promise<{ id: string }> {
  if (await deps.repo.existsPending(familyId, email)) throw new Error('ALREADY_INVITED');
  const inv = await deps.repo.save(familyId, email);
  await deps.mailer.send(email, 'Invitation TribuZen', `Famille ${familyId}`);
  return inv;
}
```

**Injection par factory** (recommandée quand les dépendances ont des valeurs par défaut en production) :

```ts
interface Deps { repo: InvitationRepository; mailer: Mailer }

function createInvitationService(overrides: Partial<Deps> = {}) {
  return new InvitationService(
    overrides.repo ?? new PrismaInvitationRepo(prisma),
    overrides.mailer ?? new NodeMailer()
  );
}

// En prod : createInvitationService()
// En test : createInvitationService({ repo: stubRepo, mailer: spyMailer })
```

### Fonctions pures vs effets de bord

Une **fonction pure** :
1. retourne toujours le même résultat pour les mêmes arguments,
2. n'a aucun effet de bord (pas d'I/O, pas de mutation externe, pas de lecture de globals).

Les fonctions pures se testent sans setup, sans mock, sans `async` :

```ts
// Logique pure : toujours testable à coût zéro
function buildInvitationEmail(email: string, familyId: string): { to: string; subject: string; text: string } {
  return {
    to: email,
    subject: 'Vous êtes invité dans une famille TribuZen',
    text: `Bonjour ! La famille ${familyId} vous invite à rejoindre TribuZen.`,
  };
}

// Test : aucun mock, résultat déterministe
it('construit l'email d'invitation', () => {
  const mail = buildInvitationEmail('bob@tribu.fr', 'fam-42');
  expect(mail.to).toBe('bob@tribu.fr');
  expect(mail.text).toContain('fam-42');
});
```

**Extraire la logique pure de l'I/O** est le refactoring le plus rentable. La forme avant/après :

```ts
// AVANT : logique métier noyée dans l'I/O
async function computeAndSendDigest(familyId: string): Promise<void> {
  const members = await db.query('SELECT * FROM members WHERE family_id = $1', [familyId]);
  const count = members.rows.length;
  const names = members.rows.map((m: { name: string }) => m.name).join(', ');
  await mailer.send('admin@tribu.fr', 'Digest', `Famille ${familyId} — ${count} membres : ${names}`);
}

// APRÈS : logique pure extraite, I/O dans une couche fine
function buildDigestBody(familyId: string, members: { name: string }[]): string {
  const names = members.map((m) => m.name).join(', ');
  return `Famille ${familyId} — ${members.length} membres : ${names}`;
}

async function sendFamilyDigest(
  familyId: string,
  deps: { repo: { getMembers(id: string): Promise<{ name: string }[]> }; mailer: Mailer }
): Promise<void> {
  const members = await deps.repo.getMembers(familyId);          // I/O ici seulement
  const body = buildDigestBody(familyId, members);               // logique pure ici seulement
  await deps.mailer.send('admin@tribu.fr', 'Digest', body);     // I/O ici seulement
}
```

`buildDigestBody` se teste sans mock. `sendFamilyDigest` se teste avec des stubs injectés.

### Ports et adaptateurs (Hexagonal Architecture)

Alistair Cockburn (2005) : le **cœur domaine** ne connaît que des **ports** (interfaces). Les **adaptateurs** implémentent ces ports pour chaque technologie.

```
┌─────────────┐     Port entrant      ┌────────────────────┐     Port sortant     ┌──────────────────┐
│ REST/CLI    │ ──(InviteUseCase)──> │   InvitationService  │ ─(InvitationRepo)─> │ PrismaRepo /     │
│ (adapter)   │                      │   (domaine pur)      │ ─(Mailer)─────────> │ NodeMailer /     │
└─────────────┘                      └────────────────────┘                       │ InMemoryFake     │
                                                                                   └──────────────────┘
```

Conséquence pour le test : le domaine se teste en substituant les adaptateurs par des **fakes** ou **stubs**. Les adaptateurs (Prisma, NodeMailer) se testent séparément en tests d'intégration.

```ts
// Port sortant (owned by domain)
export interface InvitationRepository {
  existsPending(familyId: string, email: string): Promise<boolean>;
  save(familyId: string, email: string): Promise<{ id: string }>;
}

// Fake adapter (pour les tests unitaires de domaine)
export class InMemoryInvitationRepo implements InvitationRepository {
  private store = new Map<string, { familyId: string; email: string; id: string }>();

  async existsPending(familyId: string, email: string): Promise<boolean> {
    return [...this.store.values()].some(
      (inv) => inv.familyId === familyId && inv.email === email
    );
  }

  async save(familyId: string, email: string): Promise<{ id: string }> {
    const id = `inv-${this.store.size + 1}`;
    this.store.set(id, { familyId, email, id });
    return { id };
  }
}

// Real adapter (production — non testé en unitaire)
export class PrismaInvitationRepo implements InvitationRepository {
  constructor(private prisma: PrismaClient) {}
  async existsPending(familyId: string, email: string): Promise<boolean> {
    const count = await this.prisma.invitation.count({
      where: { familyId, email, status: 'pending' },
    });
    return count > 0;
  }
  async save(familyId: string, email: string): Promise<{ id: string }> {
    const inv = await this.prisma.invitation.create({ data: { familyId, email, status: 'pending' } });
    return { id: inv.id };
  }
}
```

### Humble Object Pattern

Michael Feathers (*Working Effectively with Legacy Code*, 2004), repris par Robert C. Martin : quand un objet est difficile à tester parce qu'il est entrelacé avec l'environnement (UI, réseau, système de fichiers), on le **sépare en deux** :

- **L'humble object** : si mince qu'on peut lui faire confiance sans test — il ne contient que la colle entre l'environnement et la logique.
- **L'objet testable** : reçoit les données brutes et retourne des résultats — aucune dépendance à l'environnement.

Exemple TribuZen — contrôleur REST d'invitation :

```ts
// AVANT : logique métier dans le handler HTTP (impossible à tester unitairement sans HTTP)
app.post('/families/:id/invitations', async (req, res) => {
  const { familyId } = req.params;
  const { email } = req.body;
  const exists = await prisma.invitation.count({ where: { familyId, email } });
  if (exists) return res.status(409).json({ error: 'ALREADY_INVITED' });
  const inv = await prisma.invitation.create({ data: { familyId, email, status: 'pending' } });
  await nodemailer.sendMail({ to: email, subject: 'Invitation', text: `Famille ${familyId}` });
  return res.status(201).json({ id: inv.id });
});

// APRÈS : Humble Object Pattern
// 1. L'objet testable (logique domaine — déjà vu plus haut)
export class InvitationService {
  constructor(private repo: InvitationRepository, private mailer: Mailer) {}
  async invite(familyId: string, email: string) { /* ... */ }
}

// 2. L'humble handler (colle HTTP — trivial, presque pas de logique)
app.post('/families/:id/invitations', async (req, res) => {
  try {
    const result = await service.invite(req.params.id, req.body.email as string);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_INVITED') {
      return res.status(409).json({ error: 'ALREADY_INVITED' });
    }
    return res.status(500).json({ error: 'INTERNAL' });
  }
});
```

Le handler HTTP est *humble* : il ne contient que la traduction HTTP → domaine et domaine → HTTP. `InvitationService` contient toute la logique et se teste en Vitest pur.

### Coutures (seams) pour isoler du code couplé

Michael Feathers définit une **couture (seam)** comme un endroit où l'on peut changer le comportement d'un programme *sans modifier ce code*. Il en identifie trois types pertinents en TypeScript :

**Object seam** — couture par injection de dépendances (la meilleure) :

```ts
// La couture est le constructeur : on substitue le repo sans toucher à la logique
const service = new InvitationService(stubRepo, spyMailer);
```

**Link seam** — couture au niveau des imports, exploitée par `vi.mock` :

```ts
// Quand le code importe en dur (pas injectable), vi.mock intercepte à la « couture » du module
vi.mock('../mailer', () => ({ mailer: { send: vi.fn() } }));
```

C'est la solution de *dernier recours* pour du code legacy non injectable. On préfère toujours créer une object seam (DI) si on contrôle le code.

**Couture temporelle** — `vi.useFakeTimers()` crée une couture sur `Date` et les timers :

```ts
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-07-01T10:00:00Z'));
// le code qui appelle new Date() obtient cette valeur
```

**Règle** : préférer les object seams (DI) aux link seams (`vi.mock`). Les link seams couplent le test à la structure des fichiers ; les object seams couplent le test aux interfaces.

### Séparer logique métier et I/O : la règle des couches

Un service testable suit un découpage en trois niveaux :

```
┌──────────────────────────────────────────────────┐
│  Couche I/O (humble) — handler, adapter Prisma  │  ← difficile à tester, garder fine
├──────────────────────────────────────────────────┤
│  Couche orchestration — service (DI)             │  ← testable avec stubs
├──────────────────────────────────────────────────┤
│  Couche logique pure — fonctions pures           │  ← testable sans mock
└──────────────────────────────────────────────────┘
```

Heuristique : si une fonction appelle `await`, elle traverse une couture I/O. La logique qui ne dépend pas de l'`await` doit être extraite vers la couche pure.

### Testabilité par conception

Concevoir pour la testabilité dès le départ est moins coûteux que de refactorer du code couplé. Les signaux qui indiquent un problème de conception (et de testabilité) :

- `new SomeService()` à l'intérieur d'une méthode → object seam manquante, extraire en DI.
- `import { db } from '../db'` suivi de `db.query()` dans la logique → link seam, extraire un port.
- `Date.now()` ou `Math.random()` sans injection → non déterministe, extraire en dépendance injectable (`clock.now()`).
- Méthode de 80 lignes qui lit, calcule, écrit et notifie → Humble Object, extraire la logique pure.
- Singleton (`AppConfig.getInstance()`) → état global, passer en paramètre.

## 3. Worked examples

### Exemple A — Refactorer `inviteMember` couplé vers `InvitationService` injectable

**Étape 1 — identifier les dépendances cachées** : `db` (Postgres) et `mailer` (SMTP). Ce sont des *link seams* implicites.

**Étape 2 — définir les ports** : deux interfaces qui décrivent le comportement attendu, sans mentionner Prisma ou NodeMailer.

**Étape 3 — injecter par constructeur** :

```ts
// src/invitation/invitation-service.ts  — VERSION TESTABLE
export interface InvitationRepository {
  existsPending(familyId: string, email: string): Promise<boolean>;
  save(familyId: string, email: string): Promise<{ id: string }>;
}

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export class InvitationService {
  constructor(
    private readonly repo: InvitationRepository,
    private readonly mailer: Mailer
  ) {}

  async invite(familyId: string, email: string): Promise<{ id: string }> {
    if (await this.repo.existsPending(familyId, email)) {
      throw new Error('ALREADY_INVITED');
    }
    const invitation = await this.repo.save(familyId, email);
    await this.mailer.send(
      email,
      'Vous êtes invité dans une famille TribuZen',
      `La famille ${familyId} vous invite.`
    );
    return invitation;
  }
}
```

**Étape 4 — tester avec stubs et spy injectés** :

```ts
// src/invitation/invitation-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationService, type InvitationRepository, type Mailer } from './invitation-service';

describe('InvitationService.invite', () => {
  let repo: InvitationRepository;
  let mailer: Mailer;
  let service: InvitationService;

  beforeEach(() => {
    // STUB repo : réponses figées — on contrôle l'état du monde que voit le service
    repo = {
      existsPending: vi.fn().mockResolvedValue(false),
      save: vi.fn().mockResolvedValue({ id: 'inv-1' }),
    };
    // SPY mailer : on vérifiera comment il est appelé (behavior verification)
    mailer = { send: vi.fn().mockResolvedValue(undefined) };
    service = new InvitationService(repo, mailer);
  });

  afterEach(() => vi.clearAllMocks());

  it('persiste puis notifie exactement une fois (cas nominal)', async () => {
    const result = await service.invite('fam-1', 'bob@tribu.fr');

    expect(result).toEqual({ id: 'inv-1' });
    expect(repo.save).toHaveBeenCalledWith('fam-1', 'bob@tribu.fr');
    expect(mailer.send).toHaveBeenCalledOnce();
    expect(mailer.send).toHaveBeenCalledWith(
      'bob@tribu.fr',
      'Vous êtes invité dans une famille TribuZen',
      expect.stringContaining('fam-1')
    );
  });

  it('rejette ALREADY_INVITED sans persister ni notifier', async () => {
    vi.mocked(repo.existsPending).mockResolvedValue(true);

    await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('ALREADY_INVITED');

    expect(repo.save).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });
});
```

Pas-à-pas : (1) `repo` est un stub — il pilote la branche prise par `invite()` ; (2) `mailer` est un spy — on vérifie le protocole d'appel ; (3) aucun `vi.mock` — la DI suffit ; (4) le test est instantané et déterministe.

### Exemple B — Fake repository vs stub : quand choisir

Le **stub** (`vi.fn()`) convient quand on contrôle une réponse isolée par test. Le **fake** (classe en mémoire) convient quand plusieurs appels s'enchaînent et que l'état doit être cohérent.

```ts
// Fake InMemory — implémentation vraie mais sans Prisma
class InMemoryInvitationRepo implements InvitationRepository {
  private store = new Map<string, { familyId: string; email: string }>();

  async existsPending(familyId: string, email: string): Promise<boolean> {
    return [...this.store.values()].some(
      (inv) => inv.familyId === familyId && inv.email === email
    );
  }

  async save(familyId: string, email: string): Promise<{ id: string }> {
    const id = `inv-${this.store.size + 1}`;
    this.store.set(id, { familyId, email });
    return { id };
  }
}

// Le test avec fake : l'état du repo est cohérent entre les appels
it('rejette le doublon après une première invitation valide', async () => {
  const repo = new InMemoryInvitationRepo();
  const mailer: Mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const service = new InvitationService(repo, mailer);

  await service.invite('fam-1', 'bob@tribu.fr');                          // 1ère : OK
  await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('ALREADY_INVITED'); // 2ème : rejeté

  expect(mailer.send).toHaveBeenCalledOnce(); // une seule notif envoyée
});
```

Avec un stub, il faudrait enchaîner `mockResolvedValueOnce(false).mockResolvedValueOnce(true)` — moins lisible et couplé à l'ordre des appels internes.

## 4. Pièges & misconceptions

- **DI à outrance.** Injecter des dépendances qui n'ont aucune raison de varier (un pur utilitaire de formatage de date) alourdit l'API sans gain de testabilité. *Correct* : injecter uniquement ce qui franchit une frontière d'I/O ou de non-déterminisme.

- **Logique dans la couche I/O.** Glisser un calcul dans le `PrismaInvitationRepo` (`compute` dans l'adapter) rend la logique non testable unitairement. *Correct* : les adapters ne font que traduire entre le port et la technologie — toute logique appartient au service ou aux fonctions pures.

- **Mocker ce qu'on ne possède pas.** Mocker directement `prisma.invitation.create` ou `nodemailer.sendMail` rend le test fragile : si l'API tierce change, le mock ment et le test reste vert. *Correct* : définir un port (`InvitationRepository`, `Mailer`) que tu possèdes, mocker ce port dans les tests unitaires, tester l'adapter réel séparément (test d'intégration).

- **Humble Object trop gros.** Si le handler HTTP contient de la logique conditionnelle (calculs de prix, règles de validation), il n'est plus humble et devient non testable. *Correct* : tout ce qui est conditionnel doit vivre dans le service ou les fonctions pures ; le handler ne fait que router.

- **Link seam (vi.mock) par défaut.** `vi.mock('../mailer')` en reflex bloque le refactoring : si on renomme ou déplace le module, le mock casse. *Correct* : `vi.mock` est réservé au code legacy non injectable. Sur du code nouveau, créer l'object seam (DI) d'emblée.

- **Confondre port et adapter dans les tests.** Passer le `PrismaInvitationRepo` réel dans un test unitaire n'est pas une faute de DI, c'est une faute de niveau : tu fais involontairement un test d'intégration. *Correct* : tests unitaires = ports substitués par fakes/stubs ; tests d'intégration = adapter réel contre une vraie DB de test.

## 5. Ancrage TribuZen

Couche fil-rouge : **refactorer le service d'invitation TribuZen pour le rendre testable** (`smaurier/tribuzen`).

- La fonction `inviteMember` couplée à Prisma et NodeMailer devient `InvitationService` avec `InvitationRepository` et `Mailer` injectés — exactement la structure de la section 2.
- `PrismaInvitationRepo` et `NodeMailer` sont les adapters de production : ils implémentent les ports et se testent en tests d'intégration (module 09).
- `InMemoryInvitationRepo` est le fake utilisé en test unitaire et potentiellement en développement local (sans base lancée).
- Le handler Express/Fastify reste *humble* : il reçoit `req`, délègue à `service.invite()`, traduit l'erreur en statut HTTP. Aucun test unitaire sur le handler — trop peu de logique pour en valoir la peine ; les tests de bout en bout (module 10) couvrent ce niveau.
- L'ancre future : quand TribuZen ajoute une notification push en plus du mail, on ajoute un `PushNotifier` au port — le service reçoit un troisième paramètre, les tests unitaires injectent un second spy. Zéro changement à la logique.

## 6. Points clés

1. L'injection de dépendances transforme une link seam (`vi.mock`) en object seam (argument) — plus stable et plus lisible.
2. Les fonctions pures se testent sans setup, sans mock, sans `async` : extraire la logique pure de l'I/O est le refactoring de testabilité le plus rentable.
3. Ports et adaptateurs : le domaine définit les ports (interfaces), les adapters implémentent les technologies ; seul le domaine se teste unitairement.
4. Humble Object Pattern : diviser un objet couplé à l'environnement en un objet humble (colle triviale) et un objet testable (logique pure injectée).
5. Une couture (seam) est un point de substitution sans modifier le code cible — object seam (DI) > link seam (`vi.mock`) > couture temporelle (fake timers).
6. Signe d'alerte : `new SomeService()` ou un import d'I/O dans la logique métier signale une couture manquante.
7. Stub quand les appels sont indépendants et simples ; fake quand l'état entre plusieurs appels doit être cohérent.

## 7. Seeds Anki

```
Qu'est-ce qu'une couture (seam) selon Michael Feathers ?|Un endroit dans le code où l'on peut changer le comportement sans modifier ce code — object seam (DI), link seam (vi.mock), couture temporelle (fake timers)
Quelle est la différence entre un port et un adapter ?|Le port est l'interface définie par le domaine ; l'adapter est l'implémentation concrète (Prisma, NodeMailer) — le domaine dépend du port, pas de l'adapter
Humble Object Pattern — quel est le principe ?|Diviser un objet difficile à tester en deux : l'humble (colle triviale sans logique) et le testable (logique pure injectable)
Quand préférer un fake à un stub ?|Quand plusieurs appels successifs doivent maintenir un état cohérent (ex. save puis existsPending renvoie true) — un stub enchaîné est fragile et moins lisible
Pourquoi éviter de mocker directement prisma ou nodemailer ?|Ces APIs tierces peuvent changer sans que le mock le détecte — le test reste vert alors que le vrai code est cassé. Envelopper dans un port qu'on possède
Quelle règle simple indique qu'une fonction doit être extraite en logique pure ?|Si elle ne contient aucun await et ne lit aucun état externe, elle est pure et doit vivre dans la couche logique pure, pas dans le service
Différence entre object seam et link seam pour la testabilité ?|Object seam = dépendance injectée (stable, refactorable) ; link seam = vi.mock sur le chemin d'import (fragile si renommage, réservé au code legacy)
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-06-architecture-testable/`. Tu refactores le `inviteMember` couplé en `InvitationService` injectable, tu écris les tests unitaires (stub repo + spy mailer), tu implémentes un `InMemoryInvitationRepo` (fake), et tu appliques le Humble Object Pattern sur un handler HTTP minimal.
