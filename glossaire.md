# Glossaire du Testing

~50 termes essentiels pour maîtriser le vocabulaire du testing logiciel.

---

## A

### AAA (Arrange-Act-Assert)
Pattern de structuration d'un test en 3 étapes : preparer le contexte (Arrange), exécuter l'action (Act), vérifier le résultat (Assert). Equivalent BDD : Given-When-Then.

### Assertion
Vérification dans un test qu'une valeur correspond a l'attendu. Ex : `expect(result).toBe(42)`. Un test sans assertion est inutile.

### ATDD (Acceptance Test-Driven Development)
Variante du TDD ou les tests d'acceptance sont ecrits avant l'implementation, en collaboration avec le Product Owner. Les tests servent de spécification executable.

## B

### BDD (Behavior-Driven Development)
Méthodologie ou les tests decrivent le comportement attendu en langage naturel structure : Given (contexte), When (action), Then (résultat). Outils : Cucumber, Gherkin.

### Benchmark
Test mesurant la performance d'une operation (temps d'exécution, throughput). Vitest propose `vitest bench` pour comparer des implementations.

### Black-box Testing
Tester sans connaître l'implementation interne — uniquement via les entrees et sorties publiques. Oppose a white-box testing.

### Branch Coverage
Pourcentage de branches conditionnelles (if/else, switch, ternaire) executees par les tests. Plus précis que le line coverage.

## C

### CI/CD (Continuous Intégration / Continuous Deployment)
Pipeline automatise : build → tests → déploiement. Les tests sont la porte de qualite entre chaque étape.

### Code Coverage
Mesure du pourcentage de code exécuté par les tests. Types : line, branch, function, statement. 80% est un seuil pragmatique ; 100% est rarement pertinent.

### Component Test
Test d'un composant UI avec son rendu, ses interactions et ses enfants. Entre le test unitaire (isole) et le test d'intégration (multi-couches).

### Contract Test
Test verifiant qu'un consommateur d'API et son fournisseur respectent un contrat commun (schema, format, champs). Outil : Pact.

## D

### Dead Code
Code jamais exécuté, detectable par l'analyse de couverture. Signe de complexite inutile ou de branches obsoletes.

### Dependency Injection (DI)
Pattern ou les dépendances sont passees en paramètre (constructeur, fonction) au lieu d'etre instanciees en interne. Rend le code testable en permettant de substituer des mocks.

### Describe Block
Bloc de groupement dans un test runner (Vitest, Jest). Permet d'organiser les tests par fonctionnalite : `describe('UserService', () => { ... })`.

## E

### E2E Test (End-to-End)
Test simulant le parcours complet d'un utilisateur : navigateur, clics, formulaires, navigation. Lent mais haute confiance. Outil : Playwright.

### Expect
Fonction d'assertion dans Vitest/Jest. `expect(value)` retourne un objet avec des matchers : `.toBe()`, `.toEqual()`, `.toThrow()`, etc.

## F

### Fake
Implementation fonctionnelle simplifiee d'une dépendance. Ex : une base de donnees en mémoire (Map) au lieu de PostgreSQL. Plus realiste qu'un mock, moins lourd que la vraie dépendance.

### Fixture
Donnees ou contexte pre-configures pour un test. En Playwright : mécanisme de DI pour partager des objets (page, auth, db) entre tests.

### Flaky Test
Test qui passe ou echoue de manière non déterministe. Causes : timing, état partage, réseau, animations. A corriger immediatement ou mettre en quarantaine.

## G

### Given-When-Then
Syntaxe BDD pour structurer un test : Given (prérequis), When (action), Then (résultat attendu). Equivalent de AAA.

## H

### Happy Path
Scenario ou tout se passe bien : donnees valides, pas d'erreur, résultat attendu. Toujours tester le happy path ET les cas d'erreur.

## I

### Intégration Test
Test verifiant que plusieurs modules fonctionnent ensemble correctement. Ex : service + base de donnees + API. Plus lent qu'un test unitaire, plus fiable qu'un mock.

### Istanbul
Outil de mesure de code coverage pour JavaScript/TypeScript. Utilise par Vitest (via c8 ou v8 provider) pour générer des rapports de couverture.

## K

### k6
Outil de load testing (Grafana). Scripts en JavaScript, exécution en Go pour la performance. Definit des scenarios avec virtual users, thresholds et checks.

## L

### Load Test
Test de performance simulant une charge utilisateur normale pour vérifier que le système tient ses SLA (temps de réponse, error rate).

## M

