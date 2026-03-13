# Screencast 17 — Performance testing

## Informations
- **Duree estimee** : 18-20 min
- **Module** : `modules/17-performance-testing.md`
- **Lab associe** : Lab 17
- **Prerequis** : Screencast 16

## Setup
- [ ] VS Code ouvert dans `testing-course/`
- [ ] Terminal integre ouvert
- [ ] k6 installe (`brew install k6` ou binaire)
- [ ] Application de demo demarree sur localhost:3000
- [ ] Fichier `modules/17-performance-testing.md` ouvert

## Script

### [00:00-02:30] Introduction — Les types de tests de performance

> "Ca marche" et "ca tient la charge" sont deux choses differentes. Il existe 4 types de tests de performance, chacun avec un objectif different.

**Action** : Afficher les 4 types.

```
  Charge (VUs)
  ▲
  │          ┌──────┐
  │    Spike │      │
  │          │      │     Stress
  │    ┌─────┤      ├────────────────┐
  │    │     │      │                │
  │    │     └──────┘     Load       │
  │    │    ┌─────────────────┐      │     Soak
  │    │    │                 │      │    ┌─────────────
  │    │    │                 │      │    │
  └────┴────┴─────────────────┴──────┴────┴──────────► Temps

LOAD    : Charge normale → les SLAs sont-ils respectes ?
STRESS  : Charge croissante → ou est le point de rupture ?
SPIKE   : Pic soudain → le systeme recupere-t-il ?
SOAK    : Charge constante longue → y a-t-il des fuites memoire ?
```

### [02:30-06:30] k6 — Premiers scripts

> k6 est l'outil de reference pour les tests de charge. Scripts en JavaScript, metriques en temps reel, scenarios complexes, seuils configurables.

**Action** : Creer un premier script k6.

```javascript
// k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // montee a 10 VUs
    { duration: '1m',  target: 10 },   // palier a 10 VUs
    { duration: '30s', target: 0 },    // descente a 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% des requetes < 500ms
    http_req_failed: ['rate<0.01'],     // < 1% d'echecs
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/tasks');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'body has tasks': (r) => JSON.parse(r.body).length > 0,
  });

  sleep(1); // 1 seconde entre chaque iteration
}
```

**Action** : Executer le test.

```bash
k6 run k6/load-test.js
```

> k6 affiche en temps reel : le nombre de VUs, les requetes/seconde, le p95 de latence, le taux d'echec. Les thresholds determinent si le test passe ou echoue.

### [06:30-09:30] Scenarios avances — Stress et spike

**Action** : Creer un test de stress.

```javascript
// k6/stress-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 200 },
    { duration: '30s', target: 300 },   // au-dela de la capacite ?
    { duration: '1m',  target: 0 },     // recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/tasks');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

**Action** : Creer un test de spike.

```javascript
// k6/spike-test.js
export const options = {
  stages: [
    { duration: '10s', target: 10 },    // normal
    { duration: '5s',  target: 500 },   // SPIKE !
    { duration: '30s', target: 500 },   // maintenir
    { duration: '10s', target: 10 },    // retour normal
    { duration: '30s', target: 10 },    // le systeme recupere-t-il ?
  ],
};
```

### [09:30-12:00] Vitest bench — Benchmarking de fonctions

> Pour les micro-benchmarks (comparer deux implementations), Vitest a un mode bench integre.

**Action** : Creer un benchmark.

```typescript
// src/sort.bench.ts
import { bench, describe } from 'vitest';

function bubbleSort(arr: number[]): number[] {
  const result = [...arr];
  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < result.length - i - 1; j++) {
      if (result[j] > result[j + 1]) {
        [result[j], result[j + 1]] = [result[j + 1], result[j]];
      }
    }
  }
  return result;
}

const testData = Array.from({ length: 1000 }, () => Math.random() * 1000);

describe('sorting algorithms', () => {
  bench('Array.sort()', () => {
    [...testData].sort((a, b) => a - b);
  });

  bench('bubbleSort', () => {
    bubbleSort(testData);
  });
});
```

**Action** : Executer le benchmark.

```bash
npx vitest bench
```

### [12:00-14:30] Frontend — Lighthouse CI et Web Vitals

> Les performances frontend se mesurent avec les Core Web Vitals : LCP, FID/INP, CLS.

**Action** : Configurer Lighthouse CI.

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/tasks'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

```bash
npx lhci autorun
```

> Lighthouse CI tourne dans le pipeline et echoue si les performances degradent en dessous des seuils. C'est le filet de securite pour les regressions de performance frontend.

### [14:30-16:30] Detecter les fuites memoire

**Action** : Montrer un test de fuite memoire.

```typescript
// Avec Vitest — detecter une fuite simple
describe('memory leak detection', () => {
  it('should not accumulate listeners', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();

    // Simuler N cycles mount/unmount
    for (let i = 0; i < 1000; i++) {
      emitter.on('event', handler);
      // Oubli du removeListener → fuite !
    }

    expect(emitter.listenerCount('event')).toBeLessThanOrEqual(1);
  });
});
```

```bash
# Avec k6 — soak test pour detecter les fuites serveur
k6 run --duration 30m --vus 10 k6/soak-test.js
# Surveiller la memoire du processus serveur en parallele
```

### [16:30-18:30] Recapitulatif

**Action** : Afficher le recapitulatif.

```
CE QU'IL FAUT RETENIR :
1. 4 types : load, stress, spike, soak
2. k6 pour les tests de charge (scripts JS, thresholds, CI-ready)
3. vitest bench pour les micro-benchmarks de fonctions
4. Lighthouse CI pour les regressions de performance frontend
5. Soak test pour detecter les fuites memoire
6. Toujours definir des seuils (p95 < Xms) et pas juste observer

PROCHAINE ETAPE :
→ Screencast 18 : Projet final
```

## Points d'attention pour l'enregistrement
- Le diagramme des 4 types de tests est essentiel — le garder visible
- La demo k6 en temps reel est visuellement impressionnante — lui donner du temps
- Le benchmark vitest bench est rapide et spectaculaire — montrer la difference
- Lighthouse CI est un quick win pour la CI — insister sur la facilite d'integration
