---
titre: Tests asynchrones
cours: 06-testing
notions: [async await dans un test, tester une promesse résolue, expect resolves et rejects, tester le rejet et l'erreur, fake timers vi.useFakeTimers, vi.advanceTimersByTime, vi.waitFor, piège de l'async non attendu]
outcomes: [tester du code asynchrone (promesses, async/await), tester le rejet d'une promesse, contrôler le temps avec les fake timers, attendre une condition avec vi.waitFor]
prerequis: [04-mocking-et-test-doubles]
next: 06-architecture-testable
libs: [{ name: vitest, version: ^4.1.9 }]
tribuzen: test d'un flux async TribuZen (envoi d'invitation par email avec délai/retry)
last-reviewed: 2026-07
---

# Tests asynchrones

> **Outcomes — tu sauras FAIRE :** tester du code asynchrone (promesses, async/await), vérifier le rejet d'une promesse, contrôler le temps avec les fake timers, attendre une condition avec `vi.waitFor`.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, après qu'une invitation est persistée, `InvitationMailer.send()` expédie un email de confirmation via SMTP. Le serveur est parfois instable : la fonction réessaie jusqu'à 3 fois, avec 2 secondes d'attente entre chaque tentative, avant de déclarer l'échec.

```typescript
// src/invitation/invitation-mailer.ts
export interface SmtpClient {
  sendMail(to: string, subject: string, body: string): Promise<void>;
}

export interface MailResult {
  sent: boolean;
  attempts: number;
  error?: string;
}

export class InvitationMailer {
  constructor(
    private smtp: SmtpClient,
    private maxRetries = 3,
    private retryDelayMs = 2000,
  ) {}

  async send(to: string, familyName: string): Promise<MailResult> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.smtp.sendMail(
          to,
          `Invitation TribuZen — famille ${familyName}`,
          `Vous avez été invité(e) à rejoindre la famille ${familyName}.`,
        );
        return { sent: true, attempts: attempt };
      } catch (err) {
        if (attempt === this.maxRetries) {
          return {
            sent: false,
            attempts: attempt,
            error: err instanceof Error ? err.message : 'UNKNOWN',
          };
        }
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
    }
    return { sent: false, attempts: this.maxRetries };
  }
}
```

Deux problèmes de test immédiats :

- **Promesses :** comment asserter sur un résultat ou un rejet de manière sûre — sans faux positif si on oublie `await` ?
- **Temps :** 3 retries × 2 secondes = 6 secondes de test minimum en temps réel. Inacceptable.

Ce module répond aux deux.

## 2. Théorie complète, concise

### async/await dans un test

Un test Vitest est une fonction ordinaire. Pour qu'il attende du code asynchrone, il doit être déclaré `async` — sinon le test se termine avant la résolution de la promesse, les assertions ne s'exécutent jamais, et le test est **vert à tort** (faux positif silencieux).

```typescript
import { it, expect } from 'vitest';

// FAUX POSITIF GARANTI : le test finit avant que la promesse se resolve
it('wrong', () => {
  fetchUser(1).then((user) => {
    expect(user.name).toBe('MAUVAIS NOM'); // jamais exécuté → test vert
  });
});

// CORRECT
it('correct', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Alice'); // exécuté, assert réelle
});
```

Règle universelle : **dès qu'un test touche une promesse, `async` + `await` sur chaque expression asynchrone**.

### Tester une promesse résolue — `.resolves`

`expect(promise).resolves` déplie la promesse et applique le matcher sur sa valeur résolue. L'`await` devant `expect` est **obligatoire** — sans lui, Vitest n'attend pas la promesse et le test passe même si elle rejette.

```typescript
// Les deux formes sont équivalentes
it('form 1 — await direct', async () => {
  const result = await fetchUser(1);
  expect(result).toEqual({ id: 1, name: 'Alice' });
});

it('form 2 — resolves (chaînable)', async () => {
  await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alice' });
  await expect(fetchUser(1)).resolves.toHaveProperty('name', 'Alice');
  await expect(fetchUser(1)).resolves.toBeTruthy();
});
```

Avantage de `.resolves` : chainable avec n'importe quel matcher, et le message d'échec indique clairement « promesse résolue avec valeur inattendue ».

### Tester le rejet et l'erreur — `.rejects`