### Matcher
Méthode d'assertion sur un `expect()`. Ex : `toBe`, `toEqual`, `toContain`, `toThrow`, `toHaveBeenCalledWith`. Vitest et Jest partagent la même API.

### Mock
Objet simulant une dépendance avec des attentes verifiables. `vi.fn()` créé un mock dont on peut vérifier les appels : `.toHaveBeenCalled()`, `.toHaveBeenCalledWith()`.

### MSW (Mock Service Worker)
Librairie interceptant les requêtes HTTP au niveau réseau (Service Worker en browser, interceptor en Node). Permet de mocker des APIs sans modifier le code source.

### Mutation Testing
Technique inserant des mutations dans le code source (changer `>` en `>=`, `+` en `-`) et verifiant que les tests detectent chaque mutation. Score de mutation = qualite réelle des tests.

## P

### Page Object (Model)
Pattern E2E encapsulant les interactions d'une page dans une classe. `LoginPage.login(user, pass)` au lieu de selectors repetes. Ameliore la maintenance et la lisibilite.

### Parameterized Test
Test exécuté plusieurs fois avec des donnees différentes. Vitest : `it.each([[1, 2, 3], [0, 0, 0]])('add(%i, %i) = %i', (a, b, expected) => { ... })`.

### Playwright
Framework E2E cross-browser (Chromium, Firefox, WebKit). Auto-wait, codegen, trace viewer, screenshots. Le standard actuel pour les tests E2E.

### Property-Based Test
Test generant aleatoirement des entrees pour vérifier qu'une propriété est toujours vraie. Ex : `reverse(reverse(arr)) === arr`. Outil : fast-check.

## R

### Red-Green-Refactor
Cycle TDD : écrire un test qui echoue (Red), écrire le minimum pour qu'il passe (Green), ameliorer le code (Refactor). Repeter.

### Regression Test
Test verifiant qu'une fonctionnalite existante fonctionne toujours après une modification. La suite de tests entière est un filet de sécurité contre les regressions.

## S

### Selector
Moyen de localiser un élément dans le DOM pour un test. Priorite recommandee : role > label > text > testid > CSS selector.

### Setup / Teardown
Code exécuté avant (setup) et après (teardown) chaque test ou suite. Vitest : `beforeEach`, `afterEach`, `beforeAll`, `afterAll`.

### Shallow Mount
Rendu d'un composant sans ses composants enfants (remplaces par des stubs). Isole le composant mais peut masquer des bugs d'intégration.

### Smoke Test
Test rapide verifiant que les fonctionnalites critiques fonctionnent. Execute en premier dans un pipeline CI pour echouer rapidement.

### Snapshot Test
Test comparant la sortie d'un composant à un instantane sauvegarde. Detecte les changements inattendus mais généré du bruit si les snapshots ne sont pas maintenus.

### Spy
Fonction qui enregistre ses appels (arguments, nombre d'appels, valeur de retour) sans remplacer l'implementation originale. `vi.spyOn(obj, 'method')`.

### Stress Test
Test de performance poussant le système au-dela de sa capacité normale pour identifier le point de rupture.

### Stub
Fonction renvoyant une valeur predeterminee sans logique. `vi.fn().mockReturnValue(42)`. Plus simple qu'un mock, ne vérifié pas les appels.

### SUT (System Under Test)
L'unite de code testee : fonction, classe, composant, ou système entier selon le niveau de test.

## T

### TDD (Test-Driven Development)
Méthodologie ou les tests sont ecrits AVANT le code de production. Cycle Red-Green-Refactor. Force un design testable et une couverture maximale.

### Test Double
Terme générique pour tout objet remplacant une vraie dépendance dans un test. Sous-types : dummy, stub, spy, mock, fake.

### Test Runner
Outil exécutant les tests et rapportant les résultats. Vitest pour les tests unitaires/intégration, Playwright Test pour E2E.

### Test Suite
Ensemble de tests groupes logiquement, généralement dans un `describe` block ou un fichier `.test.ts`.

### Timeout
Duree maximale d'exécution d'un test avant qu'il echoue. Par defaut 5s dans Vitest, 30s dans Playwright. Ajustable par test.

## U

### Unit Test
Test d'une seule unite de code (fonction, méthode, classe) en isolation complete. Rapide (< 10ms), déterministe, pas de I/O.

## V

### Vitest
Test runner moderne pour TypeScript/JavaScript, alimente par Vite. Compatible Jest API, ESM natif, mode watch rapide, UI intégrée.

## W

### White-box Testing
Tester en connaissant l'implementation interne — viser les branches, les cas limites du code. Complementaire du black-box testing.
