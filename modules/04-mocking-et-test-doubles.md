---
titre: Mocking et test doubles
cours: 06-testing
notions: [test-double, dummy, stub, spy, mock, fake, dependency-injection, vi.fn, vi.spyOn, vi.mock, vi.hoisted, mock-partiel, fake-timers, date-mocking, over-mocking, tester-le-comportement]
outcomes: [choisir le bon type de test double selon l'intention du test, isoler du code via injection de dépendances, écrire un spy/mock/fake avec l'API Vitest, mocker un module et des timers, éviter le sur-mock et le test de l'implémentation]
prerequis: [anatomie-dun-test, vitest-fondamentaux, assertions]
next: 05-tests-asynchrones
libs: [{ name: vitest, version: ^4.1.9 }]
tribuzen: tests logique domaine (invitation, RBAC) — Vitest réel
last-reviewed: 2026-06
---

# Mocking et test doubles

> **Outcomes — tu sauras FAIRE :** choisir le bon test double selon ce que le test doit prouver, isoler un service par injection de dépendances, écrire spy/mock/fake/partiel/fake-timers avec l'API Vitest réelle, et reconnaître le sur-mock et le test-de-l'implémentation.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, quand un membre invite quelqu'un dans sa famille, `InvitationService.invite()` doit : (a) refuser un email déjà invité, (b) persister l'invitation en base, (c) envoyer **exactement une** notification email. Tu veux tester cette logique **maintenant**, sans base Postgres lancée et sans envoyer de vrai email.

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
    if (await this.repo.existsPending(familyId, email)) {
      throw new Error('ALREADY_INVITED');
    }
    const invitation = await this.repo.save(familyId, email);
    await this.notifier.sendInvitationEmail(email, familyId);
    return invitation;
  }
}
```

Question centrale : comment remplacer `repo` (I/O base) et `notifier` (I/O réseau) par des **doublures** qui te laissent vérifier le comportement de `invite()` ? Réponse : les **test doubles**, injectés via le constructeur. La suite donne la taxonomie, l'API Vitest, et les pièges.

## 2. Théorie complète, concise

### Test double : définition

Un **test double** est tout objet qui remplace une dépendance réelle pendant un test (terme de Gerard Meszaros, popularisé par Martin Fowler). Cinq types, classés par **ce qu'ils font** et **ce qu'on vérifie**.

| Type | Comportement | On vérifie ? | Usage |
|------|--------------|--------------|-------|
| **Dummy** | rien | non | remplir un paramètre obligatoire jamais utilisé |
| **Stub** | réponses figées | non | contrôler les **entrées** que reçoit le code testé |
| **Spy** | réel **+** enregistre les appels | oui (les appels) | vérifier une **interaction** sans changer le comportement |
| **Mock** | configuré + enregistre, avec attentes | oui (le protocole) | vérifier *comment* une dépendance est appelée |
| **Fake** | implémentation simplifiée mais réelle | non | remplacer une infra lourde (DB en mémoire) |

Distinction clé **stub vs mock** (Fowler, *Mocks Aren't Stubs*) : un **stub** fait du *state verification* (on assert sur le résultat/l'état final) ; un **mock** fait du *behavior verification* (on assert sur les appels eux-mêmes — `toHaveBeenCalledWith`). Un **spy** est un mock qui laisse passer le vrai comportement.

### Injection de dépendances (DI) = condition de testabilité

On ne mocke bien que ce qu'on peut **substituer**. Si un service `import`e en dur sa base et son emailer, il faut le hack `vi.mock` au niveau module. Si au contraire il **reçoit** ses dépendances (constructeur ou paramètre), le test injecte des doubles sans aucun outil de mock de module :

```typescript
// Difficile à tester : dépendances importées en dur
import { db } from './db';
import { sendEmail } from './email';
export async function invite(email: string) { /* utilise db, sendEmail */ }

