# Lab 06 — Architecture testable

> **Outcome :** à la fin, tu sais refactorer un service couplé en code injectable, écrire ses tests unitaires (stub repo + spy mailer) en **Vitest réel**, implémenter un fake repository en mémoire, et appliquer le Humble Object Pattern sur un handler HTTP.
> **Vrai outil :** Vitest (`vi.fn`, `vi.mocked`, `describe`, `beforeEach`, `afterEach`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Code de départ — **ne le modifie pas encore** :

```ts
// src/invitation/invitation-service-legacy.ts
import { db } from '../db';       // pool pg importé en dur
import { mailer } from '../mailer'; // nodemailer importé en dur

export async function inviteMember(familyId: string, email: string): Promise<{ id: string }> {
  const res = await db.query(
    'SELECT id FROM invitations WHERE family_id = $1 AND email = $2 AND status = $3',
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

Ta mission : produire `invitation-service.ts` + `invitation-service.test.ts` + `invitation-repo.fake.ts` qui rendent ce comportement testable **sans base de données ni SMTP**.

## Étapes (en friction)

1. **Identifier les coutures.** Lis `inviteMember` et liste les deux dépendances qui t'empêchent de le tester sans infrastructure. Pour chacune, nomme si c'est une object seam ou une link seam.

2. **Définir les ports.** Crée `src/invitation/invitation-service.ts` avec deux interfaces : `InvitationRepository` (méthodes `existsPending` et `save`) et `Mailer` (méthode `send`). Décide de la signature exacte (types de retour, paramètres) **avant** d'écrire la classe.

3. **Implémenter la classe injectable.** Écris `InvitationService` avec injection par constructeur. La logique est identique à `inviteMember` — seuls les appels à `db` et `mailer` passent par les ports injectés.

4. **Tests unitaires — stub + spy.** Dans `invitation-service.test.ts`, crée un `beforeEach` qui construit un stub `repo` (`existsPending` → `false`, `save` → `{ id: 'inv-1' }`) et un spy `mailer` (`send` → `undefined`). Couvre trois cas :
   - Cas nominal : retourne `{ id: 'inv-1' }`, `save` reçu avec les bons args, `send` appelé exactement une fois.
   - Cas doublon : `existsPending` → `true`, l'erreur `ALREADY_INVITED` est lancée, ni `save` ni `send` ne sont appelés.
   - Cas panne mailer : `send` rejette, l'erreur est propagée, `save` a été appelé (l'invitation est persistée avant l'envoi).

5. **Fake repository.** Crée `src/invitation/invitation-repo.fake.ts` qui implémente `InvitationRepository` avec une `Map` en mémoire. Ajoute un test qui vérifie le comportement de doublon **avec le fake** (deux appels successifs à `invite` — le second doit rejeter `ALREADY_INVITED`). Discrimine à voix haute : où est le stub, où est le fake, où est le spy.

6. **Humble Object.** Écris un handler Express minimal (ou une fonction `handleInviteRequest`) qui reçoit `{ params: { familyId }, body: { email } }` et délègue à `service.invite`. Il traduit l'erreur `ALREADY_INVITED` en statut 409. Vérifie à voix haute : quelle logique reste dans le handler ?

7. **Discipline.** `afterEach(() => vi.clearAllMocks())` partout. Aucun `vi.mock` sur `InvitationService` — la DI doit suffire.

## Corrigé complet commenté

```ts
// src/invitation/invitation-service.ts

// Port sortant 1 : le repo que le domaine consomme — aucune mention de Prisma
export interface InvitationRepository {
  existsPending(familyId: string, email: string): Promise<boolean>;
  save(familyId: string, email: string): Promise<{ id: string }>;
}

// Port sortant 2 : le mailer que le domaine consomme — aucune mention de NodeMailer
export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

// Object seam : les deux dépendances sont injectées via le constructeur
export class InvitationService {
  constructor(
    private readonly repo: InvitationRepository,
    private readonly mailer: Mailer
  ) {}

  async invite(familyId: string, email: string): Promise<{ id: string }> {
    // Logique métier pure : la règle doublon ne dépend que du port
    if (await this.repo.existsPending(familyId, email)) {
      throw new Error('ALREADY_INVITED');
    }
    // Persistance via le port — pas de SQL direct
    const invitation = await this.repo.save(familyId, email);
    // Notification via le port — pas de nodemailer direct
    await this.mailer.send(
      email,
      'Vous êtes invité dans une famille TribuZen',
      `La famille ${familyId} vous invite à rejoindre TribuZen.`
    );
    return invitation;
  }
}
```

```ts
// src/invitation/invitation-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationService, type InvitationRepository, type Mailer } from './invitation-service';

describe('InvitationService.invite', () => {
  let repo: InvitationRepository;
  let mailer: Mailer;
  let service: InvitationService;

  beforeEach(() => {
    // STUB repo : réponses figées — on contrôle les entrées du service
    // Par défaut : chemin nominal (pas de doublon, save réussit)
    repo = {
      existsPending: vi.fn().mockResolvedValue(false),
      save: vi.fn().mockResolvedValue({ id: 'inv-1' }),
    };
    // SPY mailer : on vérifiera COMMENT il est appelé (behavior verification)
    mailer = { send: vi.fn().mockResolvedValue(undefined) };
    // Object seam : zéro vi.mock — on passe les doubles par le constructeur
    service = new InvitationService(repo, mailer);
  });

  afterEach(() => {
    // efface l'historique des appels, garde les implémentations pour le prochain test
    vi.clearAllMocks();
  });

  it('persiste puis notifie exactement une fois (cas nominal)', async () => {
    const result = await service.invite('fam-1', 'bob@tribu.fr');

    // state verification sur le stub : le retour remonte bien
    expect(result).toEqual({ id: 'inv-1' });
    // le repo a reçu les bons arguments
    expect(repo.save).toHaveBeenCalledWith('fam-1', 'bob@tribu.fr');
    // behavior verification sur le spy : exactement une notif, bons args
    expect(mailer.send).toHaveBeenCalledOnce();
    expect(mailer.send).toHaveBeenCalledWith(
      'bob@tribu.fr',
      'Vous êtes invité dans une famille TribuZen',
      expect.stringContaining('fam-1')
    );
  });

  it('rejette ALREADY_INVITED sans persister ni notifier', async () => {
    // On reconfigure le stub pour CE test : email déjà invité
    vi.mocked(repo.existsPending).mockResolvedValue(true);

    // L'erreur métier est propagée
    await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('ALREADY_INVITED');

    // Preuve d'absence d'effet de bord : ni persistance ni notification
    expect(repo.save).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('propage la panne mailer — l'invitation est persistée avant l'envoi', async () => {
    // Le mailer rejette : SMTP down, quota dépassé, etc.
    vi.mocked(mailer.send).mockRejectedValue(new Error('SMTP_DOWN'));

    // invite() ne masque pas l'erreur du mailer
    await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('SMTP_DOWN');

    // save a été appelé (avant send) — l'invitation existe en base
    expect(repo.save).toHaveBeenCalledOnce();
  });
});
```

```ts
// src/invitation/invitation-repo.fake.ts
import type { InvitationRepository } from './invitation-service';

// Fake : implémentation vraie mais sans Prisma — utile quand l'état entre
// plusieurs appels doit être cohérent (ce qu'un stub ne garantit pas facilement)
export class InMemoryInvitationRepo implements InvitationRepository {
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

  // helper de test : inspecter l'état du store
  count(): number { return this.store.size; }
}
```

```ts
// src/invitation/invitation-service-fake.test.ts
import { describe, it, expect, vi } from 'vitest';
import { InvitationService, type Mailer } from './invitation-service';
import { InMemoryInvitationRepo } from './invitation-repo.fake';

describe('InvitationService avec InMemoryInvitationRepo (fake)', () => {
  it('rejette le doublon après une première invitation valide', async () => {
    // FAKE repo : l'état est cohérent entre les deux appels à invite()
    const repo = new InMemoryInvitationRepo();
    // SPY mailer : on vérifie qu'une seule notif est envoyée au total
    const mailer: Mailer = { send: vi.fn().mockResolvedValue(undefined) };
    const service = new InvitationService(repo, mailer);

    // 1ère invitation : OK
    const first = await service.invite('fam-1', 'bob@tribu.fr');
    expect(first.id).toBe('inv-1');

    // 2ème invitation : doublon détecté par le fake (pas par une valeur mockée en dur)
    await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('ALREADY_INVITED');

    // Une seule notif envoyée, sur la 1ère invitation uniquement
    expect(mailer.send).toHaveBeenCalledOnce();
    // Le repo compte 1 entrée, pas 2
    expect(repo.count()).toBe(1);
  });
});
```

```ts
// src/invitation/invite-handler.ts — Humble Object Pattern
import type { InvitationService } from './invitation-service';

// Le handler est l'objet "humble" : si peu de logique qu'on n'a pas besoin de le tester unitairement.
// Toute la logique métier vit dans InvitationService — l'humble handler ne fait que router.
export function makeInviteHandler(service: InvitationService) {
  return async (
    req: { params: { familyId: string }; body: { email: string } },
    res: { status(code: number): { json(body: unknown): void } }
  ) => {
    try {
      const result = await service.invite(req.params.familyId, req.body.email);
      return res.status(201).json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_INVITED') {
        return res.status(409).json({ error: 'ALREADY_INVITED' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}
// Logique restante dans le handler : zéro calcul, zéro règle métier.
// Une seule décision : traduire ALREADY_INVITED → 409 / tout autre erreur → 500.
// C'est acceptable pour un humble object.
```

Points de validation par le coach :
- (a) `InvitationService` n'importe ni `db` ni `mailer` — les ports sont des interfaces.
- (b) Aucun `vi.mock` sur `InvitationService` ou ses ports — la DI suffit.
- (c) Le cas doublon prouve l'absence d'effet de bord via `not.toHaveBeenCalled`.
- (d) Le test avec le fake vérifie la cohérence d'état entre deux appels successifs.
- (e) Le handler ne contient aucune logique métier — c'est un humble object.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 25 min**, et ajoute une contrainte : `InvitationService.invite` doit maintenant vérifier que l'email est valide (contient `@`) **avant** d'appeler le repo. Ajoute l'erreur `INVALID_EMAIL`. Écris les tests qui couvrent ce nouveau cas — sans toucher aux tests existants. Bonus : implémente la validation comme une **fonction pure** exportée `validateInvitationEmail(email: string): boolean` et teste-la séparément, sans mock. Discrimine à voix haute : pourquoi cette fonction est pure, et où elle se situe dans le découpage couche logique/couche service/couche I/O.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `src/invitation/invitation-service.ts` avec les interfaces `InvitationRepository` et `Mailer` + la classe `InvitationService`.
2. Crée `src/invitation/invitation-repo.prisma.ts` : `PrismaInvitationRepo implements InvitationRepository` (adapter production — wrapping Prisma).
3. Écris `invitation-service.test.ts` (stub repo + spy mailer) et `invitation-service-fake.test.ts` (fake repo) en Vitest réel (`npm test`).
4. Branche le service dans le handler HTTP existant via `makeInviteHandler` — laisse le handler humble.
5. Commit `smaurier/tribuzen` : `refactor(invitation): DI du repo et du mailer — InvitationService injectable`.
