# Lab 14 — Tests flaky et debugging

> **Outcome :** à la fin, tu sais identifier la cause d'un test flaky TribuZen, le rendre déterministe avec `vi.setSystemTime` et le reset d'état, puis mettre un test instable en quarantaine — en **Vitest réel**.
> **Vrai outil :** Vitest (`vi.useFakeTimers`, `vi.setSystemTime`, `vi.useRealTimers`, `--sequence.shuffle`). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

On travaille sur le flux d'acceptation d'invitation TribuZen. Le code de départ est fourni ci-dessous — **ne le modifie pas**. Tu dois écrire les tests et corriger une suite instable déjà écrite.

```ts
// src/invitation/invitation-service.ts
export interface InvitationRecord {
  token: string;
  familyId: string;
  email: string;
  expiresAt: Date;
}
export interface InvitationRepo {
  findPending(token: string): Promise<InvitationRecord | null>;
  markAccepted(token: string): Promise<void>;
}

export class InvitationService {
  constructor(private repo: InvitationRepo) {}

  async accept(token: string): Promise<boolean> {
    const inv = await this.repo.findPending(token);
    if (!inv) return false;
    if (inv.expiresAt <= new Date()) return false; // expirée
    await this.repo.markAccepted(token);
    return true;
  }
}
```

```ts
// src/invitation/acceptance.flaky.test.ts — SUITE INSTABLE (à analyser, PAS à supprimer)
import { describe, it, expect } from 'vitest';
import { InvitationService } from './invitation-service';

// PROBLÈME 1 : repo déclaré hors beforeEach
const repo = {
  findPending: async (_token: string) => ({
    token: 'tok-abc',
    familyId: 'fam-1',
    email: 'bob@tribu.fr',
    expiresAt: new Date(Date.now() + 3600_000),
  }),
  markAccepted: async (_token: string) => {},
};

describe('InvitationService.accept (flaky)', () => {
  // PROBLÈME 2 : service partagé entre tests
  const service = new InvitationService(repo);

  it('retourne true pour un token valide', () => {    // PROBLÈME 3 : pas async
    const result = service.accept('tok-abc');          // promesse non attendue
    expect(result).toBe(true);                         // assert sur Promise, pas boolean
  });

  it('retourne false si expiré', async () => {
    const expiredRepo = {
      ...repo,
      findPending: async () => ({
        token: 'tok-old',
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        expiresAt: new Date(Date.now() - 1), // PROBLÈME 4 : delta d'1 ms
      }),
    };
    const s2 = new InvitationService(expiredRepo);
    const ok = await s2.accept('tok-old');
    expect(ok).toBe(false);
  });
});
```

Ta mission : écrire `acceptance.test.ts` (la version corrigée, stable) qui couvre les mêmes cas, **sans aucun des 4 problèmes**.

## Étapes (en friction)

1. **Identifier les 4 problèmes.** Lis `acceptance.flaky.test.ts` et nomme chaque cause de flakiness à voix haute avant d'écrire une ligne de test corrigé. (Coach : écoute le diagnostic avant de montrer quoi que ce soit.)

2. **Figer l'horloge.** Dans `beforeEach`, appelle `vi.useFakeTimers()` et `vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'))`. Dans `afterEach`, appelle `vi.useRealTimers()`. Pourquoi `afterEach` est obligatoire ? Dis-le avant d'écrire.

3. **Isoler l'état.** Construis un `repo` stub (`vi.fn()`) et un `service` **dans `beforeEach`**. Le stub nominal : `findPending` résout vers une invitation qui expire à `2026-07-01T13:00:00.000Z` (1 h après l'horloge figée).

4. **Test nominal.** Écris le test `'retourne true et marque accepté'` avec `async/await`. Asserte que `ok === true` ET que `repo.markAccepted` a été appelé exactement une fois avec le bon token (`toHaveBeenCalledOnce`, `toHaveBeenCalledWith`).

5. **Test expiré.** Dans le corps du test uniquement, reconfigure `findPending` pour retourner une invitation expirée à `2026-07-01T11:00:00.000Z` (1 h dans le passé). Asserte `ok === false` et que `markAccepted` n'a PAS été appelé (`not.toHaveBeenCalled`).

6. **Test token introuvable.** Reconfigure `findPending` pour résoudre `null`. Asserte `ok === false`, pas d'appel à `markAccepted`.

7. **Vérifier le shuffle.** Lance `vitest run --sequence.shuffle` 3 fois. Si des tests passent, tu as réussi. Si un test échoue : trouve l'état partagé restant et corrige.

## Corrigé complet commenté

```ts
// src/invitation/acceptance.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationService, type InvitationRepo } from './invitation-service';

