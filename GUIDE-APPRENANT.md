# Guide de l'apprenant -- Testing

> **Ce guide est ta boussole.** Il t'aide a savoir ou tu en es, par ou passer,
> et quoi faire quand tu bloques. Lis-le avant de commencer, et reviens-y regulierement.
>
> **Temps estime** : ~120-160h (3-5 mois a 8-10h/semaine)
>
> **Philosophie** : Les tests ne sont pas une corvee qu'on fait "parce que le chef le demande".
> Ce sont des filets de securite qui te permettent de coder plus vite, avec plus de confiance.
> Chaque test ecrit est une heure de debugging economisee.

---

## Avant de commencer -- Auto-diagnostic

Reponds honnetement. Ce n'est pas un examen -- c'est un GPS.

### Bases JavaScript/TypeScript

Coche ce que tu sais faire SANS chercher sur Google :
- [ ] Ecrire une fonction async et gerer les erreurs avec `try/catch`
- [ ] Utiliser les imports/exports ES modules
- [ ] Manipuler des objets et tableaux (destructuring, spread)
- [ ] Comprendre les callbacks et les Promises
- [ ] Utiliser TypeScript (interfaces, types basiques)
- [ ] Utiliser npm/pnpm pour installer des dependances

**6/6** -> Tu es pret. Attaque directement le module 00.
**4-5/6** -> Revise les points manquants (~2-3h), puis lance-toi.
**< 4/6** -> Commence par les cours TypeScript (01) et JS Runtime (02) avant celui-ci.

### Testing -- ou en es-tu deja ?

- [ ] Tu as deja ecrit un test unitaire (peu importe le framework)
- [ ] Tu sais ce qu'est un mock et quand l'utiliser
- [ ] Tu as deja utilise un test runner (Jest, Vitest, Mocha...)
- [ ] Tu sais ce qu'est la couverture de code et comment la mesurer
- [ ] Tu as deja ecrit un test E2E (Cypress, Playwright, Selenium...)

**5/5** -> Tu peux probablement commencer a la Phase 2 (module 06). Fais le checkpoint Phase 1 d'abord.
**2-4/5** -> Commence par la Phase 1, tu consolideras tes bases.
**0-1/5** -> Parfait, tu es exactement le public vise. Commence au module 00.

### Le test decisif

On te donne une fonction `calculateDiscount(price, coupon)`. Comment la testes-tu ?

- Si tu penses a : cas normal, coupon invalide, prix negatif, coupon expire, limites -> tu as l'instinct testeur. Verifie la Phase 2.
- Si tu penses juste a "verifier que ca retourne le bon resultat" -> c'est un bon debut, la Phase 1 va t'apprendre la rigueur.
- Si tu ne sais pas par ou commencer -> pas de panique, le module 02 t'apprend exactement ca.

---

## Les 4 phases de ta progression

### Phase 1 -- Fondamentaux (modules 00-05) ~25-35h

> **Objectif** : Comprendre pourquoi tester, comment ecrire un bon test,
> maitriser Vitest, le mocking, et les tests asynchrones.
>
> **Analogie** : C'est comme apprendre a conduire sur un parking. Tu maitrises les bases avant la route.

| Module | Sujet | Temps | Note |
|---|---|---|---|
| 00 | Prerequis et introduction | 1h30 | Le "pourquoi tester" -- lis-le, ca change l'etat d'esprit |
| 01 | Pourquoi tester | 2h | ROI des tests, pyramide de tests, quand tester |
| 02 | Anatomie d'un test | 2h30 | **Cours cle** -- Arrange/Act/Assert, nommage, structure |
| 03 | Vitest fondamentaux | 3h | Setup, matchers, describe/it, beforeEach |
| 04 | Mocking et test doubles | 3h | **Cours cle** -- mocks, stubs, spies, fakes |
| 05 | Tests asynchrones | 3h | Promises, timers, event-based code |

**Exercices Phase 1** : Ecris un test AVANT de lire la correction. Meme si ton test est mauvais,
l'acte d'ecrire est plus formateur que de lire.

**Checkpoint Phase 1** :
- [ ] Tu sais structurer un test avec Arrange/Act/Assert
- [ ] Tu sais choisir entre mock, stub, spy et fake selon le cas
- [ ] Tu sais tester une fonction async (avec `await` et assertions)
- [ ] Tu sais utiliser `vi.fn()`, `vi.spyOn()` et `vi.mock()` dans Vitest
- [ ] Tu peux expliquer la pyramide de tests et pourquoi elle a cette forme

