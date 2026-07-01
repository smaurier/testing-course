---
titre: Performance testing
cours: 06-testing
notions: [types load stress soak spike, métriques latence débit p95 p99, outil k6, seuils et budgets de performance, tests de perf en CI, interpréter les résultats, vs tests fonctionnels]
outcomes: [distinguer les types de tests de performance, définir des seuils et budgets, écrire un test de charge avec k6, intégrer un budget perf en CI et interpréter les résultats]
prerequis: [16-contract-testing]
next: 18-projet-final
libs: [{ name: k6, version: latest }]
tribuzen: test de charge sur l'endpoint d'invitation TribuZen (k6, seuil p95)
last-reviewed: 2026-07
---

# Performance testing

> **Outcomes — tu sauras FAIRE :** distinguer load/stress/soak/spike, définir un budget p95/p99, écrire un script k6 avec stages et thresholds, l'intégrer en CI et interpréter la sortie.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, un utilisateur envoie une invitation à un proche via `POST /api/invitations`. Lors du lancement beta, 100 familles s'inscrivent en simultané et chacune envoie plusieurs invitations. **Est-ce que l'endpoint tient 100 req/s avec un temps de réponse p95 inférieur à 500 ms ?**

Contrairement à un test fonctionnel (`InvitationService.invite` retourne le bon id), cette question ne peut pas être répondue par Vitest : elle demande de mesurer le comportement du système **sous charge réelle**. On a besoin d'un outil qui génère plusieurs utilisateurs virtuels en parallèle, mesure la latence de chaque requête, et vérifie des seuils.

```bash
k6 run tests/perf/invitation-load.js
```

```
✓ status 201
✓ durée < 500ms

http_req_duration............: avg=142ms  p(95)=487ms  p(99)=612ms
http_req_failed..............: 0.00%
http_reqs....................: 6 120   102/s
```

Le résultat dit : p95 = 487 ms (sous le seuil de 500 ms), débit = 102 req/s. L'endpoint tient. Mais que se passe-t-il si 300 familles s'inscrivent ? Pour le savoir il faut un stress test. La suite donne les concepts, l'outil, et comment automatiser la réponse.

## 2. Théorie complète, concise

### Types de tests de performance

Quatre types, distincts par **l'intention** et le **profil de charge** :

| Type | Question posée | Profil charge | Durée typique |
|------|---------------|---------------|---------------|
| **Load** | L'API se comporte-t-elle normalement sous charge nominale ? | Charge constante ou rampe douce jusqu'au pic attendu | 5-30 min |
| **Stress** | Où est la limite du système ? | Montée progressive jusqu'à la rupture | 15-60 min |
| **Spike** | L'API survit-elle à un pic brutal et se rétablit-elle ? | Pic soudain ×5-×10 puis retour immédiat | 2-10 min |
| **Soak** | La mémoire ou les connexions fuient-elles ? | Charge constante modérée sur une longue durée | 1-4 h |

Règle : toujours faire le **load test** en premier. Le stress test et le spike test sur un système déjà dégradé ne mesurent rien d'utile.

### Métriques clés — latence, débit, percentiles

**Latence** : temps entre l'envoi d'une requête et la réception de la réponse. Mesurée en ms.

**Débit (throughput)** : nombre de requêtes réussies par seconde (req/s ou RPS). Une API rapide mais plafonnée à 10 req/s ne tient pas la charge.

**Pourquoi p95 et p99, pas la moyenne ?**

La moyenne masque les outliers. Si 95 requêtes répondent en 10 ms et 5 en 2 000 ms, la moyenne est ~110 ms — une valeur qui semble raisonnable. p95 = 2 000 ms, ce qui révèle le vrai problème.

- **p95** : 95 % des requêtes sont en dessous de cette valeur. Seuil standard pour les SLOs.
- **p99** : 99 % en dessous. Révèle les pires cas ; utile pour les endpoints critiques (paiement, auth).
- **max** : dangereux en isolation — un seul pic fausse tout. À lire en contexte du p99.

### k6 — structure d'un script

k6 s'écrit en JavaScript ES6. La structure canonique :

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

// options : tout ce qui concerne la charge et les seuils
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // montée à 20 VUs en 30 s
    { duration: '1m',  target: 20 },  // maintien 1 min
    { duration: '30s', target: 0  },  // descente
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // seuil : p95 < 500 ms
    http_req_failed:   ['rate<0.01'],  // taux d'erreur < 1 %
  },
};

