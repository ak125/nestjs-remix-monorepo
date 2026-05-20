module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'fafa-ports'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    // Bloquer tout console.log/error — utiliser NestJS Logger
    'no-console': ['error', { allow: ['warn'] }],

    // ============================================
    // P1.3 - Import Firewall (2026-02-02)
    // Empêche les imports apps -> tools
    // Voir docs/MIGRATION_PLAN_DEV_PREPROD_PROD.md
    // ============================================
    // NOTE: RmModule restriction removed (2026-02-02)
    // - P4.2 fixed Dockerfile to copy packages/shared-types
    // - RmModule is now safe to use in production
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@repo/ai-orchestrator', '@repo/ai-orchestrator/**'],
            message:
              '⛔ ai-orchestrator est DEV ONLY. Voir docs/MIGRATION_PLAN_DEV_PREPROD_PROD.md',
          },
          {
            group: ['@repo/contracts', '@repo/contracts/**'],
            message:
              '⛔ contracts est DEV ONLY. Voir docs/MIGRATION_PLAN_DEV_PREPROD_PROD.md',
          },
        ],
      },
    ],

    // ============================================
    // PR-3a phase 3a (warning) — legacy SEO role literals in OUTPUT context
    // ============================================
    // Complementary to ast-grep `seo-no-bare-role-literal.yml` which catches
    // bare R3/R6/R9/R3_GUIDE across all langs. ESLint here catches *suffixed*
    // legacy forms in TS files only. Together they form the union coverage
    // tested by __regression__/seo-role-canon-guard.test.ts.
    //
    // Promotion to `error` happens in PR-3b after 7 days clean observation.
    'no-restricted-syntax': [
      'warn',
      {
        selector:
          "Literal[value=/^(R3_BLOG|R3_guide|R6_BUYING_GUIDE|R3_guide_achat|R3_guide_howto|R3_conseils|R1_pieces|R6_GUIDE)$/]",
        message:
          '⚠️ Legacy SEO role literal in OUTPUT context. Use normalizeRoleId() / @repo/seo-roles canonical RoleId. (Legacy values OK in inputs, tests, fixtures, mappings de référence.)',
      },
    ],
  },

  // Exclusions for legacy SoT helpers + mappings de référence (audit confirmé)
  overrides: [
    {
      files: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/__fixtures__/**',
        '**/role-ids.ts',
        '**/r0-page-contract.constants.ts',
        '**/r4-keyword-plan.constants.ts',
        '**/r5-diagnostic.constants.ts',
        '**/seo-pilotage.service.ts',
        '**/admin-keyword-planner.controller.ts',
        '**/brief-gates.service.ts',
      ],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },

    // ============================================
    // Diagnostic Control Plane V1 — Port contract guards (L2 in
    // .claude/governance/guard-hierarchy.yaml). Replaces the buggy ast-grep
    // rules `domain-port-{method-cap,dto-shape}` which silently failed to fire
    // on AST patterns with comments / whitespace edge cases.
    //
    // Scope : files under any `ports/` subdir of any module. Restricting via
    // `overrides` keeps the rest of the backend immune to false positives if
    // someone ever names an unrelated interface `XPort`.
    // ============================================
    {
      files: ['src/**/ports/**/*.ts'],
      rules: {
        'fafa-ports/port-method-cap': 'error',
        'fafa-ports/port-dto-shape': 'error',
      },
    },

    // VehicleContext = OPTION A schema canon-locked at v:1 (9 fields including
    // `v` + `iat` JWS housekeeping). Canon memory: `vehicle-context-option-a-locked`.
    // Extension = nouveau domaine UserVehicleProfile, jamais bump du cap ici.
    // Maximum raised to 9 for this single file with ADR-pending reference. Any
    // future widening requires an L4 ADR vault entry (see guard-hierarchy.yaml).
    {
      files: ['src/**/ports/vehicle-context.port.ts'],
      rules: {
        'fafa-ports/port-dto-shape': [
          'error',
          { maxFields: 9, maxNesting: 3, portSuffix: 'Port' },
        ],
      },
    },
  ],
};