```typescript
it('rejette pour id invalide', async () => {
  await expect(fetchUser(-1)).rejects.toThrow('not found');
  await expect(fetchUser(-1)).rejects.toThrow(NotFoundError);   // sur le type
  await expect(fetchUser(-1)).rejects.toThrow(/not found/i);    // regex
});

// Vérifier les propriétés de l'objet erreur
it('erreur détaillée', async () => {
  await expect(fetchUser(-1)).rejects.toMatchObject({
    message: expect.stringContaining('not found'),
    statusCode: 404,
  });
});

// Forme try/catch — verbeux mais utile pour inspecter l'erreur après
it('try/catch', async () => {
  let caught: Error | undefined;
  try {
    await fetchUser(-1);
  } catch (e) {
    caught = e as Error;
  }
  expect(caught).toBeInstanceOf(NotFoundError);
  expect(caught?.message).toContain('not found');
});
```

Piège classique : écrire `expect(p).rejects.toThrow(...)` sans `await` → la promesse d'assertion n'est pas attendue, le test est toujours vert, l'erreur n'est jamais vérifiée.

### Fake timers — `vi.useFakeTimers()`

Les fake timers remplacent `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `Date.now()` et d'autres globaux par des implémentations synthétiques que tu contrôles. Le temps ne s'écoule pas tout seul : tu dois l'avancer explicitement.

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  // Option : fixer l'heure de départ
  vi.setSystemTime(new Date('2026-07-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers(); // TOUJOURS restaurer — les fake timers fuient sur les autres tests
});
```

### `vi.advanceTimersByTime` vs `vi.advanceTimersByTimeAsync`

C'est le piège le plus fréquent quand le code combine timers et promesses :

| Méthode | Sync/Async | Flush les microtasks (.then, await) ? |
|---|---|---|
| `vi.advanceTimersByTime(ms)` | sync | **non** |
| `await vi.advanceTimersByTimeAsync(ms)` | async | **oui** |

Si le code sous test mêle `setTimeout` et `async/await` (comme `InvitationMailer`), la version sync avance l'horloge mais laisse les callbacks `.then`/`await` dans la file des microtasks — non exécutés. Le test assert sur un état intermédiaire ou est vert à tort.

```typescript
// PIÈGE : advanceTimersByTime ne flush pas les microtasks
it('wrong', () => {
  const fn = vi.fn();
  Promise.resolve().then(fn);      // microtask en attente
  vi.advanceTimersByTime(0);
  expect(fn).toHaveBeenCalled();   // ÉCHOUE : fn pas encore appelée
});

// CORRECT : advanceTimersByTimeAsync flush les microtasks
it('correct', async () => {
  const fn = vi.fn();
  Promise.resolve().then(fn);
  await vi.advanceTimersByTimeAsync(0);
  expect(fn).toHaveBeenCalled();   // PASSE
});
```

**Règle :** dès que le code sous test utilise `await` à l'intérieur d'un timer, utilise `vi.advanceTimersByTimeAsync`.

### Autres commandes de fake timers

```typescript
vi.runAllTimers();              // déclenche TOUS les timers en attente (sync)
await vi.runAllTimersAsync();   // idem + flush microtasks (async)
vi.advanceTimersToNextTimer();  // saute exactement au prochain timer
vi.getTimerCount();             // combien de timers en attente ?
```

### `vi.waitFor`