> **Test** : Un collegue ecrit un test qui mocke TOUT sauf la fonction testee.
> Si tu vois le probleme (test fragile, couple a l'implementation), c'est bon.

---

### Phase 2 -- Tests applicatifs (modules 06-09) ~30-35h

> **Objectif** : Tester des composants, des APIs, et des integrations.
> Tu passes de "je teste des fonctions" a "je teste une application".
>
> **Analogie** : Tu quittes le parking et tu roules en ville. Plus de variables, plus de contexte.

| Module | Sujet | Temps | Note |
|---|---|---|---|
| 06 | Architecture testable | 3h | **Cours cle** -- injection de dependances, separation des concerns |
| 07 | Tests de composants | 4h | Testing Library, rendu, interactions utilisateur |
| 08 | MSW (Mock Service Worker) | 3h | Mocker les APIs reseau proprement |
| 09 | Tests d'integration | 4h | Tester plusieurs modules ensemble |

**Conseil** : Le module 06 (architecture testable) est le plus important de la Phase 2.
Si ton code est difficile a tester, le probleme n'est pas dans tes tests mais dans ton code.
Ce module change ta facon de concevoir.

**Checkpoint Phase 2** :
- [ ] Tu sais ecrire un test de composant avec Testing Library (queries, events, assertions)
- [ ] Tu sais utiliser MSW pour intercepter les appels reseau dans les tests
- [ ] Tu sais ecrire un test d'integration qui couvre un flux utilisateur complet
- [ ] Tu sais refactorer du code pour le rendre testable (injection, inversion de dependances)
- [ ] Tu sais quand ecrire un test unitaire vs un test d'integration

> **Test** : Tu dois tester un formulaire qui appelle une API. Comment fais-tu ?
> Si tu proposes "Testing Library pour le rendu + MSW pour l'API + assertion sur le resultat affiche", c'est bon.

---

### Phase 3 -- E2E et CI (modules 10-14) ~30-40h

> **Objectif** : Maitriser Playwright pour les tests E2E, la couverture de code,
> l'integration en CI/CD, et le debugging des tests instables.
>
> **Analogie** : Tu roules sur autoroute. Les enjeux sont plus eleves, les outils plus puissants.

| Module | Sujet | Temps | Note |
|---|---|---|---|
| 10 | Playwright fondamentaux | 4h | Selectors, actions, assertions, trace viewer |
| 11 | Playwright avance | 4h | Page objects, fixtures, multi-navigateurs |
| 12 | Couverture et mutation testing | 3h | **Cours cle** -- la couverture ment, le mutation testing non |
| 12b | Tests d'accessibilite | 2h | axe-core, ARIA, conformite automatisee |
| 13 | Tests en CI/CD | 3h | GitHub Actions, parallelisation, artefacts |
| 14 | Flaky tests et debugging | 3h | **Cours cle** -- diagnostiquer et eliminer les tests instables |

**Attention** : Les tests E2E sont plus lents et plus fragiles que les tests unitaires.
C'est normal. Le module 14 (flaky tests) t'apprend a gerer ca.

**Checkpoint Phase 3** :
- [ ] Tu sais ecrire un test Playwright de bout en bout (navigation, formulaire, assertion)
- [ ] Tu sais utiliser le Trace Viewer de Playwright pour debugger un test qui echoue
- [ ] Tu sais interpreter un rapport de couverture ET ses limites
- [ ] Tu sais configurer une pipeline CI qui execute les tests automatiquement
- [ ] Tu sais diagnostiquer un flaky test (timing, state leak, dependance externe)

> **Test** : Un test E2E passe en local mais echoue en CI une fois sur trois.
> Si tu penses a : timing (attendre le bon element), etat partage, resolution d'ecran, seeds de donnees -- c'est bon.

---

### Phase 4 -- Expert (modules 15-18) ~30-40h

> **Objectif** : TDD/BDD, contract testing, performance testing, et un projet final
> qui consolide l'ensemble de la strategie de test.
>
> **Analogie** : Tu ne conduis plus -- tu concois les routes et les regles de circulation.

| Module | Sujet | Temps | Note |
|---|---|---|---|
| 15 | TDD et BDD | 3h | Red-Green-Refactor, Gherkin, quand ca vaut le coup |
| 16 | Contract testing | 3h | Pact, tests de contrat entre services |
| 17 | Performance testing | 3h | k6, benchmarks, tests de charge |
| 18 | Projet final | 8h+ | Strategie de test complete pour une application reelle |

**Checkpoint Phase 4** :
- [ ] Tu sais pratiquer le TDD (Red-Green-Refactor) sur un cas concret
- [ ] Tu sais mettre en place un contract test entre un frontend et une API
- [ ] Tu sais ecrire un test de performance avec k6 et interpreter les resultats
- [ ] Tu sais concevoir une strategie de test pour un projet (pyramide, budget, priorites)
- [ ] Tu as termine le projet final avec une couverture raisonnee (pas maximale)

> **Test** : Un PM te demande "on a combien de % de couverture ?". Que reponds-tu ?
> Si tu expliques que le pourcentage seul ne veut rien dire et que tu parles de mutation testing,
> de tests critiques, et de risques couverts -- tu es expert.

---

## Quand tu bloques

Les tests ont leurs propres frustrations. Voici comment debloquer :

### "Mon test passe en isolation mais echoue avec les autres"
1. Cherche un etat partage : variable globale, base de donnees, fichier, state du module
2. Verifie que chaque test a son propre setup (`beforeEach`) et cleanup (`afterEach`)
3. Lance le test seul avec `vitest run montest.spec.ts` pour confirmer l'isolation

### "Je ne sais pas quoi mocker"
1. Regle d'or : mocke ce qui est lent, non-deterministe, ou hors de ton controle (API, BDD, horloge, random)
2. Ne mocke PAS la logique que tu testes -- sinon tu testes tes mocks
3. Prefere l'injection de dependances au monkey-patching

### "Mon test E2E est flaky (instable)"
1. Ajoute des `await expect(locator).toBeVisible()` avant les interactions
2. N'utilise JAMAIS `page.waitForTimeout(1000)` -- utilise des conditions explicites
3. Isole les donnees de test (chaque test cree ses propres donnees)
4. Utilise le Trace Viewer de Playwright pour voir exactement ce qui s'est passe

### "La couverture est haute mais j'ai quand meme des bugs"
1. La couverture mesure les lignes executees, pas les cas testes
2. Essaie le mutation testing (module 12) -- il detecte les assertions manquantes
3. Concentre-toi sur les tests de comportement, pas sur les tests de lignes

### "TDD me ralentit"
1. C'est normal au debut. Le gain vient avec la pratique (~2-3 semaines)
2. Commence par des fonctions pures simples. Ne fais pas de TDD sur de l'UI au debut
3. Le "Red" doit prendre 30 secondes. Si ca prend plus, ton pas est trop grand

### "Je n'arrive pas a faire l'exercice"
1. Ecris d'abord le test le plus simple possible (cas nominal)
2. Puis ajoute les cas limites un par un
3. Regarde les 3 premiers indices de la correction, pas la solution complete

---

## Auto-evaluation par phase

Apres chaque phase, pose-toi ces questions. Si tu ne sais pas repondre,
reviens en arriere -- c'est un signe, pas un echec.

**Apres Phase 1** : "Quelle est la difference entre un mock et un stub ?"
-> Si tu reponds qu'un stub remplace une valeur de retour et qu'un mock verifie qu'un appel a eu lieu, c'est bon.

**Apres Phase 2** : "Pourquoi tester avec Testing Library plutot qu'en accedant au DOM directement ?"
-> Si tu parles de tester le comportement utilisateur plutot que l'implementation, c'est bon.

**Apres Phase 3** : "Un test passe en local mais echoue en CI. Par ou commences-tu ?"
-> Si tu verifies : environnement, timing, donnees, parallelisme, et tu utilises le trace viewer, c'est bon.

**Apres Phase 4** : "Combien de tests faut-il pour un projet ?"
-> Si tu reponds "ca depend du risque" et que tu concois une strategie adaptee au contexte, c'est bon.

---

## Rythme recommande

| Rythme | Par semaine | Duree totale |
|---|---|---|
| **Decouverte** (a cote du boulot) | 4-6h | 5-6 mois |
| **Regulier** (motivation) | 8-10h | 3-4 mois |
| **Intensif** (objectif pro) | 12-15h | 2-3 mois |

### Conseils concrets

- **1 module = 1 a 2 sessions.** Les modules pratiques (03, 07, 10) prennent plus longtemps.
- **Ecris tes tests en parallele d'un vrai projet.** C'est la meilleure facon d'ancrer les concepts.
- **Le mocking (04) et l'architecture testable (06) meritent une semaine chacun.** Ce sont les fondations.
- **Le projet final (18) vaut 2 semaines.** C'est la que tu concois une vraie strategie de test.
- **Mieux vaut un test bien ecrit par jour que 10 tests bacles le weekend.**

### Quand faire une pause

- Si tu ecris des tests par obligation sans comprendre pourquoi -> relis le module 01
- Si tes tests sont plus complexes que ton code -> simplifie, le test doit rester lisible
- Si un flaky test te rend fou -> passe au module suivant, reviens-y avec un oeil frais

---

## Ressources complementaires

### Quand tu veux approfondir
- [Testing Library Docs](https://testing-library.com/) -- la reference pour le testing de composants
- [Playwright Docs](https://playwright.dev/) -- documentation officielle, excellente
- [Kent C. Dodds -- Testing JavaScript](https://testingjavascript.com/) -- cours video de reference
- *Working Effectively with Legacy Code* (Michael Feathers) -- pour tester du code existant

### Quand tu cherches une reponse rapide
- `vitest --reporter=verbose` -- pour voir le detail de chaque test
- `npx playwright test --ui` -- interface graphique pour debugger les tests E2E
- `npx vitest --coverage` -- rapport de couverture instantane

---

## Et apres ?

Tu as fini les 19 modules ? Tu sais tester comme un professionnel.

Voici les prochaines etapes :
1. **Ajoute des tests a un vrai projet** -- le meilleur entrainement est sur du code existant
2. **Explore le contract testing en microservices** -- combine avec le cours Distributed Systems (11)
3. **Mets en place une CI complete** -- combine avec le cours Observability (12)
4. **Enseigne le testing a ton equipe** -- expliquer, c'est maitriser
