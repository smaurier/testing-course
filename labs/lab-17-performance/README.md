# Lab 17 — Performance testing (k6)

> **Outcome :** à la fin, tu sais écrire un script k6 avec stages et thresholds p95, interpréter la sortie, et intégrer le budget de performance en CI.
> **Vrai outil :** k6 (CLI officiel Grafana). Aucun harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

L'endpoint `POST /api/invitations` de TribuZen doit tenir 100 req/s avec un p95 inférieur à 500 ms et un taux d'erreur inférieur à 1 %. Ton serveur NestJS tourne en local sur `http://localhost:3000`.

**Code de départ (déjà fourni, ne le modifie pas) :**

```js
// tests/perf/invitation-load.js  — squelette à compléter
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  // TODO : ajouter stages et thresholds
};

export default function () {
  // TODO : appel POST /api/invitations + check + sleep
}
```

Ta mission : compléter ce fichier pour qu'il modélise la charge cible, exprime le budget de performance, et que k6 sorte exit 1 si le budget est violé.

## Étapes (en friction)

1. **Installation.** Installe k6 si ce n'est pas fait.

```bash
# Windows
winget install k6 --source winget
# macOS
brew install k6
# Vérifier
k6 version
```

2. **Stages.** Complète `options.stages` : montée à 50 VUs en 30 s, maintien à 100 VUs pendant 1 min, descente à 0 en 30 s. Réfléchis : pourquoi ne pas monter directement à 100 VUs ?

3. **Thresholds.** Définis les seuils avant de lancer le test : p95 < 500 ms sur `http_req_duration`, taux d'erreur < 1 % sur `http_req_failed`. Ajoute un seuil spécifique à l'endpoint via un tag.

4. **Payload et appel.** Dans `default`, construis le payload `{ email, familyId }`, appelle `http.post` avec `Content-Type: application/json` et un tag `{ endpoint: 'invite' }`. Ajoute `sleep(1)`.

5. **Checks.** Ajoute deux checks : `status 201` et `id présent` (parse le body JSON). Comprends la différence entre check et threshold : lequel fait échouer la CI ?

6. **Lancer et lire la sortie.** Lance le test. Identifie dans la sortie : p95, taux d'erreur, débit (req/s), et l'état de chaque threshold (✓ ou ✗).

7. **CI snippet.** Rédige un step GitHub Actions minimal qui installe k6, démarre le serveur en arrière-plan, et lance le test. Que se passe-t-il si le threshold est violé ?

## Corrigé complet commenté

```js
// tests/perf/invitation-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    // Montée progressive : évite le thundering herd (pic artificiel au démarrage)
    { duration: '30s', target: 50  },
    // Charge cible : 100 VUs en parallèle pendant 1 min
    { duration: '1m',  target: 100 },
    // Descente : observe la récupération du serveur après la charge
    { duration: '30s', target: 0   },
  ],
  thresholds: {
    // Budget SLO : 95 % des requêtes sous 500 ms
    'http_req_duration':                  ['p(95)<500'],
    // Budget fiabilité : moins de 1 % d'erreurs HTTP
    'http_req_failed':                    ['rate<0.01'],
    // Budget par endpoint : plus strict car endpoint critique
    'http_req_duration{endpoint:invite}': ['p(95)<400'],
  },
};

// Payload constant : l'email unique n'est pas l'objet du test de charge.
// On veut mesurer la perf de l'endpoint, pas les collisions de données.
const PAYLOAD = JSON.stringify({ email: 'guest@tribu.fr', familyId: 'fam-beta-1' });
const HEADERS  = { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' };

export default function () {
  // tags : permet de filtrer les métriques dans les thresholds et dans Grafana
  const res = http.post(
    'http://localhost:3000/api/invitations',
    PAYLOAD,
    { headers: HEADERS, tags: { endpoint: 'invite' } },
  );

  // check : assertions inline sur la réponse.
  // Un check raté N'arrête PAS le test et ne fait PAS échouer la CI.
  // C'est les thresholds qui décident du code de sortie.
  check(res, {
    'status 201': (r) => r.status === 201,
    'id présent': (r) => {
      try { return Boolean(JSON.parse(r.body).id); }
      catch { return false; }
    },
  });

  // Pause de 1 s : simule le temps entre deux actions d'un utilisateur réel.
  // Sans sleep, chaque VU envoie des requêtes aussi vite que possible
  // → charge artificielle qui ne reflète pas l'usage réel.
  sleep(1);
}
```

Step CI minimal :

```yaml
# .github/workflows/perf.yml (extrait)
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

- name: Wait for server
  run: npx wait-on http://localhost:3000/api/status --timeout 30000

- name: Run load test
  run: k6 run tests/perf/invitation-load.js
  # k6 sort exit 1 si un threshold est violé → step échoue → PR bloquée
```

Points de validation par le coach : (a) `stages` modélise bien la montée progressive, pas un pic direct ; (b) les thresholds sont définis avant le run, pas ajustés a posteriori ; (c) distinction check/threshold formulée à voix haute ; (d) le tag `endpoint:invite` permet un seuil spécifique dans `thresholds` ; (e) la sortie k6 est lue méthodiquement (p95, taux d'erreur, débit, état de chaque seuil).

## Variante J+30 (fading)

Reprends sans relire le corrigé, en 20 min, et ajoute deux contraintes :

1. **Spike test.** Ajoute un second fichier `invitation-spike.js` qui modélise un pic brutal à 500 VUs pendant 30 s. Assouplis le threshold à p95 < 2 000 ms (dégradation acceptable). Explique pourquoi le seuil est différent de celui du load test.
2. **Tag par scénario.** Dans le load test, ajoute un second endpoint testé `GET /api/families` dans la même itération, tagué `{ endpoint: 'families' }`. Définis un threshold p95 < 200 ms sur cet endpoint (lecture simple, donc plus rapide). Vérifie dans la sortie que les métriques sont bien séparées.

## Application TribuZen

Porte ce lab dans le vrai repo `smaurier/tribuzen` :

1. Crée `tests/perf/invitation-load.js` à partir du corrigé. Adapte l'URL (`http://localhost:3000`) et le token (`Authorization: Bearer`) à la configuration locale du projet.
2. Lance le test contre le serveur NestJS en mode dev (`pnpm start:dev`). Si le threshold p95 < 500 ms échoue, inspecte les logs NestJS pour identifier si le goulot est la requête Prisma `create` ou l'appel notifier.
3. Ajoute `.github/workflows/perf.yml` avec le step CI du corrigé. Utilise la variable d'environnement `TEST_TOKEN` (secret GitHub) pour l'Authorization.
4. Commit `smaurier/tribuzen` : `test(perf): load test k6 invitation endpoint — budget p95 500ms`.
