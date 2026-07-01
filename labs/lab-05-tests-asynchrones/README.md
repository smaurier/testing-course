# Lab 05 — Tests asynchrones

> **Outcome :** à la fin, tu sais tester du code asynchrone (promesses, retry avec fake timers, `vi.waitFor`) avec **Vitest réel**.
> **Vrai outil :** Vitest (`async/await`, `.resolves`, `.rejects`, `vi.useFakeTimers`, `vi.advanceTimersByTimeAsync`, `vi.waitFor`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

On continue sur la logique d'invitation TribuZen. Code de départ (ne le modifie pas — tu écris les tests) :

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

```typescript
// src/invitation/invitation-queue.ts
export class InvitationQueue {
  private pending: string[] = [];
  private sent: string[] = [];
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: { processingDelayMs: number } = { processingDelayMs: 50 }) {}

  enqueue(email: string) { this.pending.push(email); }

  get pendingCount() { return this.pending.length; }
  get sentCount() { return this.sent.length; }
  get isEmpty() { return this.pending.length === 0; }

  start() { this.running = true; this.processNext(); }

  stop() {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  private processNext() {
    if (!this.running || this.pending.length === 0) return;
    this.timer = setTimeout(() => {
      const email = this.pending.shift();
      if (email) this.sent.push(email);
      this.processNext();
    }, this.opts.processingDelayMs);
  }
}
```

Ta mission : écrire `invitation-mailer.test.ts` et `invitation-queue.test.ts` avec les techniques du module 05.

## Étapes (en friction)

1. **Cas nominal avec `.resolves`.** Crée un stub `SmtpClient` (`vi.fn().mockResolvedValue(undefined)`). Assert que `mailer.send('alice@tribu.fr', 'Martin')` **résout** avec `{ sent: true, attempts: 1 }` via `await expect(...).resolves.toEqual(...)`. Vérifie aussi que `sendMail` a été appelé avec les bons arguments (`toHaveBeenCalledOnce`, `toHaveBeenCalledWith`).

2. **Cas retour d'échec avec `.resolves`.** Configure le stub pour qu'il rejette toujours (`mockRejectedValue`). Le mailer **attrape** l'erreur et retourne un objet — ce n'est pas un rejet de promesse, c'est un résultat d'échec. Utilise `.resolves` (pas `.rejects`). Avance le temps pour chaque délai inter-retry.

3. **Retry avec fake timers.** `vi.useFakeTimers()` en `beforeEach`, `vi.useRealTimers()` en `afterEach`. Configure le stub : échec 1er appel (`mockRejectedValueOnce`), succès 2e (`mockResolvedValueOnce`). Lance `send(...)` **sans `await`** (sinon deadlock). Avance le temps de `retryDelayMs` avec `await vi.advanceTimersByTimeAsync(2000)`. Assert que la promesse résout `{ sent: true, attempts: 2 }` et que `sendMail` a été appelé deux fois.

4. **Frontière temporelle.** Même setup retry. Avance de `retryDelayMs - 1 ms` → vérifie que `sendMail` n'a toujours été appelé qu'une fois. Avance d'1 ms supplémentaire → le retry s'enclenche. Illustre que les fake timers sont précis à la milliseconde.

5. **`vi.waitFor` sur la queue.** Instancie `InvitationQueue` avec `processingDelayMs: 20`. Enqueue 2 emails, `start()`. Utilise `vi.waitFor(() => { if (queue.pendingCount !== 0) throw new Error('pending'); }, { timeout: 300, interval: 30 })`. Assert `sentCount === 2`. Appelle `stop()`. Écris aussi le cas timeout (queue trop lente, `timeout: 100`).

6. **Discipline.** `vi.clearAllMocks()` en `afterEach`. Vérifie qu'aucun test ne fuite vers le suivant (pas de fake timers actifs hors scope).

## Corrigé complet commenté

```typescript
// src/invitation/invitation-mailer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationMailer, type SmtpClient } from './invitation-mailer';

describe('InvitationMailer.send', () => {
  let smtp: SmtpClient;
  let mailer: InvitationMailer;

  beforeEach(() => {
    vi.useFakeTimers();                                         // remplace setTimeout global
    smtp = { sendMail: vi.fn().mockResolvedValue(undefined) }; // stub SmtpClient
    mailer = new InvitationMailer(smtp, 3, 2000);              // 3 retries, 2 s de délai
  });

  afterEach(() => {
    vi.useRealTimers();  // restauration obligatoire — sinon les fake timers fuient
    vi.clearAllMocks();  // efface l'historique d'appels, garde les implémentations
  });

  it('résout au premier essai', async () => {
    // resolves déplie la promesse et applique le matcher sur la valeur résolue
    // L'await devant expect est OBLIGATOIRE — sans lui, faux positif garanti
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

  it('retourne une structure d échec après 3 tentatives épuisées', async () => {
    // Le mailer CATCH l'erreur et retourne un objet → c'est un resolves, pas un rejects
    vi.mocked(smtp.sendMail).mockRejectedValue(new Error('SMTP_DOWN'));

    // Lance sans await : la promesse est suspendue sur le 1er setTimeout(2000)
    const promise = mailer.send('alice@tribu.fr', 'Martin');

    // advanceTimersByTimeAsync avance l'horloge ET flush les microtasks (await internes)
    // La version sync (advanceTimersByTime) ne flush pas → le retry ne s'enclenche jamais
    await vi.advanceTimersByTimeAsync(2000); // déclenche retry 2
    await vi.advanceTimersByTimeAsync(2000); // déclenche retry 3

    await expect(promise).resolves.toEqual({
      sent: false,
      attempts: 3,
      error: 'SMTP_DOWN',
    });
    expect(smtp.sendMail).toHaveBeenCalledTimes(3);
  });

  it('réessaie et réussit au 2e essai', async () => {
    vi.mocked(smtp.sendMail)
      .mockRejectedValueOnce(new Error('SMTP_TIMEOUT'))
      .mockResolvedValueOnce(undefined);

    // Étape clé : lancer SANS await
    // Si on awaitait ici, la promesse bloquerait sur setTimeout(2000) non encore avancé → deadlock
    const promise = mailer.send('alice@tribu.fr', 'Martin');

    await vi.advanceTimersByTimeAsync(2000); // flush le délai + les microtasks du retry

    await expect(promise).resolves.toEqual({ sent: true, attempts: 2 });
    expect(smtp.sendMail).toHaveBeenCalledTimes(2);
  });

  it('frontière exacte : aucun retry avant 2000 ms', async () => {
    vi.mocked(smtp.sendMail)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    const promise = mailer.send('alice@tribu.fr', 'Martin');

    await vi.advanceTimersByTimeAsync(1999); // 1 ms avant l'échéance
    expect(smtp.sendMail).toHaveBeenCalledTimes(1); // toujours le 1er essai

    await vi.advanceTimersByTimeAsync(1);    // +1 ms → setTimeout(2000) se déclenche
    expect(smtp.sendMail).toHaveBeenCalledTimes(2); // retry déclenché

    await promise; // attendre la résolution finale
  });
});
```

```typescript
// src/invitation/invitation-queue.test.ts
import { describe, it, expect, vi } from 'vitest';
import { InvitationQueue } from './invitation-queue';

describe('InvitationQueue', () => {
  it('traite toutes les invitations et les marque envoyées', async () => {
    // Pas de fake timers ici : la queue tourne en vrai temps (20 ms par item)
    // vi.waitFor retente le callback jusqu'à succès (pas de throw) ou timeout
    const queue = new InvitationQueue({ processingDelayMs: 20 });
    queue.enqueue('alice@tribu.fr');
    queue.enqueue('bob@tribu.fr');
    queue.start();

    await vi.waitFor(
      () => {
        // Lever une erreur = « la condition n'est pas encore vraie, réessaie »
        // Ne pas lever = « succès, vi.waitFor résout »
        if (queue.pendingCount !== 0) throw new Error(`still ${queue.pendingCount} pending`);
      },
      { timeout: 500, interval: 30 }, // défauts : 1000 ms / 50 ms
    );

    expect(queue.sentCount).toBe(2);
    queue.stop();
  });

  it('échoue avec une erreur de timeout si le traitement est trop lent', async () => {
    const queue = new InvitationQueue({ processingDelayMs: 9999 }); // délai irréaliste
    queue.enqueue('alice@tribu.fr');
    queue.start();

    // vi.waitFor lève une erreur de timeout après 100 ms → rejects.toThrow()
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

Points de validation par le coach : (a) chaque `expect(...).resolves/.rejects` est précédé d'un `await` ; (b) les promesses avec retry sont lancées sans `await` avant d'avancer le temps ; (c) `vi.advanceTimersByTimeAsync` est utilisé (pas la version sync) ; (d) `vi.useRealTimers()` en `afterEach` sur tous les tests avec fake timers ; (e) `vi.waitFor` est utilisé sur la queue à vrai temps, pas sur les timers contrôlés ; (f) le cas `SMTP_DOWN` utilise `.resolves` (pas `.rejects`) — le mailer attrape l'erreur.

## Variante J+30 (fading)

Reprends sans relire le corrigé, **en 25 min**, et ajoute une contrainte : `InvitationMailer` doit désormais émettre un événement `'retry'` (via un `EventEmitter` injecté) à chaque tentative échouée avant le dernier essai. Écris le test qui vérifie, avec un **spy** sur l'émetteur, que l'événement est émis **exactement deux fois** lors d'un scénario 3 essais tous en échec. Bonus : vérifie l'ordre des appels (`toHaveBeenNthCalledWith`). Discrimine à voix haute : fake timers ou `vi.waitFor` pour ce test, et pourquoi ?

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `src/invitation/invitation-mailer.ts` avec l'interface `SmtpClient` et la classe `InvitationMailer` (retry, délai).
2. Écris `invitation-mailer.test.ts` en Vitest réel (`npm test` = `vitest run`) : stub SmtpClient + fake timers + `advanceTimersByTimeAsync` pour les retries.
3. Garde `SmtpClient` comme **adapter que tu possèdes** — tu mockes l'interface TypeScript, jamais le SDK nodemailer/sendgrid directement (piège « don't mock what you don't own »).
4. Commit `smaurier/tribuzen` : `test(mailer): fake timers + retry async sur InvitationMailer`.
