# Lab 04 — Mocking et test doubles

> **Outcome :** à la fin, tu sais isoler un service par injection de dépendances et écrire ses test doubles (stub, spy, mock), mocker un module avec `vi.hoisted`/`vi.mock`, et tester du code temporel avec les fake timers — en **Vitest réel**.
> **Vrai outil :** Vitest (`vi.fn`, `vi.spyOn`, `vi.mock`, `vi.hoisted`, fake timers). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

On part de la logique d'invitation TribuZen. Code de départ (déjà fourni, **ne le modifie pas** — tu écris les tests) :

```typescript
// src/invitation/invitation-service.ts
export interface InvitationRepo {
  existsPending(familyId: string, email: string): Promise<boolean>;
  save(familyId: string, email: string): Promise<{ id: string }>;
}
export interface Notifier {
  sendInvitationEmail(email: string, familyId: string): Promise<void>;
}

export class InvitationService {
  constructor(private repo: InvitationRepo, private notifier: Notifier) {}

  async invite(familyId: string, email: string): Promise<{ id: string }> {
    if (await this.repo.existsPending(familyId, email)) throw new Error('ALREADY_INVITED');
    const invitation = await this.repo.save(familyId, email);
    await this.notifier.sendInvitationEmail(email, familyId);
    return invitation;
  }
}
```

```typescript
// src/invitation/reminder-service.ts
import { sendEmail } from './email'; // module importé en dur (non injectable)
export function scheduleReminder(email: string, delayMs: number) {
  setTimeout(() => { void sendEmail(email, 'Rappel : invitation en attente'); }, delayMs);
}
```

Ta mission : écrire `invitation-service.test.ts` et `reminder-service.test.ts` qui couvrent tout le comportement, **sans base de données ni email réel**.

## Étapes (en friction)

1. **Doubles par DI.** Dans `beforeEach`, construis un **stub** `repo` (`existsPending`→`false`, `save`→`{ id: 'inv-1' }`) et un **spy** `notifier` avec `vi.fn()`. Injecte-les dans `new InvitationService(...)`.
2. **Cas nominal.** Teste que `invite('fam-1','bob@tribu.fr')` retourne `{ id: 'inv-1' }`, persiste avec les bons arguments, et notifie **exactement une fois** avec les bons arguments (`toHaveBeenCalledOnce`, `toHaveBeenCalledWith`).
3. **Cas doublon.** Reconfigure `existsPending`→`true` (`vi.mocked(...).mockResolvedValue(true)`), assert que `invite` **rejette** `ALREADY_INVITED` et que **ni** `save` **ni** `sendInvitationEmail` ne sont appelés (`not.toHaveBeenCalled`).
4. **Mock de module.** Pour `reminder-service`, tu ne peux pas injecter `sendEmail` : utilise `vi.hoisted` + `vi.mock('./email', ...)` pour le remplacer par un `vi.fn()`.
5. **Fake timers.** `vi.useFakeTimers()` ; prouve qu'à 23 h rien n'est envoyé et qu'à 24 h le rappel part. Restaure avec `vi.useRealTimers()` en `afterEach`.
6. **Discipline.** Reset des mocks en `afterEach` (`vi.clearAllMocks()`), zéro fuite entre tests.

Contrainte : **n'utilise pas `vi.mock` pour `InvitationService`** — la DI doit suffire. `vi.mock` est réservé au module `./email` non injectable.

## Corrigé complet commenté

