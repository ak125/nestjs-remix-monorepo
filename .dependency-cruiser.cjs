/**
 * dependency-cruiser config for AutoMecanik monorepo
 *
 * Phase 1 partial (2026-05-01) — 5 rules promoted from warn to error after
 * audit confirmed zero existing violations on each :
 *   - not-to-deprecated
 *   - frontend-not-to-backend-src
 *   - backend-not-to-frontend
 *   - not-to-test
 *   - not-to-spec
 *
 * Rules with existing technical debt remain warn until cleanup :
 *   - no-circular         (41 violations, Phase 2)
 *   - no-orphans          (48 violations, Phase 2)
 *   - no-deep-module-access (77 violations, Phase 2)
 *   - no-non-package-json (3 violations, Phase 1 bis after allowlist)
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
      severity: 'error',
      comment: 'Imported module is deprecated. Promoted to error 2026-05-01 (Phase 1, 0 violations).',
      from: {},
      to: { dependencyTypes: ['deprecated'] },
    },
    {
      name: 'frontend-not-to-backend-src',
      severity: 'error',
      comment:
        'Frontend must go through HTTP/API, never reach into backend source directly. Promoted to error 2026-05-01 (Phase 1, 0 violations).',
      from: { path: '^frontend/app/' },
      to: { path: '^backend/src/' },
    },
    {
      name: 'backend-not-to-frontend',
      severity: 'error',
      comment:
        'Backend must not reach into frontend source (coupling + bundling disaster). Promoted to error 2026-05-01 (Phase 1, 0 violations).',
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
      severity: 'error',
      comment: 'Production code should not import tests. Promoted to error 2026-05-01 (Phase 1, 0 violations).',
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
      severity: 'error',
      comment: 'No imports from documentation folder. Promoted to error 2026-05-01 (Phase 1, 0 violations).',
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