`vi.waitFor(callback, options?)` réessaie le callback à intervalles réguliers jusqu'à ce qu'il s'exécute **sans lever d'exception** (ou jusqu'au timeout). Retourne la valeur renvoyée par le callback.

```typescript
// Signature
function waitFor<T>(
  callback: () => T | Promise<T>,
  options?: { timeout?: number; interval?: number },
): Promise<T>

// Usage — lever = « réessaie » ; ne pas lever = « succès »
await vi.waitFor(
  () => {
    if (!server.isReady) throw new Error('not ready');
    return server.port; // valeur retournée par waitFor
  },
  { timeout: 2000, interval: 50 }, // défauts : 1000 ms / 50 ms
);

// Avec assertion directe
await vi.waitFor(() => {
  expect(queue.size).toBe(0); // rejette (via expect) tant que non vrai
});
```

`vi.waitFor` est conçu pour du **vrai temps qui s'écoule** (conditions émergentes, services démarrés en arrière-plan). Avec des fake timers actifs, les `setTimeout` internes du polling ne s'avancent pas — préférer `vi.advanceTimersByTimeAsync` quand on contrôle tout l'horaire.

### Piège de l'async non attendu — le faux positif silencieux

```typescript
// PIÈGE — 3 variantes du même faux positif
it('v1 : pas async, pas await', () => {
  expect(rejectingPromise()).rejects.toThrow('boom'); // jamais attendu → toujours VERT
});

it('v2 : async mais pas await', async () => {
  expect(rejectingPromise()).rejects.toThrow('boom'); // promesse d'assertion non attendue → toujours VERT
});

// CORRECT et explicite
it('v4 : await devant expect', async () => {
  await expect(rejectingPromise()).rejects.toThrow('boom'); // ROUGE si ça ne rejette pas
});
```

Vitest 4+ peut émettre un avertissement sur les promesses non attendues, mais ne les fait pas systématiquement échouer. **La discipline `await` est la seule garantie.**

## 3. Worked examples

### Exemple A — tester `InvitationMailer` (cas nominal, retry, épuisement)

Objectif : prouver que `send()` retourne la bonne structure dans les trois branches — sans vrai SMTP, sans attente réelle.

```typescript
// src/invitation/invitation-mailer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationMailer, type SmtpClient } from './invitation-mailer';

describe('InvitationMailer.send', () => {
  let smtp: SmtpClient;
  let mailer: InvitationMailer;

  beforeEach(() => {
    vi.useFakeTimers();                                          // remplace setTimeout
    smtp = { sendMail: vi.fn().mockResolvedValue(undefined) };  // stub nominal
    mailer = new InvitationMailer(smtp, 3, 2000);
  });

  afterEach(() => {
    vi.useRealTimers();    // restauration obligatoire — évite la fuite sur les autres tests
    vi.clearAllMocks();    // efface l'historique d'appels, garde les implémentations
  });

  it('résout au premier essai', async () => {
    // resolves déplie la promesse et applique toEqual — await OBLIGATOIRE
    await expect(mailer.send('alice@tribu.fr', 'Martin')).resolves.toEqual({
      sent: true,
      attempts: 1,
    });
    expect(smtp.sendMail).toHaveBeenCalledOnce();
    expect(smtp.sendMail).toHaveBeenCalledWith(
      'alice@tribu.fr',
      'Invitation TribuZen — famille Martin',
      expect.stringContaining('Martin'),
    );
  });

  it('réessaie et réussit au 2e essai', async () => {
    vi.mocked(smtp.sendMail)
      .mockRejectedValueOnce(new Error('SMTP_TIMEOUT'))
      .mockResolvedValueOnce(undefined);

    // Lancer SANS await : la promesse est suspendue sur setTimeout(2000)
    // Si on awaitait ici, le test se bloquerait (deadlock) — le timer ne s'avancerait jamais
    const promise = mailer.send('alice@tribu.fr', 'Martin');

    // advanceTimersByTimeAsync : avance l'horloge ET flush les microtasks (await internes)
    // La version sync (advanceTimersByTime) ne flush pas → le retry ne s'enclenche pas
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toEqual({ sent: true, attempts: 2 });
    expect(smtp.sendMail).toHaveBeenCalledTimes(2);
  });

  it('déclare échec après 3 tentatives épuisées', async () => {
    vi.mocked(smtp.sendMail).mockRejectedValue(new Error('SMTP_DOWN'));

    const promise = mailer.send('alice@tribu.fr', 'Martin');

    await vi.advanceTimersByTimeAsync(2000); // délai avant retry 2
    await vi.advanceTimersByTimeAsync(2000); // délai avant retry 3

    // Le mailer CATCH l'erreur et retourne un objet → resolves (pas rejects)
    await expect(promise).resolves.toEqual({
      sent: false,
      attempts: 3,
      error: 'SMTP_DOWN',
    });
    expect(smtp.sendMail).toHaveBeenCalledTimes(3);
  });
});
```

Pas-à-pas :
- `vi.useFakeTimers()` **avant** la construction du mailer → `setTimeout` dans `send()` est fake dès le départ.
- On lance la promesse **sans** `await` pour garder la main et avancer l'horloge.
- `advanceTimersByTimeAsync` avance le clock ET flush tous les `await` internes du retry.
- `afterEach` restaure les vrais timers → zéro fuite.

### Exemple B — `vi.waitFor` sur une condition émergente

Objectif : tester une `InvitationQueue` qui traite les invitations en arrière-plan à intervalle fixe. On ne contrôle pas le timing interne ; on attend que la condition soit vraie.

```typescript
// src/invitation/invitation-queue.test.ts
import { describe, it, expect, vi } from 'vitest';
import { InvitationQueue } from './invitation-queue';

describe('InvitationQueue', () => {
  it('traite toutes les invitations et les marque envoyées', async () => {
    // Pas de fake timers : la queue tourne en vrai temps (20 ms par item)
    // vi.waitFor retente toutes les 30 ms jusqu'à succès ou timeout
    const queue = new InvitationQueue({ processingDelayMs: 20 });
    queue.enqueue('alice@tribu.fr');
    queue.enqueue('bob@tribu.fr');
    queue.start();

    await vi.waitFor(
      () => {
        // Lever = « la condition n'est pas encore remplie, réessaie »
        if (queue.pendingCount !== 0) throw new Error(`still ${queue.pendingCount} pending`);
        // Ne pas lever = « succès, on sort de waitFor »
      },
      { timeout: 500, interval: 30 },
    );

    expect(queue.sentCount).toBe(2);
    queue.stop();
  });

  it('échoue si le timeout est dépassé', async () => {
    const queue = new InvitationQueue({ processingDelayMs: 9999 }); // délai irréaliste
    queue.enqueue('alice@tribu.fr');
    queue.start();

    // vi.waitFor lève une erreur de timeout → .rejects.toThrow()
    await expect(
      vi.waitFor(
        () => { if (!queue.isEmpty) throw new Error('not done'); },
        { timeout: 100 },
      ),
    ).rejects.toThrow();

    queue.stop();
  });
});
```

Pas-à-pas : `vi.waitFor` gère la boucle de polling. La fonction callback lève une erreur si la condition n'est pas satisfaite — et `vi.waitFor` la réessaie jusqu'au timeout. Ici, vrai temps (pas de fake timers) car le timer interne de la queue est indépendant.

## 4. Pièges & misconceptions

- **Oublier `await` devant `expect(...).resolves/.rejects`.** Sans `await`, l'assertion retourne une promesse non attendue : le test se termine avant que la promesse ne soit vérifiée — toujours vert, jamais fiable. *Correct :* `await expect(promise).resolves.toEqual(...)` — les deux niveaux d'attente (test `async` + `await` sur `expect`) sont indispensables.

- **`vi.advanceTimersByTime` (sync) quand le code mêle timers et promesses.** La version synchrone avance l'horloge mais ne flush pas la file des microtasks : les callbacks `await` à l'intérieur des timers ne s'exécutent pas. Le test assert sur un état intermédiaire ou est vert à tort. *Correct :* `await vi.advanceTimersByTimeAsync(ms)` dès que le code sous test combine `setTimeout` et `async/await`.

- **Deadlock : `await promise` avant d'avancer le temps.** Si on `await send(...)` immédiatement, la promesse se bloque sur le `setTimeout` qu'on n'a pas encore avancé → le test timeout. *Correct :* lancer la promesse sans `await`, avancer le temps avec `advanceTimersByTimeAsync`, puis `await promise` (ou `await expect(promise).resolves`).

- **Oublier `vi.useRealTimers()` en `afterEach`.** Les fake timers fuient sur les tests suivants dans le même fichier et parfois au-delà. Des tests qui n'utilisent pas de fake timers commencent à échouer de façon imprévisible. *Correct :* `afterEach(() => vi.useRealTimers())` systématiquement après tout `useFakeTimers()`.

- **`vi.waitFor` avec des fake timers actifs.** Le polling interne de `vi.waitFor` repose sur des `setTimeout` réels — si les fake timers sont actifs, les intervalles de polling ne progressent pas. *Correct :* `vi.waitFor` est réservé aux contextes à vrai temps (intégration, UI, services démarrés en arrière-plan) ; utiliser `vi.advanceTimersByTimeAsync` pour les délais contrôlés.

## 5. Ancrage TribuZen

Couche fil-rouge : **test d'un flux async TribuZen (envoi d'invitation par email avec délai/retry)** (`smaurier/tribuzen`).