```typescript
// src/invitation/invitation-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationService, type InvitationRepo, type Notifier } from './invitation-service';

describe('InvitationService.invite', () => {
  let repo: InvitationRepo;
  let notifier: Notifier;
  let service: InvitationService;

  beforeEach(() => {
    // STUB repo : réponses figées → on contrôle les entrées du service.
    // existsPending=false = chemin nominal ; save renvoie un id déterministe.
    repo = {
      existsPending: vi.fn().mockResolvedValue(false),
      save: vi.fn().mockResolvedValue({ id: 'inv-1' }),
    };
    // SPY/MOCK notifier : on vérifiera COMMENT il est appelé (behavior verification).
    notifier = { sendInvitationEmail: vi.fn().mockResolvedValue(undefined) };
    // DI : aucune dépendance importée en dur → aucun vi.mock nécessaire.
    service = new InvitationService(repo, notifier);
  });

  afterEach(() => {
    vi.clearAllMocks(); // efface l'historique d'appels, garde les implémentations
  });

  it('persiste puis notifie exactement une fois (cas nominal)', async () => {
    const result = await service.invite('fam-1', 'bob@tribu.fr');

    // state verification (sur le stub) : le résultat remonte bien
    expect(result).toEqual({ id: 'inv-1' });
    // le repo reçoit les bons arguments
    expect(repo.save).toHaveBeenCalledWith('fam-1', 'bob@tribu.fr');
    // behavior verification (sur le mock) : UNE seule notif, bons arguments
    expect(notifier.sendInvitationEmail).toHaveBeenCalledOnce();
    expect(notifier.sendInvitationEmail).toHaveBeenCalledWith('bob@tribu.fr', 'fam-1');
  });

  it('rejette un doublon sans persister ni notifier', async () => {
    // on reconfigure le stub pour CE test : email déjà invité
    vi.mocked(repo.existsPending).mockResolvedValue(true);

    // l'erreur métier est propagée
    await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('ALREADY_INVITED');

    // preuve d'absence d'effet de bord
    expect(repo.save).not.toHaveBeenCalled();
    expect(notifier.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it('propage une panne de notif (le notifier rejette)', async () => {
    // mock qui rejette → on vérifie que invite() ne masque pas l'erreur
    vi.mocked(notifier.sendInvitationEmail).mockRejectedValue(new Error('SMTP_DOWN'));

    await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('SMTP_DOWN');
    // l'invitation a tout de même été persistée AVANT l'échec d'envoi
    expect(repo.save).toHaveBeenCalledOnce();
  });
});
```

```typescript
// src/invitation/reminder-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 1. vi.hoisted : déclare la variable AVANT le hoisting de vi.mock,
//    sinon la factory référencerait une variable encore indéfinie (ReferenceError).
const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));

// 2. vi.mock (hoisté en tête de fichier) : remplace tout le module ./email.
//    sendEmail === sendEmailMock dans le code testé.
vi.mock('./email', () => ({ sendEmail: sendEmailMock }));

// 3. import APRÈS les mocks (l'ordre source ne reflète pas l'ordre d'exécution).
import { scheduleReminder } from './reminder-service';

describe('scheduleReminder', () => {
  beforeEach(() => {
    vi.useFakeTimers();   // remplace l'horloge → tests instantanés et déterministes
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();   // OBLIGATOIRE : sinon les fake timers fuient sur les autres fichiers
  });

  it("n'envoie rien avant l'échéance (23 h)", () => {
    scheduleReminder('bob@tribu.fr', 24 * 3600_000);
    vi.advanceTimersByTime(23 * 3600_000);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('envoie le rappel à 24 h', () => {
    scheduleReminder('bob@tribu.fr', 24 * 3600_000);
    vi.advanceTimersByTime(24 * 3600_000);
    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledWith('bob@tribu.fr', 'Rappel : invitation en attente');
  });
});
```

Points de validation par le coach : (a) la DI suffit pour `InvitationService` — aucun `vi.mock` dessus ; (b) on assert le **résultat** (stub) ET les **interactions** (mock) ; (c) le cas doublon prouve l'**absence** d'effet via `not.toHaveBeenCalled` ; (d) `vi.hoisted` résout le piège du hoisting ; (e) `useRealTimers` en `afterEach`.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 20 min**, et ajoute une contrainte : `InvitationService.invite` doit désormais **logguer** via un `Logger` injecté (`info(msg: string)`). Écris le test du cas nominal qui vérifie, avec un **spy** sur le logger, qu'exactement un log `invitation.created` est émis **après** la persistance — sans casser les autres tests. Bonus : remplace le stub `repo` par un **fake** (Map en mémoire implémentant `InvitationRepo`) et montre que les mêmes tests passent. Discrimine à voix haute : où est le stub, où est le spy, où est le fake ?

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `src/invitation/invitation-service.ts` (interfaces `InvitationRepo`/`Notifier` + classe) à partir des `types/index.ts` existants (`Invitation`, `Family`).
2. Écris `invitation-service.test.ts` avec stub repo + spy notifier injectés, en Vitest réel (`npm test` = `vitest run`, déjà configuré).
3. Garde le `Notifier` comme **adapter que tu possèdes** : tu mockes `Notifier`, jamais le SDK email directement (piège « mock what you don't own »).
4. Commit `smaurier/tribuzen` : `test(invitation): doubles Vitest réels (stub repo + spy notifier) sur invite()`.
