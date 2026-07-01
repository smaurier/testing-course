---
titre: Tests flaky et debugging
cours: 06-testing
notions: [causes de flakiness, asynchronisme mal attendu, dépendances d'ordre et état partagé, temps et timezone non maîtrisés, isolation défaillante, quarantaine et retries, reproduire un flaky, rendre un test déterministe]
outcomes: [diagnostiquer la cause d'un test flaky, rendre un test déterministe, isoler et mettre en quarantaine un test instable, déboguer efficacement un échec]
prerequis: [13-tests-en-ci-cd]
next: 15-tdd-et-bdd
libs: [{ name: vitest, version: ^4.1.9 }]
tribuzen: stabiliser un test flaky du flux d'invitation TribuZen (async et temps mal maîtrisés)
last-reviewed: 2026-07
---

# Tests flaky et debugging

> **Outcomes — tu sauras FAIRE :** diagnostiquer la cause racine d'un test flaky, rendre un test déterministe (fake timers, reset d'état, await correct), mettre un test en quarantaine sans le supprimer, déboguer un échec avec Vitest UI et `--sequence.shuffle`.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, le test d'acceptation d'invitation passe 9 fois sur 10 en CI. La 10e fois, il s'affiche rouge. Pas de changement de code. Les collègues relancent : vert. Personne ne comprend. L'équipe apprend à ignorer ce rouge — et c'est là que le danger commence.

Voici la suite suspecte (avant correction) :

```ts
// src/invitation/acceptance.test.ts (VERSION FLAKY)
import { describe, it, expect } from 'vitest';
import { InvitationService } from './invitation-service';

const repo = {
  findPending: async (token: string) => ({
    token,
    familyId: 'fam-1',
    email: 'bob@tribu.fr',
    expiresAt: new Date(Date.now() + 3600_000), // expire dans 1 h
  }),
  markAccepted: async (_token: string) => {},
};

describe('InvitationService.accept', () => {
  const service = new InvitationService(repo); // ← PARTAGÉ entre tous les tests

  it('retourne true pour un token valide', async () => {
    const ok = await service.accept('tok-abc');
    expect(ok).toBe(true);
  });

  it('rejette un token expiré', async () => {
    const expiredRepo = {
      ...repo,
      findPending: async () => ({
        token: 'tok-old',
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        expiresAt: new Date(Date.now() - 1), // ← « juste expiré »
      }),
    };
    const s2 = new InvitationService(expiredRepo);
    const ok = await s2.accept('tok-old');
    expect(ok).toBe(false);
  });
});
```

**Trois bombes dans ce fichier :**

1. `Date.now() - 1` : si le CPU est lent (CI sous charge), le `- 1 ms` peut ne pas suffire — l'invitation semble encore valide au moment de l'assert. Résultat : `true` au lieu de `false`.
2. `service` est instancié **une seule fois** hors de `beforeEach` : si le service conserve de l'état interne (cache, compteur), il fuit entre tests.
3. Aucun seed, aucun shuffle : les tests passent toujours dans le même ordre localement, mais CI peut les mélanger (`--sequence.shuffle`).

L'objectif du module : comprendre **pourquoi** ça échoue et **comment** rendre ça déterministe.

## 2. Théorie complète, concise

### Qu'est-ce qu'un test flaky ?

Un test **flaky** produit des résultats différents — rouge ou vert — **sans changement de code**. Il est pire qu'un test absent : il donne l'illusion d'une couverture tout en dégradant la confiance dans la CI. Une équipe qui apprend à ignorer les rouges est une équipe qui rate de vrais bugs.

### Cause 1 — Asynchronisme mal attendu

Le chemin le plus fréquent : on attend une promesse trop tôt, ou pas du tout.

```ts
// FLAKY : accept() est async mais le test ne l'attend pas
it('devrait notifier', () => {          // ← pas de async/await
  service.accept('tok-abc');            // ← la promesse est lancée mais pas attendue
  expect(notifier.calls).toBe(1);       // ← l'assertion précède la résolution
});

// CORRECT
it('devrait notifier', async () => {
  await service.accept('tok-abc');
  expect(notifier.calls).toBe(1);
});
```

Variante : une assertion Vitest async non chaînée.

```ts
// FLAKY : resolves n'est pas awaité
it('résout', () => {
  expect(service.accept('tok')).resolves.toBe(true); // ← Vitest ne attend pas cet assert
});

// CORRECT
it('résout', async () => {
  await expect(service.accept('tok')).resolves.toBe(true);
});
```

### Cause 2 — Dépendances d'ordre et état partagé

Quand deux tests partagent le même objet mutable, l'ordre d'exécution détermine le résultat. `--sequence.shuffle` — option Vitest qui randomise l'ordre — révèle ces couplages.

```ts
// FLAKY : compteur partagé entre tests
const counter = new CallCounter();   // ← hors beforeEach

it('A : compte 1 appel', () => {
  counter.record('a');
  expect(counter.total).toBe(1);     // ← passe si A est premier
});

it('B : compte 1 appel', () => {
  counter.record('b');
  expect(counter.total).toBe(1);     // ← échoue si A s'est exécuté avant (total=2)
});
```

Règle : **tout état mutable recréé dans `beforeEach`**. Ne jamais déclarer une instance de service à portée du `describe` sans la recréer avant chaque test.

### Cause 3 — Temps et timezone non maîtrisés

Deux symptômes classiques :

- **Expiré / pas expiré selon la milliseconde** : `Date.now() - 1` = écart d'1 ms, insuffisant si le thread est préempté entre la création et l'assertion.
- **Heure du jour** : un test de salutation `getGreeting()` qui attend `'Bonjour'` échoue après 18 h.
- **Timezone CI ≠ locale** : formater une date sans timezone explicite produit des résultats différents selon l'environnement.

Solution universelle : `vi.useFakeTimers()` + `vi.setSystemTime()`. L'horloge est figée, le test est instantané, le résultat est identique sur toute machine.

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z')); // UTC explicite
});
afterEach(() => {
  vi.useRealTimers(); // OBLIGATOIRE — les fake timers fuient entre fichiers sinon
});
```

### Cause 4 — Isolation défaillante : mocks non réinitialisés

Un `vi.spyOn` ou `vi.fn()` déclaré hors `beforeEach` conserve son historique entre tests. Le deuxième test voit les appels du premier.

```ts
const spy = vi.spyOn(mailer, 'send'); // ← hors beforeEach : fuite garantie