// fonction par défaut : exécutée en boucle par chaque VU
export default function () {
  const res = http.get('http://localhost:3000/api/status');
  check(res, {
    'status 200': (r) => r.status === 200,
  });
  sleep(1); // pause entre requêtes (simule un vrai utilisateur)
}
```

**VUs (Virtual Users)** : goroutines légères qui exécutent chacune la fonction `default` en boucle. 100 VUs = 100 utilisateurs fictifs en parallèle.

**Stages** : liste d'objets `{ duration, target }`. k6 interpole linéairement entre `target` d'une étape à l'autre. Permet de modéliser la montée en charge, le maintien, et la descente.

**Checks** : assertions inline sur la réponse (status, body, durée). Ils n'arrêtent pas le test, ils comptent les succès/échecs. Ce sont les **thresholds** qui décident du code de sortie.

**Thresholds** : critères de réussite. Si un seuil est violé, k6 sort avec exit code 1 — ce qui fait échouer la CI.

```js
thresholds: {
  'http_req_duration':                ['p(95)<500', 'p(99)<1000'],
  'http_req_failed':                  ['rate<0.01'],
  // tag par endpoint
  'http_req_duration{endpoint:invite}': ['p(95)<400'],
},
```

### Métriques k6 intégrées

| Métrique | Type | Description |
|----------|------|-------------|
| `http_req_duration` | Trend | Durée totale de la requête HTTP (ms) |
| `http_req_failed` | Rate | Proportion de requêtes ayant échoué |
| `http_reqs` | Counter | Nombre total de requêtes |
| `http_req_blocked` | Trend | Temps bloqué avant connexion (DNS, TCP) |
| `vus` | Gauge | Nombre de VUs actifs |
| `iteration_duration` | Trend | Durée d'une itération complète |

### Seuils et budgets de performance

Un **budget de performance** = ensemble de seuils définis **avant** le développement, pas après avoir vu les résultats. Il formalise les attentes sous forme de contraintes testables :

```js
thresholds: {
  http_req_duration: ['p(95)<500'],  // SLO métier : 95 % des req < 500 ms
  http_req_failed:   ['rate<0.01'],  // fiabilité : < 1 % d'erreurs
},
```

Règle : le seuil doit correspondre à un **SLO** (Service Level Objective) explicite, pas à « ce que le système fait aujourd'hui ». Sinon on mesure sans s'engager à rien.

### Tests de perf en CI

Intégrer le budget en CI permet de détecter les régressions **avant** de merger :

```yaml
# .github/workflows/perf.yml
- name: Install k6
  run: |
    sudo gpg --no-default-keyring \
      --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
      --keyserver hkp://keyserver.ubuntu.com:80 \
      --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
    echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] \
      https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
    sudo apt-get update && sudo apt-get install k6

- name: Start server
  run: pnpm build && pnpm preview &

- name: Run load test
  run: k6 run --out json=results.json tests/perf/invitation-load.js
```

Si un threshold est violé, k6 sort avec exit code 1 → la CI échoue → la PR est bloquée. Aucun script de comparaison à écrire : les thresholds sont le budget automatisé.

**Contrainte CI** : les tests soak (1-4 h) ne tournent pas sur chaque PR. Réserver un pipeline dédié (nightly ou pré-prod), avec charge plus légère (5-10 min) en PR.

### Interpréter les résultats

Sortie k6 à la fin d'un run :

```
checks.........................: 98.20% ✓ 6003  ✗ 109
http_req_duration..............: avg=142ms   p(95)=487ms   p(99)=812ms  max=2341ms
  { endpoint:invite }.........: avg=198ms   p(95)=491ms
http_req_failed................: 1.77%   ✗ 109
http_reqs......................: 6112    101.8/s
✗ http_req_failed................: rate<0.01  rate=0.018 — THRESHOLD FAILED
```

Lecture méthodique :
1. **Checks** : combien ont passé ? 98 % ici → 2 % de réponses inattendues.
2. **p95 vs seuil** : 487 ms < 500 ms → threshold OK.
3. **http_req_failed** : 1,77 % > 1 % → threshold FAILED → exit code 1.
4. **Débit** : 101,8 req/s → l'objectif 100 req/s est atteint.
5. **max** : 2 341 ms → pic isolé, pas de panique si p99 reste acceptable.

Le threshold `http_req_failed` a échoué : des requêtes renvoient une erreur HTTP. C'est ça qu'on investigate — pas le p95.

### vs tests fonctionnels

| Dimension | Test fonctionnel (Vitest) | Test de performance (k6) |
|-----------|--------------------------|--------------------------|
| Question | « Le code fait-il ce qu'il doit ? » | « Le système tient-il sous charge ? » |
| Portée | Unitaire / intégration | Système entier (API + DB + infra) |
| Concurrence | 1 exécution à la fois | N VUs en parallèle |
| Environnement | Local, rapide | Staging ou prod-like |
| Feedback | Pass/Fail par assertion | Métriques + seuils |
| Moment | Sur chaque commit | Sur PR critique, nightly, avant release |

Les deux sont complémentaires. Un endpoint qui passe les tests fonctionnels peut s'effondrer à 50 req/s si la requête SQL n'est pas indexée.

## 3. Worked examples

### Exemple A — script de load test invitation TribuZen (avec thresholds p95)

Objectif : vérifier que `POST /api/invitations` tient 100 VUs, p95 < 500 ms, taux d'erreur < 1 %.

```js
// tests/perf/invitation-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