- `InvitationMailer` ci-dessus est la couche d'envoi email réelle de TribuZen. En session, on écrit `invitation-mailer.test.ts` dans le repo avec un stub `SmtpClient` (`vi.fn`) et les fake timers pour simuler les délais de retry — les tests passent en millisecondes, pas en minutes.
- `SmtpClient` est **l'adapter qu'on possède** (principe du module 04). On mocke l'interface TypeScript, jamais le SDK nodemailer/sendgrid directement (piège « don't mock what you don't own »).
- Le pattern `lancer sans await → avanceTimersByTimeAsync → await promise` sera systématique dans TribuZen pour tout flux avec timer : RBAC avec délai d'expiration de token, webhooks retryables, queue d'emails planifiés.
- `vi.waitFor` interviendra en module 08 (MSW) et module 09 (tests d'intégration) — quand le comportement émerge d'un vrai réseau ou d'une vraie base, sans contrôle d'horloge possible.

## 6. Points clés

1. Tout test touchant une promesse doit être `async`, et chaque expression asynchrone doit être `await`ée — sans ça, faux positif garanti.
2. `await expect(promise).resolves.toXxx(...)` et `await expect(promise).rejects.toThrow(...)` : l'`await` devant `expect` est obligatoire — sans lui, l'assertion n'est jamais vérifiée.
3. `vi.useFakeTimers()` remplace l'horloge globale ; toujours restaurer avec `vi.useRealTimers()` en `afterEach` pour éviter la fuite.
4. `vi.advanceTimersByTime(ms)` est synchrone et ne flush pas les microtasks ; utiliser `await vi.advanceTimersByTimeAsync(ms)` dès que le code sous test mêle timers et `async/await`.
5. Avec des retries async : lancer la promesse **sans `await`**, avancer le temps, puis asserter — sinon deadlock de test.
6. `vi.waitFor(fn, { timeout, interval })` retente `fn` (défauts 1000 ms / 50 ms) jusqu'à ce qu'elle ne lève plus — conçu pour du vrai temps, pas pour les fake timers.
7. `vi.runAllTimersAsync()` déclenche tous les timers en attente ET flush les microtasks — utile quand on ne connaît pas le délai exact mais qu'on veut vider la file.
8. La distinction `.resolves` vs `.rejects` ne dépend pas de si le code lève une erreur : un service qui **attrape** l'erreur et retourne un objet échec → `.resolves` ; un service qui **propage** l'erreur → `.rejects`.

## 7. Seeds Anki

```
Pourquoi un test async sans await est un faux positif ?|Le test se termine avant la résolution de la promesse — les assertions ne s'exécutent jamais, le test est toujours vert
Syntaxe exacte pour tester qu'une promesse résout avec une valeur ?|await expect(maFonction()).resolves.toEqual(valeur) — l'await devant expect est obligatoire
Syntaxe exacte pour tester qu'une promesse rejette avec un message ?|await expect(maFonction()).rejects.toThrow('message') — l'await devant expect est obligatoire
Différence entre vi.advanceTimersByTime et vi.advanceTimersByTimeAsync ?|advanceTimersByTime est synchrone et ne flush pas les microtasks ; advanceTimersByTimeAsync est async et flush les await internes
Pourquoi lancer la promesse sans await avant d'avancer le temps ?|Si on await d'abord, la promesse bloque sur un setTimeout non encore avancé — deadlock de test
À quoi sert vi.waitFor et quels sont ses défauts de timeout et interval ?|Réessaie un callback toutes les interval ms (défaut 50) jusqu'à succès ou timeout (défaut 1000 ms) — conçu pour vrai temps, pas fake timers
Pourquoi ne pas utiliser vi.waitFor avec des fake timers actifs ?|Le polling interne de vi.waitFor utilise des setTimeout réels — avec les fake timers, les intervalles ne progressent pas automatiquement
Quand utiliser resolves et quand utiliser rejects ?|resolves si le code attrape l'erreur et retourne un objet échec ; rejects si le code propage l'erreur (throw/reject)
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-05-tests-asynchrones/`. Tu y écris, en **Vitest réel**, les tests de `InvitationMailer` avec fake timers (retry), des assertions `.resolves`/`.rejects`, et un `vi.waitFor` sur une queue d'invitations. Corrigé complet commenté + variante J+30 dans le README du lab.