// Testable : dépendances injectées
export class InvitationService {
  constructor(private repo: InvitationRepo, private notifier: Notifier) {}
}
```

La DI est le levier #1 de testabilité : elle transforme un mock-de-module (fragile) en simple objet passé en argument.

### API Vitest des mock functions — `vi.fn()`

`vi.fn()` crée une fonction-mock qui enregistre ses appels et dont on pilote le retour.

```typescript
import { vi, expect } from 'vitest';

const fn = vi.fn();
fn('a'); fn('b', 2);

expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledTimes(2);
expect(fn).toHaveBeenCalledWith('b', 2);
expect(fn).toHaveBeenLastCalledWith('b', 2);
expect(fn).toHaveBeenNthCalledWith(1, 'a');

// Inspection brute
fn.mock.calls;     // [['a'], ['b', 2]]
fn.mock.lastCall;  // ['b', 2]
fn.mock.results;   // [{ type: 'return', value: undefined }, ...]
```

Piloter le retour :

```typescript
vi.fn().mockReturnValue(42);              // sync, toujours 42
vi.fn().mockReturnValueOnce(1).mockReturnValue(0); // séquence puis fallback
vi.fn().mockResolvedValue({ id: '1' });   // async résolu
vi.fn().mockRejectedValue(new Error('x')); // async rejeté
vi.fn().mockImplementation((a, b) => a + b); // logique custom
```

Réinitialisation (sémantiques distinctes — piège fréquent) :

- `mockClear()` : efface l'historique des appels, **garde** l'implémentation.
- `mockReset()` : efface appels **+** implémentation (retour `undefined`).
- `mockRestore()` : restaure l'implémentation **originale** (utile uniquement avec `vi.spyOn`).
- Globaux : `vi.clearAllMocks()`, `vi.resetAllMocks()`, `vi.restoreAllMocks()` (typiquement dans `afterEach`).

### Espionner une méthode existante — `vi.spyOn()`

`vi.spyOn(obj, 'method')` enveloppe une méthode existante : par défaut le **vrai** code s'exécute et on observe les appels (spy pur). Chaîner `.mockReturnValue/.mockImplementation` pour remplacer (mock).

```typescript
const spy = vi.spyOn(calc, 'add');          // comportement réel préservé
calc.add(2, 3);                             // renvoie 5 réellement
expect(spy).toHaveBeenCalledWith(2, 3);

vi.spyOn(calc, 'mul').mockReturnValue(999); // ici on remplace
vi.spyOn(console, 'error').mockImplementation(() => {}); // museler un effet de bord
vi.spyOn(Math, 'random').mockReturnValue(0.42);          // déterminisme
vi.spyOn(obj, 'prop', 'get').mockReturnValue('x');       // getter
```

Toujours rétablir : `afterEach(() => vi.restoreAllMocks())`, sinon le spy fuit sur les autres tests.

### Mocker un module entier — `vi.mock()`

Quand la dépendance est `import`ée en dur (pas injectable), `vi.mock(path)` remplace le module.

```typescript
// Auto-mock : toutes les exports deviennent des vi.fn()
vi.mock('./email');
import { sendEmail } from './email';
vi.mocked(sendEmail).mockResolvedValue(undefined);

// Factory : on fournit l'implémentation
vi.mock('./email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'abc' }),
}));
```

`vi.mock` est **hoisté** (remonté) en haut du fichier par Vitest, avant les `import`. Conséquence : la factory ne peut pas référencer une variable déclarée plus bas — elle n'existe pas encore.

### Hoisting des variables de mock — `vi.hoisted()`

```typescript
// PROBLÈME : mockSend est hoisté APRÈS sa lecture par vi.mock
const mockSend = vi.fn();
vi.mock('./email', () => ({ sendEmail: mockSend })); // ReferenceError

