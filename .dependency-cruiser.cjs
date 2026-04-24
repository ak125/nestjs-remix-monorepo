/**
 * dependency-cruiser config for AutoMecanik monorepo
 * Starts permissive: hard errors on obvious wrongs, warnings on architectural
 * concerns so the pre-commit hook never blocks day 1.
 * Tighten severity as cleanup Phase 1 progresses.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      comment:
        'Circular dependencies make code hard to reason about and break tree-shaking.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'Files without dependents are either dead code or missing an entry point.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts|json)$',
        ],
      },
      to: {},
    },
    {
      name: 'not-to-deprecated',
      severity: 'warn',
      comment: 'Imported module is deprecated.',
      from: {},
      to: { dependencyTypes: ['deprecated'] },
    },
    {
      name: 'frontend-not-to-backend-src',
      severity: 'warn',
      comment:
        'Frontend must go through HTTP/API, never reach into backend source directly. Promote to error after Phase 1 cleanup.',
      from: { path: '^frontend/app/' },
      to: { path: '^backend/src/' },
    },
    {
      name: 'backend-not-to-frontend',
      severity: 'warn',
      comment:
        'Backend must not reach into frontend source (coupling + bundling disaster). Promote to error after Phase 1 cleanup.',
      from: { path: '^backend/src/' },
      to: { path: '^frontend/app/' },
    },
    {
      name: 'no-deep-module-access',
      severity: 'warn',
      comment:
        'Modules should depend on each other via public barrels, not reach inside. Tighten to error after Phase 1.',
      from: {
        path: '^backend/src/modules/([^/]+)/',
        pathNot: '^backend/src/modules/([^/]+)/.*\\.spec\\.ts$',
      },
      to: {
        path: '^backend/src/modules/([^/]+)/.+',
        pathNot: [
          '^backend/src/modules/$1/',
          '^backend/src/modules/[^/]+/index\\.ts$',
          '^backend/src/modules/[^/]+/[^/]+\\.module\\.ts$',
        ],
      },
    },
    {
      name: 'not-to-test',
      severity: 'warn',
      comment: 'Production code should not import tests. Promote to error after Phase 1 cleanup.',
      from: {
        pathNot: [
          '\\.(spec|test|e2e-spec)\\.(js|mjs|cjs|ts|ls|coffee|litcoffee|coffee\\.md)$',
        ],
      },
      to: {
        path: '\\.(spec|test|e2e-spec)\\.(js|mjs|cjs|ts|ls|coffee|litcoffee|coffee\\.md)$',
      },
    },
    {
      name: 'not-to-spec',
      severity: 'warn',
      comment: 'No imports from documentation folder. Promote to error after Phase 1 cleanup.',
      from: {},
      to: { path: '^\\.spec/' },
    },
    {
      name: 'no-non-package-json',
      severity: 'warn',
      comment:
        'Only allow deps declared in package.json (prevents phantom deps). Promote to error after Phase 1 cleanup.',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
  ],
  options: {
    doNotFollow: {
      path: [
        'node_modules',
        'dist',
        'build',
        '\\.cache',
        '\\.turbo',
        'coverage',
        '\\.next',
        'public/build',
      ],
    },
    exclude: {
      path: [
        '\\.spec/',
        'audit-monorepo/',
        '99-meta/',
        'output/',
        'gates/',
        '\\.local/',
        '\\.codex',
        'rm/',
        '\\.spec\\.ts$',
        '\\.e2e-spec\\.ts$',
      ],
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
