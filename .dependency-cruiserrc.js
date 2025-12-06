/**
 * AI-COS v2.31.0: Dependency Cruiser Configuration
 * 
 * Règles de validation des dépendances pour le monorepo.
 * Configuration utilisée par l'Agent Cartographe pour:
 * - Détecter les dépendances circulaires
 * - Valider les imports inter-packages
 * - Enforcer les règles d'architecture
 * 
 * @see https://github.com/sverweij/dependency-cruiser
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 1: Pas de dépendances circulaires
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Les dépendances circulaires causent des problèmes de build et de maintenance',
      from: {},
      to: {
        circular: true,
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 2: Frontend ne doit pas importer Backend
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'no-frontend-to-backend',
      severity: 'error',
      comment: 'Le frontend ne doit jamais importer directement depuis le backend - utiliser les types partagés',
      from: {
        path: '^frontend/',
      },
      to: {
        path: '^backend/src/',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 3: Backend ne doit pas importer Frontend
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'no-backend-to-frontend',
      severity: 'error',
      comment: 'Le backend ne doit jamais importer depuis le frontend',
      from: {
        path: '^backend/',
      },
      to: {
        path: '^frontend/',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 4: UI ne peut importer que depuis design-tokens et patterns
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'ui-restricted-imports',
      severity: 'warn',
      comment: 'Le package UI ne peut dépendre que de design-tokens, patterns et shared-types',
      from: {
        path: '^packages/ui/',
      },
      to: {
        path: '^(frontend|backend)/',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 5: Design-tokens est une feuille (pas de deps internes)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'design-tokens-leaf',
      severity: 'warn',
      comment: 'design-tokens ne doit dépendre d\'aucun autre package interne',
      from: {
        path: '^packages/design-tokens/',
      },
      to: {
        path: '^packages/(?!design-tokens)',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 6: shared-types est une feuille
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'shared-types-leaf',
      severity: 'error',
      comment: 'shared-types ne doit dépendre d\'aucun autre package (risque de circular)',
      from: {
        path: '^packages/shared-types/',
      },
      to: {
        path: '^(packages/(?!shared-types)|frontend|backend)/',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 7: Pas d'imports relatifs hors du package
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'no-relative-packages',
      severity: 'error',
      comment: 'Utiliser les imports de packages (@monorepo/*) pas les chemins relatifs',
      from: {
        path: '^packages/',
      },
      to: {
        path: '^\\.\\./',
        pathNot: '^\\.\\./(src|lib|dist)/',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 8: Pas de dépendances vers node_modules non déclarées
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'no-unlisted-deps',
      severity: 'error',
      comment: 'Toutes les dépendances doivent être déclarées dans package.json',
      from: {},
      to: {
        dependencyTypes: ['npm-no-pkg', 'npm-unknown'],
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 9: Pas d'imports de fichiers de test en production
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'no-test-in-prod',
      severity: 'error',
      comment: 'Les fichiers de test ne doivent pas être importés dans le code de production',
      from: {
        pathNot: '\\.(spec|test|e2e-spec)\\.(ts|tsx|js|jsx)$',
      },
      to: {
        path: '\\.(spec|test|e2e-spec)\\.(ts|tsx|js|jsx)$',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 10: Pas d'imports de .env ou fichiers de config sensibles
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'no-config-imports',
      severity: 'error',
      comment: 'Ne pas importer directement les fichiers de configuration',
      from: {},
      to: {
        path: '\\.(env|env\\..*|config\\.(local|prod|dev))$',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 11: Themes ne doivent importer que design-tokens
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'themes-only-design-tokens',
      severity: 'warn',
      comment: 'Les thèmes (theme-admin, theme-vitrine) ne peuvent dépendre que de design-tokens',
      from: {
        path: '^packages/theme-(admin|vitrine)/',
      },
      to: {
        path: '^packages/(?!design-tokens|theme-)/',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 12: Prisma uniquement dans backend
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'prisma-backend-only',
      severity: 'error',
      comment: 'Prisma client ne doit être utilisé que dans le backend',
      from: {
        path: '^(frontend|packages)/',
      },
      to: {
        path: '@prisma/client|backend/prisma',
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // RÈGLE 13: Supabase client côté serveur uniquement
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'supabase-server-imports',
      severity: 'warn',
      comment: 'Le client Supabase admin ne doit pas être importé côté client',
      from: {
        path: '^frontend/app/(?!.+\\.server).*$',
      },
      to: {
        path: '@supabase/supabase-js',
        dependencyTypes: ['npm'],
      },
    },
  ],

  options: {
    // ═══════════════════════════════════════════════════════════════════
    // Configuration générale
    // ═══════════════════════════════════════════════════════════════════
    doNotFollow: {
      path: [
        'node_modules',
        'dist',
        'build',
        '.turbo',
        'coverage',
        '.next',
        '.cache',
      ],
    },

    exclude: {
      path: [
        '\\.d\\.ts$',
        '\\.test\\.',
        '\\.spec\\.',
        '\\.e2e-spec\\.',
        '__tests__',
        '__mocks__',
        'jest\\.config',
        'vite\\.config',
        'vitest\\.config',
        'playwright\\.config',
      ],
    },

    includeOnly: {
      path: [
        '^packages/',
        '^backend/src/',
        '^frontend/app/',
      ],
    },

    // ═══════════════════════════════════════════════════════════════════
    // Configuration TypeScript
    // ═══════════════════════════════════════════════════════════════════
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },

    // ═══════════════════════════════════════════════════════════════════
    // Configuration des modules
    // ═══════════════════════════════════════════════════════════════════
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },

    // ═══════════════════════════════════════════════════════════════════
    // Configuration du cache
    // ═══════════════════════════════════════════════════════════════════
    cache: {
      folder: 'node_modules/.cache/dependency-cruiser',
      strategy: 'content',
    },

    // ═══════════════════════════════════════════════════════════════════
    // Configuration des rapports
    // ═══════════════════════════════════════════════════════════════════
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)',
        theme: {
          graph: {
            splines: 'ortho',
            rankdir: 'TB',
            ranksep: '1',
          },
          modules: [
            {
              criteria: { source: '^packages/ui' },
              attributes: { fillcolor: '#e1f5fe', style: 'filled' },
            },
            {
              criteria: { source: '^packages/design-tokens' },
              attributes: { fillcolor: '#fff3e0', style: 'filled' },
            },
            {
              criteria: { source: '^packages/shared-types' },
              attributes: { fillcolor: '#e8f5e9', style: 'filled' },
            },
            {
              criteria: { source: '^backend' },
              attributes: { fillcolor: '#fce4ec', style: 'filled' },
            },
            {
              criteria: { source: '^frontend' },
              attributes: { fillcolor: '#f3e5f5', style: 'filled' },
            },
          ],
          dependencies: [
            {
              criteria: { circular: true },
              attributes: { color: '#ff0000', penwidth: '2', style: 'bold' },
            },
            {
              criteria: { valid: false },
              attributes: { color: '#ff6600', style: 'dashed' },
            },
          ],
        },
      },
      archi: {
        collapsePattern: '^(packages|backend|frontend)/[^/]+',
        theme: {
          graph: {
            splines: 'ortho',
            rankdir: 'TB',
          },
        },
      },
      json: {
        // Output all info for the cartographer agent
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // Progression tracking
    // ═══════════════════════════════════════════════════════════════════
    progress: { type: 'performance-log' },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Custom Rules Export pour utilisation programmatique
// ═══════════════════════════════════════════════════════════════════════════
module.exports.RULE_NAMES = {
  NO_CIRCULAR: 'no-circular',
  NO_FRONTEND_TO_BACKEND: 'no-frontend-to-backend',
  NO_BACKEND_TO_FRONTEND: 'no-backend-to-frontend',
  UI_RESTRICTED: 'ui-restricted-imports',
  DESIGN_TOKENS_LEAF: 'design-tokens-leaf',
  SHARED_TYPES_LEAF: 'shared-types-leaf',
  NO_RELATIVE_PACKAGES: 'no-relative-packages',
  NO_UNLISTED_DEPS: 'no-unlisted-deps',
  NO_TEST_IN_PROD: 'no-test-in-prod',
  THEMES_ONLY_TOKENS: 'themes-only-design-tokens',
  PRISMA_BACKEND_ONLY: 'prisma-backend-only',
};

module.exports.SEVERITY_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
};
