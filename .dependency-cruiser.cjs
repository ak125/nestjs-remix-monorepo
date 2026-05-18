/**
 * dependency-cruiser config for AutoMecanik monorepo
 *
 * Phase 1 (2026-05-01, PR #260) — 5 rules promoted from warn to error after
 * audit confirmed zero existing violations on each :
 *   - not-to-deprecated
 *   - frontend-not-to-backend-src
 *   - backend-not-to-frontend
 *   - not-to-test
 *   - not-to-spec
 *
 * Phase 1 bis (2026-05-01) — no-non-package-json promoted to error after the
 * 3 phantom deps (file-type, @radix-ui/react-collapsible, cookie) were
 * properly declared in backend/package.json and frontend/package.json.
 * Anti-bricolage : the violations were real bugs (transitive accidents),
 * not legitimate exceptions — fixed root cause instead of adding allowlist.
 *
 * Rules with existing technical debt remain warn until cleanup :
 *   - no-circular         (41 violations, Phase 2)
 *   - no-orphans          (48 violations, Phase 2)
 *   - no-deep-module-access (77 violations, Phase 2)
 */
// Architecture contract — generated rules (PR-2).
// File is committed but recreated by `npm run architecture:build`. On a fresh clone
// before that command runs, fall back to an empty list rather than crashing depcruise.
let generatedRules = [];
try {
  generatedRules = require('./.dependency-cruiser.generated.cjs');
} catch (e) {
  if (e && e.code === 'MODULE_NOT_FOUND') {
    process.emitWarning(
      '.dependency-cruiser.generated.cjs missing — run `npm run architecture:build`. ' +
        'Continuing with inline rules only (architectural boundaries not enforced).',
      {
        code: 'ARCHITECTURE_ARTIFACT_MISSING',
        detail: 'See PR-2 / ADR-058 for the regen workflow.',
      },
    );
  } else {
    throw e;
  }
}

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── Architectural invariants (generated from .spec/00-canon/repository-registry/architecture.yaml) ──
    ...generatedRules,

    // ── NON-ARCHITECTURAL HYGIENE RULES ──
    // These are repo hygiene / tech-debt rules — NOT architectural invariants.
    // They MUST NOT be moved into architecture.yaml. Each owns a different invariant kind:
    //   - no-circular / no-orphans : module graph health (debt/ratchet)
    //   - not-to-deprecated         : dependency hygiene
    //   - no-deep-module-access     : barrel/index discipline
    //   - not-to-test / not-to-spec : production-code isolation
    //   - no-non-package-json       : phantom-dep integrity
    // If a future hygiene rule grows architectural meaning, open an ADR — do not silently
    // migrate it. The contract carries ONE invariant kind; hygiene stays inline.
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
      severity: 'error',
      comment:
        'Only allow deps declared in package.json (prevents phantom deps). Promoted to error 2026-05-01 (Phase 1 bis, after fixing 3 transitive accidents : file-type, @radix-ui/react-collapsible, cookie).',
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