it('envoie 1 mail', () => { /* ... */ expect(spy).toHaveBeenCalledTimes(1); });
it('envoie 1 mail aussi', () => { /* ... */ expect(spy).toHaveBeenCalledTimes(1); }); // ← échoue : 2
```

Remède : `afterEach(() => vi.restoreAllMocks())` pour les spies, `vi.clearAllMocks()` pour les `vi.fn()` recréés dans `beforeEach`.

### Reproduire un test flaky

Trois techniques pour forcer l'échec en local avant de corriger :

**Répéter N fois.** Vitest n'a pas d'option `--repeat` native, mais `test.each` ou un script shell font l'affaire.

```ts
// Via test.each : 20 runs identiques
it.each(Array.from({ length: 20 }, (_, i) => [i]))('run %i', async () => {
  await expect(service.accept('tok-abc')).resolves.toBe(true);
});
```

**Shuffler l'ordre.** Option CLI Vitest (v2+) :

```bash
vitest run --sequence.shuffle
```

Révèle les dépendances d'ordre sans écrire de code.

**Seed déterministe.** Combine shuffle et reproductibilité : même seed = même ordre, utile pour rejouer un échec exact de CI.

```bash
vitest run --sequence.shuffle --sequence.seed=1234
```

### Quarantaine et retries — pansement, pas solution

**Retries** (`retry: 2` dans `vitest.config.ts`) masquent un flaky : le test passe au bout du 3e essai, CI est verte, le bug reste. Seul usage légitime : détecter des flakys (un test qui réussit en retry est signalé).

**Quarantaine** : isoler le test flaky dans un fichier `*.quarantine.test.ts` exclu du run normal, mais inclus dans un job CI dédié. On continue à le surveiller sans bloquer la suite.

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/*.quarantine.test.ts',   // exclu du run principal
    ],
  },
});
```