describe('InvitationService.accept', () => {
  let repo: InvitationRepo;
  let service: InvitationService;

  beforeEach(() => {
    // FIX 1 — figer l'horloge : new Date() renvoie toujours 2026-07-01T12:00:00Z
    // quelle que soit la timezone du serveur CI ou l'heure d'exécution
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));

    // FIX 2 — recréer repo et service à chaque test : zéro état partagé
    repo = {
      // Stub nominal : invitation valide, expire dans 1 h (marge largement suffisante)
      findPending: vi.fn().mockResolvedValue({
        token: 'tok-abc',
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        expiresAt: new Date('2026-07-01T13:00:00.000Z'),
      }),
      markAccepted: vi.fn().mockResolvedValue(undefined),
    };
    service = new InvitationService(repo);
  });

  afterEach(() => {
    // FIX 3 — restaurer l'horloge réelle : OBLIGATOIRE, les fake timers sont
    // globaux au processus Vitest. Sans ça, tout setTimeout dans les autres
    // fichiers ne se déclenche plus → échecs mystérieux hors de ce fichier.
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // FIX 4 — async/await : on attend la résolution de la promesse avant d'asserter
  it('retourne true et marque accepté pour un token valide', async () => {
    const ok = await service.accept('tok-abc'); // ← await obligatoire

    // state verification : la méthode retourne bien true
    expect(ok).toBe(true);
    // behavior verification : l'acceptation est persistée avec le bon token
    expect(repo.markAccepted).toHaveBeenCalledOnce();
    expect(repo.markAccepted).toHaveBeenCalledWith('tok-abc');
  });

  it('retourne false sans marquer si invitation expirée', async () => {
    // Reconfiguration ciblée dans le corps du test uniquement.
    // On utilise une date 1 h dans le passé — delta FIXE, pas un ms volatile.
    vi.mocked(repo.findPending).mockResolvedValue({
      token: 'tok-old',
      familyId: 'fam-1',
      email: 'bob@tribu.fr',
      expiresAt: new Date('2026-07-01T11:00:00.000Z'), // ← 1 h avant l'horloge figée
    });

    const ok = await service.accept('tok-old');

    expect(ok).toBe(false);
    // preuve d'absence d'effet de bord : rien n'est marqué accepté
    expect(repo.markAccepted).not.toHaveBeenCalled();
  });

  it('retourne false pour un token introuvable', async () => {
    vi.mocked(repo.findPending).mockResolvedValue(null);

    const ok = await service.accept('tok-inexistant');

    expect(ok).toBe(false);
    expect(repo.markAccepted).not.toHaveBeenCalled();
  });
});
```

**Points de validation par le coach :**

- (a) L'apprenant nomme les 4 problèmes avant d'ouvrir le corrigé.
- (b) `vi.setSystemTime` utilise un timestamp UTC absolu — pas `Date.now() + N`.
- (c) `repo` et `service` sont recréés dans `beforeEach` — aucune variable partagée à portée du `describe`.
- (d) Tous les tests sont `async` et `await service.accept(...)`.
- (e) `vi.useRealTimers()` est en `afterEach`, pas en `afterAll`.
- (f) `vitest run --sequence.shuffle` passe 3 fois de suite.

## Variante J+30 (fading)

Reprends **sans relire le corrigé**, en 20 min, avec cette contrainte supplémentaire :

`InvitationService.accept()` doit désormais **refuser une invitation si elle a déjà été acceptée** (`status: 'accepted'` dans `InvitationRecord`). Écris les tests qui couvrent les 4 cas : valide, expiré, introuvable, déjà accepté.

Contrainte d'horloge conservée. Le service partagé et les fake timers sont les pièges — peux-tu les éviter de mémoire ? Bonus : passe `--sequence.shuffle` dès le premier run.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `src/invitation/invitation-service.ts` avec `InvitationRecord`, `InvitationRepo`, et `InvitationService.accept()` basé sur les types existants (`Invitation`, `Family`).
2. Écris `acceptance.test.ts` en Vitest réel (stub repo avec `vi.fn()`, fake timers, `beforeEach`/`afterEach`).
3. Ajoute `--sequence.shuffle` au script `test:ci` dans `package.json` pour détecter les dépendances d'ordre en CI.
4. Commit : `test(invitation): stabiliser acceptance.test — fake timers + isolation beforeEach`.
