# Screencast 04 — Mocking et test doubles

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/04-mocking-et-test-doubles.md`
- **Lab associe** : Lab 04
- **Prérequis** : Screencast 03

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal intégré ouvert
- [ ] Projet de demo avec Vitest installe
- [ ] Fichier `modules/04-mocking-et-test-doubles.md` ouvert

## Script

### [00:00-02:30] Introduction — La taxonomie des test doubles

> Quand on dit "mock", on utilise souvent le terme de manière générique. Mais il existe 5 types de doublures de test, chacune avec un role précis.

**Action** : Afficher la taxonomie.

```
TYPE    | ROLE                              | EXEMPLE
--------|-----------------------------------|---------------------------------
Dummy   | Remplit un parametre obligatoire   | Un logger jamais appele
Stub    | Retourne une valeur predeterminee  | getUser() → { id: 1, name: 'Alice' }
Spy     | Enregistre les appels              | Verifie que sendEmail() a ete appele
Mock    | Spy + assertions sur les appels    | sendEmail appele 1 fois avec tel arg
Fake    | Implementation simplifiee          | InMemoryDatabase au lieu de PostgreSQL
```

> En pratique, Vitest combine spy et mock dans `vi.fn()`. Mais comprendre la distinction aide a choisir le bon outil.

### [02:30-06:00] vi.fn() — La base du mocking

> `vi.fn()` créé une fonction mock qui enregistre ses appels et peut retourner des valeurs predefinies.

**Action** : Créer `src/notification.test.ts`.

```typescript
import { describe, it, expect, vi } from 'vitest';

interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

function notifyUser(email: string, service: EmailService): Promise<void> {
  return service.send(email, 'Bienvenue', 'Votre compte est cree');
}

describe('notifyUser', () => {
  it('should send a welcome email', async () => {
    // Creer un mock de EmailService
    const mockService: EmailService = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    await notifyUser('alice@test.com', mockService);

    // Verifier les appels
    expect(mockService.send).toHaveBeenCalledOnce();
    expect(mockService.send).toHaveBeenCalledWith(
      'alice@test.com',
      'Bienvenue',
      'Votre compte est cree'
    );
  });
});
```

**Action** : Exécuter le test.

```bash
npx vitest run src/notification.test.ts
```

### [06:00-09:00] vi.spyOn() — Espionner sans remplacer

> `vi.spyOn()` observe une méthode existante sans changer son comportement (sauf si on le demandé).

**Action** : Demontrer vi.spyOn.

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';

const analytics = {
  track(event: string, data: Record<string, unknown>): void {
    console.log(`[Analytics] ${event}`, data);
  },
};

describe('vi.spyOn', () => {
  afterEach(() => {
    vi.restoreAllMocks(); // restaurer le comportement original
  });

  it('should spy on method calls', () => {
    const spy = vi.spyOn(analytics, 'track');

    analytics.track('page_view', { url: '/home' });

    expect(spy).toHaveBeenCalledWith('page_view', { url: '/home' });
  });

  it('should override return value when needed', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // console.log ne produit plus de sortie pendant ce test
    analytics.track('click', { button: 'submit' });
  });
});
```

> La différence clé : `vi.fn()` créé une fonction vide, `vi.spyOn()` observe une fonction existante. Toujours appeler `vi.restoreAllMocks()` en `afterEach` pour éviter les fuites entre tests.

### [09:00-12:30] vi.mock() — Mocker des modules entiers

> `vi.mock()` remplace un module complet par un mock. C'est utile quand on ne controle pas l'import.

**Action** : Créer un exemple avec module mock.

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock le module AVANT l'import
vi.mock('./api/userApi', () => ({
  getUser: vi.fn().mockResolvedValue({ id: 1, name: 'Alice' }),
  updateUser: vi.fn().mockResolvedValue(true),
}));

import { getUser } from './api/userApi';

describe('vi.mock()', () => {
  it('should return mocked data', async () => {
    const user = await getUser(1);
    expect(user).toEqual({ id: 1, name: 'Alice' });
  });
});
```

> Attention : `vi.mock()` est automatiquement "hoiste" en haut du fichier par Vitest. C'est pourquoi il fonctionne même s'il est écrit après l'import dans le code source.

### [12:30-15:00] Fake timers — Controler le temps

> Les timers (`setTimeout`, `setInterval`, `Date.now`) sont une source classique de flaky tests. Les fake timers les controlent.

**Action** : Créer un exemple avec fake timers.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('should call function after delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should reset timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(200);
    debounced(); // reset le timer
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled(); // pas encore 300ms depuis le dernier appel

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });
});
```

### [15:00-17:30] Anti-pattern — Le sur-mocking

> Le sur-mocking est l'erreur la plus courante. Si vous mockez tout, votre test ne teste plus rien — il vérifié juste que vos mocks fonctionnent.

**Action** : Afficher la regle.

```
REGLE D'OR DU MOCKING :
- Mocker les DEPENDANCES EXTERNES (API, DB, filesystem, emails)
- NE PAS mocker l'UNITE SOUS TEST
- NE PAS mocker les fonctions utilitaires pures
- Si vous mockez plus de 3 choses, votre code a un probleme de design

ALTERNATIVE AU MOCKING :
→ L'injection de dependances (Module 06)
→ Les fakes (InMemoryDatabase, MSW)
```

### [17:30-19:00] Récapitulatif

**Action** : Afficher le récapitulatif.

```
CE QU'IL FAUT RETENIR :
1. 5 types de doubles : dummy, stub, spy, mock, fake
2. vi.fn() cree un mock, vi.spyOn() observe une methode existante
3. vi.mock() remplace un module entier (hoiste automatiquement)
4. vi.useFakeTimers() controle setTimeout, setInterval, Date.now
5. Toujours vi.restoreAllMocks() en afterEach
6. Sur-mocking = test qui ne teste rien

PROCHAINE ETAPE :
→ Screencast 05 : Tests asynchrones
```

## Points d'attention pour l'enregistrement
- La taxonomie des test doubles est souvent meconnue — bien l'expliquer
- Le hoisting de vi.mock() est un piege classique — montrer que l'ordre dans le code n'importe pas
- La demo de fake timers avec debounce est très visuelle
- Insister sur le danger du sur-mocking avec un exemple concret