```bash
# Job CI dédié quarantaine
vitest run --include '**/*.quarantine.test.ts'
```

La quarantaine est un **état temporaire** : le test doit être corrigé dans les 48 h ou supprimé. Un cimetière de quarantaines = absence de couverture silencieuse.

### Rendre un test déterministe — récapitulatif des leviers

| Cause | Levier |
|---|---|
| Async non attendu | `async/await` sur toutes les assertions async |
| `resolves`/`rejects` non awaité | `await expect(...).resolves.toBe(...)` |
| `Date.now()`, `setTimeout` réels | `vi.useFakeTimers()` + `vi.setSystemTime()` |
| État partagé entre tests | Recréer dans `beforeEach` |
| Mocks non réinitialisés | `afterEach(() => vi.restoreAllMocks())` |
| Dépendance d'ordre | `--sequence.shuffle` pour détecter, `beforeEach` pour corriger |

## 3. Worked examples

### Exemple A — flaky reproduit et corrigé (temps + async)

**Contexte TribuZen :** `InvitationService.accept(token)` vérifie que l'invitation n'est pas expirée avant d'accepter. Version originale flaky, puis corrigée.

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
// src/invitation/acceptance.test.ts — VERSION CORRIGÉE
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationService, type InvitationRepo } from './invitation-service';

