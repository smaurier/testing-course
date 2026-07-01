import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Testing Course',
  description:
    'Formation complete Testing : tests unitaires, composants, integration, E2E, mocking, CI/CD, TDD, contract testing (debutant a expert)',
  lang: 'fr-FR',
  srcDir: '.',
  ignoreDeadLinks: true,

  // Docs statiques : on neutralise l'interpolation Vue `{{ }}` (délimiteurs improbables)
  // pour que les moustaches de démonstration en prose ET les expressions GitHub Actions
  // `${{ ... }}` dans les blocs YAML ne cassent pas le build SSR VitePress.
  vue: {
    template: {
      compilerOptions: {
        delimiters: ['(%(', ')%)'],
      },
    },
  },

  themeConfig: {
    nav: [
      { text: 'Modules', link: '/modules/00-prerequis-et-introduction' },
      { text: 'Labs', link: '/labs/lab-01-pourquoi-tester/README' },
      { text: 'Quizzes', link: '/quizzes/quiz-00-prerequis.html' },
      { text: 'Visualisations', link: '/visualizations/test-pyramid.html' },
      { text: 'Glossaire', link: '/glossaire' },
    ],

    sidebar: {
      '/modules/': [
        {
          text: 'Phase 1 - Fondamentaux',
          collapsed: false,
          items: [
            { text: '00 - Prerequis et introduction', link: '/modules/00-prerequis-et-introduction' },
            { text: '01 - Pourquoi tester', link: '/modules/01-pourquoi-tester' },
            { text: '02 - Anatomie d\'un test', link: '/modules/02-anatomie-dun-test' },
          ],
        },
        {
          text: 'Phase 2 - Outils essentiels',
          collapsed: false,
          items: [
            { text: '03 - Vitest fondamentaux', link: '/modules/03-vitest-fondamentaux' },
            { text: '04 - Mocking et test doubles', link: '/modules/04-mocking-et-test-doubles' },
            { text: '05 - Tests asynchrones', link: '/modules/05-tests-asynchrones' },
          ],
        },
        {
          text: 'Phase 3 - Testing applicatif',
          collapsed: false,
          items: [
            { text: '06 - Architecture testable', link: '/modules/06-architecture-testable' },
            { text: '07 - Tests de composants', link: '/modules/07-tests-de-composants' },
            { text: '08 - MSW Mock Service Worker', link: '/modules/08-msw-mock-service-worker' },
            { text: '09 - Tests d\'integration', link: '/modules/09-tests-integration' },
          ],
        },
        {
          text: 'Phase 4 - E2E et CI',
          collapsed: false,
          items: [
            { text: '10 - Playwright fondamentaux', link: '/modules/10-playwright-fondamentaux' },
            { text: '11 - Playwright avance', link: '/modules/11-playwright-avance' },
            { text: '12 - Couverture et mutation testing', link: '/modules/12-couverture-et-mutation-testing' },
            { text: '13 - Tests en CI/CD', link: '/modules/13-tests-en-ci-cd' },
          ],
        },
        {
          text: 'Phase 5 - Expert',
          collapsed: false,
          items: [
            { text: '14 - Flaky tests et debugging', link: '/modules/14-flaky-tests-et-debugging' },
            { text: '15 - TDD et BDD', link: '/modules/15-tdd-et-bdd' },
            { text: '16 - Contract testing', link: '/modules/16-contract-testing' },
            { text: '17 - Performance testing', link: '/modules/17-performance-testing' },
            { text: '18 - Projet final', link: '/modules/18-projet-final' },
          ],
        },
      ],

      '/labs/': [
        {
          text: 'Phase 1 - Fondamentaux',
          collapsed: false,
          items: [
            { text: 'Lab 01 - Pourquoi tester', link: '/labs/lab-01-pourquoi-tester/README' },
            { text: 'Lab 02 - Anatomie d\'un test', link: '/labs/lab-02-anatomie-dun-test/README' },
          ],
        },
        {
          text: 'Phase 2 - Outils essentiels',
          collapsed: false,
          items: [
            { text: 'Lab 03 - Vitest fondamentaux', link: '/labs/lab-03-vitest-fondamentaux/README' },
            { text: 'Lab 04 - Mocking', link: '/labs/lab-04-mocking/README' },
            { text: 'Lab 05 - Tests asynchrones', link: '/labs/lab-05-tests-asynchrones/README' },
          ],
        },
        {
          text: 'Phase 3 - Testing applicatif',
          collapsed: false,
          items: [
            { text: 'Lab 06 - Architecture testable', link: '/labs/lab-06-architecture-testable/README' },
            { text: 'Lab 07 - Tests composants', link: '/labs/lab-07-tests-composants/README' },
            { text: 'Lab 08 - MSW', link: '/labs/lab-08-msw/README' },
            { text: 'Lab 09 - Tests integration', link: '/labs/lab-09-tests-integration/README' },
          ],
        },
        {
          text: 'Phase 4 - E2E et CI',
          collapsed: false,
          items: [
            { text: 'Lab 10 - Playwright fondamentaux', link: '/labs/lab-10-playwright-fondamentaux/README' },
            { text: 'Lab 11 - Playwright avance', link: '/labs/lab-11-playwright-avance/README' },
            { text: 'Lab 12 - Couverture', link: '/labs/lab-12-couverture/README' },
            { text: 'Lab 13 - CI/CD', link: '/labs/lab-13-ci-cd/README' },
          ],
        },
        {
          text: 'Phase 5 - Expert',
          collapsed: false,
          items: [
            { text: 'Lab 14 - Flaky tests', link: '/labs/lab-14-flaky-tests/README' },
            { text: 'Lab 15 - TDD et BDD', link: '/labs/lab-15-tdd-bdd/README' },
            { text: 'Lab 16 - Contract testing', link: '/labs/lab-16-contract-testing/README' },
            { text: 'Lab 17 - Performance', link: '/labs/lab-17-performance/README' },
            { text: 'Lab 18 - Projet final', link: '/labs/lab-18-projet-final/README' },
          ],
        },
      ],

      '/quizzes/': [
        {
          text: 'Quizzes',
          collapsed: false,
          items: [
            { text: 'Quiz 00 - Prerequis', link: '/quizzes/quiz-00-prerequis.html' },
            { text: 'Quiz 01 - Pourquoi tester', link: '/quizzes/quiz-01-pourquoi-tester.html' },
            { text: 'Quiz 02 - Anatomie', link: '/quizzes/quiz-02-anatomie.html' },
            { text: 'Quiz 03 - Vitest', link: '/quizzes/quiz-03-vitest.html' },
            { text: 'Quiz 04 - Mocking', link: '/quizzes/quiz-04-mocking.html' },
            { text: 'Quiz 05 - Async', link: '/quizzes/quiz-05-async.html' },
            { text: 'Quiz 06 - Architecture', link: '/quizzes/quiz-06-architecture.html' },
            { text: 'Quiz 07 - Composants', link: '/quizzes/quiz-07-composants.html' },
            { text: 'Quiz 08 - MSW', link: '/quizzes/quiz-08-msw.html' },
            { text: 'Quiz 09 - Integration', link: '/quizzes/quiz-09-integration.html' },
            { text: 'Quiz 10 - Playwright', link: '/quizzes/quiz-10-playwright.html' },
            { text: 'Quiz 11 - Playwright avance', link: '/quizzes/quiz-11-playwright-avance.html' },
            { text: 'Quiz 12 - Couverture', link: '/quizzes/quiz-12-couverture.html' },
            { text: 'Quiz 13 - CI/CD', link: '/quizzes/quiz-13-ci-cd.html' },
            { text: 'Quiz 14 - Flaky tests', link: '/quizzes/quiz-14-flaky.html' },
            { text: 'Quiz 15 - TDD/BDD', link: '/quizzes/quiz-15-tdd-bdd.html' },
            { text: 'Quiz 16 - Contract testing', link: '/quizzes/quiz-16-contract.html' },
            { text: 'Quiz 17 - Performance', link: '/quizzes/quiz-17-performance.html' },
            { text: 'Quiz 18 - Projet final', link: '/quizzes/quiz-18-projet-final.html' },
          ],
        },
      ],

      '/visualizations/': [
        {
          text: 'Visualisations',
          collapsed: false,
          items: [
            { text: 'Pyramide de tests', link: '/visualizations/test-pyramid.html' },
            { text: 'Cycle TDD', link: '/visualizations/tdd-cycle.html' },
            { text: 'Pipeline CI/CD', link: '/visualizations/ci-pipeline.html' },
            { text: 'Page Object Pattern', link: '/visualizations/page-object.html' },
            { text: 'Strategies de mocking', link: '/visualizations/mocking-strategies.html' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
    },

    outline: {
      level: [2, 3],
      label: 'Sur cette page',
    },

    docFooter: {
      prev: 'Page precedente',
      next: 'Page suivante',
    },
  },
});