// Budget de performance — défini AVANT d'écrire le test
export const options = {
  stages: [
    { duration: '30s', target: 50  }, // montée progressive : évite le thundering herd
    { duration: '1m',  target: 100 }, // charge cible
    { duration: '30s', target: 0   }, // descente : observe la récupération
  ],
  thresholds: {
    // SLO principal : 95 % des requêtes < 500 ms
    'http_req_duration':                  ['p(95)<500'],
    // SLO fiabilité : moins de 1 % d'erreurs
    'http_req_failed':                    ['rate<0.01'],
    // SLO par endpoint tagué
    'http_req_duration{endpoint:invite}': ['p(95)<400'],
  },
};

// Payload réaliste : simule un utilisateur TribuZen réel
const PAYLOAD = JSON.stringify({ email: 'guest@tribu.fr', familyId: 'fam-beta-1' });
const HEADERS = { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' };

export default function () {
  // Tag l'endpoint pour filtrer les métriques dans les thresholds
  const res = http.post(
    'http://localhost:3000/api/invitations',
    PAYLOAD,
    { headers: HEADERS, tags: { endpoint: 'invite' } },
  );

  // check : assertions inline, ne bloquent pas le test mais comptent
  check(res, {
    'status 201': (r) => r.status === 201,
    'id présent':  (r) => {
      try { return Boolean(JSON.parse(r.body).id); }
      catch { return false; }
    },
  });

  // Pause de 1 s : modélise le temps entre deux actions utilisateur
  sleep(1);
}
```

Pas-à-pas : (1) `stages` modélise la montée progressive — monter directement à 100 VUs est un spike, pas un load test ; (2) les thresholds définissent le budget avant d'avoir vu les chiffres ; (3) `tags: { endpoint: 'invite' }` permet un seuil p95 spécifique à cet endpoint ; (4) `check` valide le contrat fonctionnel **pendant** la charge ; (5) `sleep(1)` évite que k6 sature artificiellement le serveur.

Lancer :

```bash
k6 run tests/perf/invitation-load.js
```

### Exemple B — spike test (lecture de sortie et diagnostic)

Un spike test avec 10 VUs → pic brutal à 500 VUs → retour :

```js
// tests/perf/invitation-spike.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10  }, // baseline
    { duration: '5s',  target: 500 }, // pic brutal
    { duration: '30s', target: 500 }, // maintien du pic
    { duration: '10s', target: 10  }, // retour à la normale
    { duration: '10s', target: 0   },
  ],
  thresholds: {
    // On accepte une dégradation sous pic, mais pas l'effondrement
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed':   ['rate<0.05'],
  },
};

