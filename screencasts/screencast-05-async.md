# Screencast 05 — Tests asynchrones

## Informations
- **Duree estimee** : 15-18 min
- **Module** : `modules/05-tests-asynchrones.md`
- **Lab associe** : Lab 05
- **Prérequis** : Screencast 04

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal intégré ouvert
- [ ] Projet de demo avec Vitest installe
- [ ] Fichier `modules/05-tests-asynchrones.md` ouvert

## Script

### [00:00-02:00] Introduction — Le defi de l'asynchrone dans les tests

> L'asynchrone est partout : appels API, acces DB, timers, events. Tester du code asynchrone requiert des patterns spécifiques, sinon les tests passent... sans rien vérifier.

**Action** : Montrer le piege classique.

```typescript
// PIEGE : ce test passe toujours, meme si fetchUser echoue
it('should fetch user', () => {
  fetchUser(1).then(user => {
    expect(user.name).toBe('Alice');
  });
  // Le test se termine AVANT que la promesse ne resolve !
});

// CORRECT : ajouter async/await
it('should fetch user', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Alice');
});
```

> Sans `await`, le test se termine immediatement. La promesse resolve après, mais personne ne vérifié l'assertion. C'est le piege numéro un des tests asynchrones.

### [02:00-05:00] async/await — La base

> La méthode la plus propre pour tester du code asynchrone est async/await.

**Action** : Créer `src/async-demo.test.ts`.

```typescript
import { describe, it, expect } from 'vitest';

async function fetchUser(id: number): Promise<{ id: number; name: string }> {
  if (id <= 0) throw new Error('Invalid ID');
  return { id, name: 'Alice' };
}

describe('async/await', () => {
  it('should resolve with user data', async () => {
    const user = await fetchUser(1);
    expect(user).toEqual({ id: 1, name: 'Alice' });
  });

  it('should reject with invalid ID', async () => {
    await expect(fetchUser(-1)).rejects.toThrow('Invalid ID');
  });
});
```

> `rejects.toThrow()` est l'équivalent de `expect(() => ...).toThrow()` pour les promesses. N'oubliez pas le `await` devant `expect` — sinon l'assertion ne sera pas verifiee.

### [05:00-08:00] resolves / rejects — Assertions sur promesses

> Vitest offre des helpers `.resolves` et `.rejects` pour des assertions plus expressives.

**Action** : Demontrer les deux patterns.

```typescript
describe('resolves / rejects', () => {
  it('should resolve to matching object', async () => {
    await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alice' });
  });

  it('should reject with Error instance', async () => {
    await expect(fetchUser(-1)).rejects.toBeInstanceOf(Error);
    await expect(fetchUser(-1)).rejects.toThrow('Invalid ID');
  });

  // Utile pour verifier le type exact d'erreur
  it('should reject with specific error properties', async () => {
    try {
      await fetchUser(-1);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Invalid ID');
    }
  });
});
```

### [08:00-11:00] Fake timers et async — setTimeout, debounce, polling

> Combiner fake timers et code asynchrone demandé de l'attention.

**Action** : Créer un exemple de polling.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function pollUntilReady(
  checkFn: () => Promise<boolean>,
  intervalMs: number,
  maxAttempts: number
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkFn()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

describe('pollUntilReady', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('should return true when check succeeds', async () => {
    let attempt = 0;
    const checkFn = vi.fn(async () => {
      attempt++;
      return attempt >= 3; // succes au 3e essai
    });

    const promise = pollUntilReady(checkFn, 1000, 5);

    // Avancer le temps pour chaque intervalle
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBe(true);
    expect(checkFn).toHaveBeenCalledTimes(3);
  });

  it('should return false after max attempts', async () => {
    const checkFn = vi.fn(async () => false);

    const promise = pollUntilReady(checkFn, 100, 3);

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe(false);
    expect(checkFn).toHaveBeenCalledTimes(3);
  });
});
```

> La clé : `vi.advanceTimersByTimeAsync` au lieu de `vi.advanceTimersByTime` quand le code combine promesses et timers. La version async attend que les microtasks soient resolues.

### [11:00-13:30] Event emitters — Tester les callbacks

> Les event emitters sont courants en Node.js. Voici comment les tester proprement.

**Action** : Créer un exemple avec EventEmitter.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';

class JobProcessor extends EventEmitter {
  async process(data: string): Promise<void> {
    this.emit('start', data);
    await new Promise(r => setTimeout(r, 10));
    this.emit('complete', { data, result: data.toUpperCase() });
  }
}

describe('JobProcessor', () => {
  it('should emit start and complete events', async () => {
    const processor = new JobProcessor();
    const onStart = vi.fn();
    const onComplete = vi.fn();

    processor.on('start', onStart);
    processor.on('complete', onComplete);

    await processor.process('hello');

    expect(onStart).toHaveBeenCalledWith('hello');
    expect(onComplete).toHaveBeenCalledWith({
      data: 'hello',
      result: 'HELLO',
    });
  });
});
```

### [13:30-15:30] Pieges courants — Les erreurs a éviter

**Action** : Afficher les pieges.

```
PIEGE 1 : Oublier await devant expect().resolves / .rejects
→ Le test passe sans verifier l'assertion

PIEGE 2 : Oublier async dans la signature du test
→ Les await deviennent silencieusement ignores

PIEGE 3 : Melanger fake timers et promesses sans advanceTimersByTimeAsync
→ Les promesses ne resolvent jamais, le test timeout

PIEGE 4 : Ne pas nettoyer les timers (oubli de afterEach)
→ Les fake timers fuient vers les tests suivants

PIEGE 5 : Ne pas tester le chemin d'erreur
→ 90% des bugs sont dans le error handling
```

### [15:30-17:00] Récapitulatif

**Action** : Afficher le récapitulatif.

```
CE QU'IL FAUT RETENIR :
1. Toujours async/await dans les tests asynchrones
2. resolves/rejects pour des assertions expressives
3. advanceTimersByTimeAsync quand on combine timers + promesses
4. Toujours tester le chemin d'erreur (rejects.toThrow)
5. Nettoyer les fake timers dans afterEach

PROCHAINE ETAPE :
→ Screencast 06 : Architecture testable
```

## Points d'attention pour l'enregistrement
- Le piege du test qui passe sans await est crucial — le demontrer en live
- Montrer qu'un test sans await passe alors qu'il ne devrait pas
- Le polling avec fake timers est un cas réel frequent
- Insister sur advanceTimersByTimeAsync vs advanceTimersByTime