// SOLUTION : vi.hoisted remonte AUSSI, mais avant vi.mock
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock('./email', () => ({ sendEmail: mockSend }));
```

Ordre réel exécuté par Vitest : `vi.hoisted` → `vi.mock` → `import`.

### Mock partiel — garder le reste réel

```typescript
vi.mock('./utils/math', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/math')>();
  return { ...actual, multiply: vi.fn().mockReturnValue(100) };
});
```

`add` reste réel, seul `multiply` est mocké.

### Fake timers et fake date

Pour du code dépendant du temps (debounce, retry, `Date.now()`), on remplace l'horloge :

```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-06-30T12:00:00Z')); // fige l'heure
vi.advanceTimersByTime(300);   // avance de N ms → déclenche les timers dus
vi.advanceTimersToNextTimer(); // saute au prochain timer
vi.runAllTimers();             // vide la file
vi.getTimerCount();            // timers en attente
vi.useRealTimers();            // TOUJOURS restaurer en afterEach
```

### Mocker un global — `vi.stubGlobal()`

```typescript
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
// vi.unstubAllGlobals() pour rétablir
```

### Quand mocker / quand ne pas

- **Mocker** : I/O externe (réseau, DB, fichiers), non-déterminisme (`Date`, `Math.random`, crypto), lenteur, effets de bord (email, paiement).
- **Ne PAS mocker** : logique pure (calculs, validation, transformations), utils internes simples, DTO/POJO. Mocker le cœur de la logique métier vide le test de sens.

## 3. Worked examples

### Exemple A — spy + stub injectés via DI (notre cas TribuZen)

Objectif : prouver que `invite()` persiste l'invitation puis envoie **une seule** notification, et qu'un doublon lève `ALREADY_INVITED`. Aucune base, aucun email réel : on injecte un **stub** repo et un **spy** notifier.

```typescript
// src/invitation/invitation-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvitationService, type InvitationRepo, type Notifier } from './invitation-service';

describe('InvitationService.invite', () => {
  let repo: InvitationRepo;
  let notifier: Notifier;
  let service: InvitationService;

  beforeEach(() => {
    // STUB : réponses figées, on contrôle les ENTRÉES du service
    repo = {
      existsPending: vi.fn().mockResolvedValue(false),
      save: vi.fn().mockResolvedValue({ id: 'inv-1' }),
    };
    // SPY/MOCK : on vérifiera COMMENT il est appelé
    notifier = { sendInvitationEmail: vi.fn().mockResolvedValue(undefined) };
    service = new InvitationService(repo, notifier);
  });

  it('persiste puis notifie exactement une fois', async () => {
    const result = await service.invite('fam-1', 'bob@tribu.fr');

    expect(result).toEqual({ id: 'inv-1' });                       // state verification (stub)
    expect(repo.save).toHaveBeenCalledWith('fam-1', 'bob@tribu.fr');
    // behavior verification (mock) : protocole de la notif
    expect(notifier.sendInvitationEmail).toHaveBeenCalledOnce();
    expect(notifier.sendInvitationEmail).toHaveBeenCalledWith('bob@tribu.fr', 'fam-1');
  });

  it('rejette un doublon SANS notifier ni persister', async () => {
    // on REconfigure le stub pour ce cas : email déjà invité
    vi.mocked(repo.existsPending).mockResolvedValue(true);

    await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow('ALREADY_INVITED');

    expect(repo.save).not.toHaveBeenCalled();
    expect(notifier.sendInvitationEmail).not.toHaveBeenCalled();
  });
});
```

Pas-à-pas : (1) `beforeEach` reconstruit des doubles frais → isolation entre tests ; (2) `existsPending` est un **stub** qui pilote la branche prise ; (3) on assert sur le **résultat** (stub) ET sur les **appels** (mock) ; (4) le cas doublon prouve l'absence d'effet de bord via `not.toHaveBeenCalled()`. Zéro `vi.mock` : la DI a suffi.

### Exemple B — mocker un module + fake timers (fading)

Variante plus dure : un `ReminderService` importe en dur un module `./email` (pas injectable) et programme un rappel d'invitation après 24 h via `setTimeout`. On mocke le module avec `vi.hoisted` + `vi.mock`, et on contrôle le temps.

```typescript
// src/invitation/reminder-service.ts
import { sendEmail } from './email';
export function scheduleReminder(email: string, delayMs: number) {
  setTimeout(() => { void sendEmail(email, 'Rappel : invitation en attente'); }, delayMs);
}
```

```typescript
// src/invitation/reminder-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 1. hoisted : la variable existe AVANT vi.mock (lui-même hoisté)
const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
// 2. mock du module : sendEmail === sendEmailMock
vi.mock('./email', () => ({ sendEmail: sendEmailMock }));