export default function () {
  const res = http.post(
    'http://localhost:3000/api/invitations',
    JSON.stringify({ email: `user${__VU}@tribu.fr`, familyId: 'fam-1' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'non-5xx': (r) => r.status < 500 });
  sleep(1);
}
```

Sortie à analyser :

```
http_req_duration..: avg=892ms  p(95)=1 847ms  p(99)=3 201ms  max=8 450ms
http_req_failed....: 3.20%   ✗ 480
✓ http_req_duration: p(95)<2000 — OK (1847ms)
✓ http_req_failed..: rate<0.05  — OK (0.032)
```

Lecture : p95 = 1 847 ms < 2 000 ms → sous le seuil assoupli pour le spike. Taux d'erreur 3,2 % < 5 %. Le système survit au pic mais se dégrade fortement. Next step : augmenter les connexions du pool de base ou ajouter un rate limiter en entrée.

## 4. Pièges & misconceptions

- **Utiliser la moyenne à la place de p95.** La moyenne additionne les temps de réponse et divise par N. Un seul timeout à 30 s sur 1 000 requêtes rapides ne dégrade la moyenne que de 30 ms — imperceptible. p95 = 30 000 ms le trahit immédiatement. *Correct* : toujours contractualiser sur p95 ou p99, jamais sur la moyenne seule.

- **Tester en local et publier les chiffres comme référence.** Un laptop développeur n'a pas les mêmes CPU, mémoire, latence réseau, limites de fichiers ouverts qu'un serveur en staging. Les résultats locaux sont 3-10× meilleurs. *Correct* : les tests de charge tournent sur une infrastructure proche de la prod (staging), pas sur le poste du développeur.

- **Pas de seuil explicite.** Lancer k6 et observer les chiffres sans threshold revient à peser un patient sans donner de poids de référence. Le test ne peut pas échouer. *Correct* : définir les thresholds avant de lancer le premier run, idéalement dans un fichier de configuration versionné.

- **Confondre test fonctionnel et test de performance.** Écrire des checks k6 très détaillés (body exact, champs précis) duplique la couverture Vitest et alourdit le script. k6 checks = contrat minimal (status code, présence d'un id) ; la sémantique fine = tests fonctionnels. *Correct* : les deux couches sont complémentaires, pas substituables.

- **Confondre spike test et stress test.** Un stress test monte graduellement jusqu'à la rupture (on cherche la limite). Un spike test monte brutalement à une charge prédéfinie et observe la récupération (on cherche la résilience). *Correct* : stress → `stages` avec target croissant sans plafond ; spike → pic brutal puis retour, seuils assouplis.

- **Interpréter max comme seuil.** Un max à 5 000 ms peut être un cas isolé (cold start, GC pause). Alerter sur le max → faux positifs en cascade. *Correct* : max = signal d'investigation, pas seuil. Utiliser p99 pour les cas limites.

## 5. Ancrage TribuZen

Couche fil-rouge : **test de charge sur l'endpoint d'invitation TribuZen (k6, seuil p95)** (`smaurier/tribuzen`).

En session, le script `tests/perf/invitation-load.js` de l'Exemple A tourne contre le vrai serveur NestJS TribuZen en local ou staging. Le SLO p95 < 500 ms correspond à l'engagement beta : une invitation confirmée en moins d'une seconde pour 95 % des familles. Si le threshold échoue, les coupables probables sont la requête Prisma `create` sans index, ou le call notifier synchrone bloquant le thread — deux leviers d'optimisation identifiés directement par la sortie k6.

Le workflow CI associé (`.github/workflows/perf.yml`) bloque le merge si le budget est violé. On ne livre pas un endpoint d'invitation dégradé en production.

## 6. Points clés

1. Load = charge nominale ; stress = jusqu'à rupture ; spike = pic brutal + récupération ; soak = durée longue pour détecter les fuites.
2. p95 et p99 sont les métriques contractuelles ; la moyenne masque les outliers et ne doit pas servir de seuil.
3. Un VU k6 est un utilisateur virtuel qui exécute la fonction `default` en boucle ; `stages` pilote l'évolution du nombre de VUs dans le temps.
4. `thresholds` = budget de performance : si un seuil est violé, k6 sort exit 1 et la CI échoue.
5. Définir les thresholds avant le premier run, pas après avoir vu les chiffres.
6. `check` = assertion inline sur la réponse (ne fait pas échouer le test) ; `threshold` = critère de sortie (fait échouer la CI).
7. Tags (`tags: { endpoint: 'invite' }`) permettent des thresholds par endpoint dans le même run.
8. Les tests de charge tournent sur une infra proche de la prod (pas le laptop développeur).

## 7. Seeds Anki

```
Quels sont les 4 types de tests de performance et leur question respective ?|Load = charge nominale ; Stress = où est la limite ; Spike = survie + récupération après pic brutal ; Soak = fuite mémoire ou connexions sur durée longue
Pourquoi utiliser p95 plutôt que la moyenne comme seuil de performance ?|La moyenne masque les outliers : 5 timeouts à 30 s sur 1000 requêtes rapides élèvent la moyenne de seulement 150 ms. p95 les révèle immédiatement.
Quelle est la différence entre un check et un threshold en k6 ?|check = assertion inline qui compte les succès/échecs sans arrêter le test. threshold = critère de sortie : si violé, k6 sort exit 1 et la CI échoue.
Qu'est-ce qu'un VU dans k6 et que fait-il ?|Virtual User — goroutine légère qui exécute la fonction default en boucle. 100 VUs = 100 utilisateurs fictifs en parallèle.
À quoi servent les stages dans options k6 ?|Ils définissent l'évolution du nombre de VUs dans le temps via une liste de { duration, target }. k6 interpole linéairement entre chaque cible.
Quand définir les thresholds de performance — avant ou après le premier run ?|Avant. Les définir après revient à adapter le budget au résultat observé, ce qui vide le test de sens.
Différence entre spike test et stress test ?|Stress = montée progressive jusqu'à rupture (cherche la limite du système). Spike = pic brutal prédéfini puis retour à la normale (cherche la résilience et la récupération).
Pourquoi ne pas baser les seuils sur le max k6 ?|Le max peut être un cas isolé (cold start, GC pause). Alerter dessus génère des faux positifs. Utiliser p99 pour les cas limites, le max pour l'investigation.
```

## Pont vers le lab

> Lab associé : `06-testing/labs/lab-17-performance/README.md`. Tu y écris, en **k6 réel**, le test de charge de l'endpoint d'invitation TribuZen — stages, thresholds p95, checks, tag par endpoint — et tu l'intègres en CI. Corrigé complet commenté + variante J+30 dans le README du lab.
