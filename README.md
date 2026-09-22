# Testing — Du test unitaire au contract testing

![VitePress](https://img.shields.io/badge/-VitePress-646CFF?style=flat-square&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
[![fullstack-autotraining](https://img.shields.io/badge/curriculum-fullstack--autotraining-4C1?style=flat-square)](https://github.com/smaurier/fullstack-autotraining)

<!-- labs-gestes:start -->
## Labs — refonte du 22/09/2026 : un lab = un geste métier complet

> Règle qualité 5 du parcours : chaque lab est **un geste métier complet**, sous deux formes — **Zéro** (construire de zéro un artefact réel et entier) ou **Intervention** (modifier de l'existant avec consommateurs, findings avant code, non-régression). Un lab n'entre en file qu'avec un **oracle exécutable** (`src/` starter · `test/` · `solution/` séparée). Les labs historiques de ce cours (un concept par lab, sans oracle) restent dans `labs/` jusqu'à remplacement et **ne sont plus la file**. Cible détaillée : [`docs/gestes-complets.md`](../docs/gestes-complets.md). État : **0/6 avec oracle**.

| # | Lab | Forme | Geste | Oracle |
|---|-----|-------|-------|--------|
| 01 | `lab-01-module-metier-tdd` | Zéro | invitation familiale en TDD strict, doubles, contrat, de A à Z | · à écrire |
| 02 | `lab-02-pyramide-reelle` | Zéro | unit → intégration → E2E Playwright sur un écran réel | · à écrire |
| 03 | `lab-03-caracteriser-du-legacy` | Intervention | golden master sur du code sans tests, puis refactor sous filet | · à écrire |
| 04 | `lab-04-reparer-une-suite-flaky` | Intervention | diagnostiquer et stabiliser des tests intermittents | · à écrire |
| 05 | `lab-05-relire-une-pr-de-tests` | Intervention | findings avant vérité sur une PR de tests | · à écrire |
| 06 | `lab-06-tests-de-contrat` | Zéro | contrat front/API testé des deux côtés | · à écrire |

<!-- labs-gestes:end -->

## Lancer le cours

```bash
npm install          # une seule fois
npm run docs:dev     # ouvre http://localhost:5173
```

Le site s'ouvre avec une sidebar navigable. Commence par le premier module (00).

## Structure

```
04-testing/
├── modules/          ← Cours théoriques (00, 01, 02...)
├── labs/             ← Exercices pratiques (exercise.ts → solution.ts)
├── quizzes/          ← Quiz interactifs (.html)
├── screencasts/      ← Scripts de screencasts
├── visualizations/   ← Visualisations interactives
├── glossaire.md      ← Termes clés
└── index.md          ← Page d'accueil VitePress
```

## Parcours

Consulte `cours/parcours.md` ou ouvre le site VitePress pour le plan de formation détaillé.