describe('InvitationService.accept', () => {
  let repo: InvitationRepo;
  let service: InvitationService;

  beforeEach(() => {
    // 1. Figer l'horloge : Date.now() est maintenant toujours 2026-07-01T12:00:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));

    // 2. Recréer le repo et le service à chaque test → zéro état partagé
    repo = {
      findPending: vi.fn().mockResolvedValue({
        token: 'tok-abc',
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        expiresAt: new Date('2026-07-01T13:00:00.000Z'), // expire dans 1 h FIXE
      }),
      markAccepted: vi.fn().mockResolvedValue(undefined),
    };
    service = new InvitationService(repo);
  });

  afterEach(() => {
    vi.useRealTimers();       // OBLIGATOIRE : restaurer l'horloge réelle
    vi.restoreAllMocks();
  });

  it('retourne true et marque accepté pour un token valide', async () => {
    // await obligatoire : accept() est async
    const ok = await service.accept('tok-abc');

    expect(ok).toBe(true);
    expect(repo.markAccepted).toHaveBeenCalledOnce();
    expect(repo.markAccepted).toHaveBeenCalledWith('tok-abc');
  });

  it('retourne false sans marquer si invitation expirée', async () => {
    // On reconfigure le stub pour ce cas précis : invitation déjà expirée de 1 h
    vi.mocked(repo.findPending).mockResolvedValue({
      token: 'tok-old',
      familyId: 'fam-1',
      email: 'bob@tribu.fr',
      expiresAt: new Date('2026-07-01T11:00:00.000Z'), // 1 h dans le passé, FIXE
    });

    const ok = await service.accept('tok-old');

    expect(ok).toBe(false);
    // preuve d'absence d'effet de bord
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

**Pas-à-pas des corrections :**

1. `vi.useFakeTimers()` + `vi.setSystemTime(...)` dans `beforeEach` : `new Date()` à l'intérieur de `accept()` renvoie toujours `2026-07-01T12:00:00Z`, quelle que soit l'heure réelle d'exécution ou la timezone du serveur CI.
2. `expiresAt: new Date('2026-07-01T13:00:00.000Z')` — délai exprimé en dates absolues UTC : la marge n'est plus « 1 ms » mais « 1 heure », garantie même si le CPU est sous charge.
3. `vi.mocked(repo.findPending).mockResolvedValue(...)` dans le corps du test (pas dans `beforeEach`) : reconfiguration ciblée sans contaminer les autres tests.
4. `async/await` partout : aucune promesse non attendue.
5. `afterEach(() => vi.useRealTimers())` : sans ça, les fake timers fuient sur les fichiers de test suivants (symptôme : `setTimeout` dans d'autres tests ne se déclenche jamais).

### Exemple B — état partagé + shuffle (diagnostiquer puis isoler)

**Scénario :** un `TokenStore` statique (singleton) garde les tokens acceptés. Tests qui passent dans l'ordre alphabétique, échouent en shuffle.

```ts
// src/invitation/token-store.ts
export const tokenStore = new Set<string>(); // MODULE-LEVEL singleton

// src/invitation/token-store.test.ts — FLAKY avec --sequence.shuffle
import { describe, it, expect } from 'vitest';
import { tokenStore } from './token-store';

describe('tokenStore', () => {
  it('stocke un token', () => {
    tokenStore.add('tok-1');
    expect(tokenStore.has('tok-1')).toBe(true);
  });

  it('est vide au départ', () => {
    // Échoue si le test précédent a ajouté 'tok-1' ET que l'ordre est inversé
    expect(tokenStore.size).toBe(0);
  });
});
```

```bash
# Reproduire l'échec localement
vitest run --sequence.shuffle --sequence.seed=42
```

**Correction — reset dans `beforeEach` :**

```ts
// src/invitation/token-store.test.ts — CORRIGÉ
import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStore } from './token-store';

describe('tokenStore', () => {
  beforeEach(() => {
    tokenStore.clear(); // RESET total avant chaque test → isolé
  });

  it('stocke un token', () => {
    tokenStore.add('tok-1');
    expect(tokenStore.has('tok-1')).toBe(true);
  });

  it('est vide au départ', () => {
    expect(tokenStore.size).toBe(0); // toujours 0, quel que soit l'ordre
  });
});
```

## 4. Pièges & misconceptions

- **Les retries comme solution permanente.** Configurer `retry: 3` dans `vitest.config.ts` masque le flaky : CI reste verte, le bug demeure. *Correct :* les retries servent à **détecter** les flakys (un test qui réussit au 2e essai est signalé comme instable), pas à les cacher. Si un test a besoin de retries pour passer, c'est un bug du test — le corriger dans les 48 h ou le mettre explicitement en quarantaine.

- **`sleep` arbitraire pour « laisser le temps ».** `await new Promise(r => setTimeout(r, 200))` dans un test = aveu d'un problème d'async non résolu. Ça passe sur une machine rapide, échoue sur CI lente. *Correct :* utiliser `waitFor` de `@testing-library` (pour les tests UI), awaiter la promesse directement, ou utiliser `vi.advanceTimersByTime` avec fake timers.

- **`Date.now() - 1` pour simuler une expiration.** Un delta d'une milliseconde est consommé avant que la CPU atteigne la ligne d'assertion sous charge. *Correct :* figer l'horloge avec `vi.setSystemTime` et exprimer les délais en heures/minutes absolues UTC.

- **Oublier `vi.useRealTimers()` en `afterEach`.** Les fake timers sont **globaux** au processus Vitest. Sans restauration, tout `setTimeout` dans les fichiers suivants ne se déclenche jamais — les tests qui n'ont rien à voir avec le temps commencent à échouer mystérieusement. *Correct :* `afterEach(() => vi.useRealTimers())` systématiquement quand on utilise `vi.useFakeTimers()`.

- **Quarantaine sans deadline.** Un fichier `.quarantine.test.ts` oublié = couverture silencieusement retirée. *Correct :* la quarantaine est un état temporaire. Ajouter un commentaire `// quarantaine depuis: YYYY-MM-DD — corriger avant: YYYY-MM-DD` et un job CI qui alerte si le fichier a plus de X jours.

- **Confondre flaky de test et flaky de code.** Un test qui détecte un race condition réelle dans le code de production (deux écritures concurrentes en base) n'est pas flaky — il révèle un bug. *Correct :* avant de corriger le test, vérifier si la flakiness n'est pas le symptôme d'un vrai problème de concurrence dans le code.

## 5. Ancrage TribuZen

Couche fil-rouge : **stabiliser un test flaky du flux d'invitation TribuZen**.

Dans `smaurier/tribuzen`, `InvitationService.accept()` calcule l'expiration en temps réel. Les tests non stabilisés échoueraient en CI selon l'heure d'exécution du pipeline (timezone UTC vs locale, charge serveur). Les techniques du module s'appliquent directement :

- `vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'))` dans `beforeEach` : le test passe identiquement à 3 h du matin UTC et à 23 h CET.
- Le `repo` stub est recréé dans `beforeEach` : si `accept()` met à jour un champ interne (ex. compteur de tentatives), aucune fuite entre tests.
- `--sequence.shuffle` est intégré au job CI (`vitest run --sequence.shuffle`) : toute dépendance d'ordre est détectée immédiatement.
- La quarantaine (`.quarantine.test.ts`) est un outil de dernier recours pour un test qu'on ne peut pas corriger dans le sprint ; il est tracké dans la PR de mise en quarantaine avec une date limite de correction.

## 6. Points clés

1. Un test flaky est pire qu'un test absent : il donne une fausse confiance et dégrade la discipline d'équipe.
2. Quatre causes racines : async non attendu, état partagé entre tests, temps/timezone réels, mocks non réinitialisés.
3. `vi.useFakeTimers()` + `vi.setSystemTime(dateUTC)` rend tout test basé sur le temps déterministe ; toujours restaurer avec `vi.useRealTimers()` en `afterEach`.
4. Tout état mutable (service, store, mock) doit être recréé dans `beforeEach`, jamais partagé à portée du `describe`.
5. `--sequence.shuffle` révèle les dépendances d'ordre sans modifier le code de test.
6. `--sequence.seed=N` reproduit un ordre exact de CI en local pour déboguer.
7. Les retries masquent les flakys ; la quarantaine les isole temporairement ; la correction les élimine.
8. Vitest UI (`vitest --ui`) et le Node inspector (`--inspect-brk`) sont les deux outils de debugging prioritaires pour un échec impossible à reproduire mentalement.

## 7. Seeds Anki

```
Définition d'un test flaky ?|Test qui produit des résultats différents (rouge/vert) sans changement de code
Quelles sont les 4 causes principales de flakiness ?|Async non attendu, état partagé entre tests, temps/timezone réels, mocks non réinitialisés
Comment figer l'horloge dans Vitest ?|vi.useFakeTimers() + vi.setSystemTime(new Date('...UTC...')) dans beforeEach, vi.useRealTimers() dans afterEach
Pourquoi oublier vi.useRealTimers() est dangereux ?|Les fake timers sont globaux au processus — tout setTimeout dans les fichiers suivants ne se déclenche plus
Comment détecter une dépendance d'ordre entre tests ?|vitest run --sequence.shuffle (randomise l'ordre) ; --sequence.seed=N reproduit un ordre exact
Différence quarantaine vs retries ?|Retries masquent le flaky (test passe, bug reste) ; quarantaine l'isole explicitement en attendant correction
Quelle règle pour l'état mutable dans un describe ?|Toujours recréer dans beforeEach, jamais déclarer une instance partagée à portée du describe
Pourquoi Date.now() - 1 crée un flaky ?|Un delta d'1 ms est consommé avant l'assertion sous charge CPU ; utiliser vi.setSystemTime avec un écart en heures
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-14-flaky-tests/`. Tu y stabilises un test flaky TribuZen réel (async non attendu + temps non maîtrisé) avec Vitest réel, fake timers et reset d'état. Corrigé complet commenté + variante J+30 dans le README du lab.