import { scheduleReminder } from './reminder-service';

describe('scheduleReminder', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it("n'envoie rien avant l'échéance", () => {
    scheduleReminder('bob@tribu.fr', 24 * 3600_000);
    vi.advanceTimersByTime(23 * 3600_000); // 23 h
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('envoie le rappel à 24 h', () => {
    scheduleReminder('bob@tribu.fr', 24 * 3600_000);
    vi.advanceTimersByTime(24 * 3600_000); // 24 h
    expect(sendEmailMock).toHaveBeenCalledWith('bob@tribu.fr', 'Rappel : invitation en attente');
  });
});
```

Pas-à-pas : (1) `vi.hoisted` résout le piège du hoisting ; (2) `vi.mock` neutralise l'envoi réel ; (3) `useFakeTimers` rend le test instantané et déterministe ; (4) on prouve les deux frontières temporelles (avant/après échéance) sans attendre 24 h.

## 4. Pièges & misconceptions

- **Sur-mock (over-mocking).** Tout mocker (validator, formatter, repo, emailer, logger) → le test ne vérifie plus que « les mocks s'appellent », pas le comportement réel. *Correct* : ne mocker que l'**infrastructure** (I/O), garder la logique métier réelle et asserter dessus (ex. le total calculé passé à `save`).
- **Tester l'implémentation au lieu du comportement.** Asserter sur des détails internes (« la méthode privée `_format` a été appelée ») couple le test au code ; un refactor sans changement de comportement casse le test. *Correct* : asserter sur les **sorties observables** et les **interactions de bord** (ce qui est persisté, envoyé, retourné). Les `toHaveBeenCalledWith` sur les **collaborateurs externes** (`notifier`) sont légitimes ; sur les **détails internes**, non.
- **Mocker ce qu'on ne possède pas (« don't mock what you don't own »).** Mocker directement `fetch`, le SDK Stripe ou le client `pg` rend le test fragile : si l'API tierce change, le mock ment et le test reste vert. *Correct* : envelopper le tiers dans un **adapter** que tu possèdes (`Notifier`, `PaymentGateway`) et mocker **ton** interface ; tester l'intégration réelle du tiers à part (contract test / MSW).
- **Oublier de réinitialiser les mocks.** Sans `clearAllMocks`/`restoreAllMocks` en `afterEach`, l'historique d'appels et les `spyOn` fuient → tests qui passent/échouent selon l'ordre d'exécution. *Correct* : reset systématique, et `useRealTimers()` après tout `useFakeTimers()`.
- **Confondre `mockReset` et `mockClear`.** `mockReset` efface aussi l'implémentation → la fonction renvoie `undefined` et casse les tests suivants qui supposaient un retour. *Correct* : `mockClear` si tu veux garder le retour configuré, `mockReset` seulement pour repartir de zéro.
- **Stub là où il faut un mock (et l'inverse).** Vérifier l'envoi d'email via l'état final (impossible) au lieu d'un mock d'appel ; ou imposer un protocole d'appel strict sur une pure source de données (stub suffirait) → test rigide. *Correct* : mock = vérifier une **interaction** attendue ; stub = juste **fournir** une donnée d'entrée.

## 5. Ancrage TribuZen

Couche fil-rouge : **tests logique domaine (invitation, RBAC) — Vitest réel** (`smaurier/tribuzen`). Le module se branche directement sur le produit :

- `InvitationService` ci-dessus = la vraie logique d'invitation famille. En session, on écrit `invitation-service.test.ts` dans le repo TribuZen avec un **stub repo** + **spy notifier** injectés (DI), sans Postgres ni email réel.
- RBAC : `can(user, 'post:delete', resource)` se teste avec un **stub** de rôles et des assertions d'état (autorisé/refusé) — pas de mock, logique pure.
- Le `Notifier` est l'**adapter qu'on possède** : on mocke `Notifier`, jamais le SDK email directement (piège « mock what you don't own »).
- L'envoi réel d'email et la vraie persistance Prisma seront couverts plus tard en tests d'intégration (module 09) et MSW (module 08) — ici on reste sur la **logique**.

## 6. Points clés

1. Un test double remplace une dépendance ; 5 types selon comportement + ce qu'on vérifie : dummy, stub, spy, mock, fake.
2. Stub = state verification (assert sur l'état) ; mock = behavior verification (assert sur les appels) ; spy = mock qui garde le vrai comportement.
3. L'injection de dépendances rend le code testable sans mock de module : on passe les doubles en argument.
4. `vi.fn()` enregistre les appels (`mock.calls`) et pilote le retour (`mockReturnValue`/`mockResolvedValue`/`mockImplementation`).
5. `vi.spyOn` enveloppe une méthode réelle (spy), `.mockReturnValue` la remplace (mock) ; restaurer avec `restoreAllMocks`.
6. `vi.mock` est hoisté : utiliser `vi.hoisted` pour les variables, `importOriginal` pour un mock partiel.
7. Fake timers (`useFakeTimers`/`advanceTimersByTime`/`setSystemTime`) rendent le code temporel déterministe et instantané.
8. Pièges majeurs : sur-mock, tester l'implémentation, mocker ce qu'on ne possède pas, oublier le reset, confondre `mockReset`/`mockClear`.

## 7. Seeds Anki

```
Quels sont les 5 types de test doubles ?|Dummy, Stub, Spy, Mock, Fake
Différence stub vs mock ?|Stub = state verification (on assert sur l'état/le résultat) ; Mock = behavior verification (on assert sur les appels eux-mêmes)
Qu'est-ce qu'un spy en Vitest ?|Un double qui enregistre les appels tout en laissant s'exécuter le vrai comportement (vi.spyOn sans .mockImplementation)
Pourquoi l'injection de dépendances facilite le test ?|Elle permet de substituer une dépendance par un double passé en argument, sans recourir à vi.mock au niveau module
À quoi sert vi.hoisted() ?|À déclarer une variable de mock AVANT le hoisting de vi.mock, pour pouvoir la référencer dans la factory sans ReferenceError
Différence mockClear vs mockReset ?|mockClear efface l'historique des appels en gardant l'implémentation ; mockReset efface appels ET implémentation (retour undefined)
Que signifie « ne pas mocker ce qu'on ne possède pas » ?|Ne pas mocker un SDK/API tiers directement ; l'envelopper dans un adapter qu'on possède et mocker cette interface
Anti-pattern over-mocking : pourquoi est-ce mauvais ?|En mockant aussi la logique métier, le test ne vérifie plus que « les mocks s'appellent » et plus aucun comportement réel
Comment tester du code basé sur setTimeout sans attendre ?|vi.useFakeTimers() puis vi.advanceTimersByTime(ms), et vi.useRealTimers() en afterEach
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-04-mocking/`. Tu y écris, en **Vitest réel**, les doubles d'un `InvitationService` TribuZen (stub repo + spy notifier injectés), un mock de module avec `vi.hoisted`, et un test à fake timers. Corrigé complet commenté + variante J+30 dans le README du lab.
