module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
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
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    // Prévenir les futurs console.log - warn pour migration progressive
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // ============================================
    // P1.3 - Import Firewall (2026-02-02)
    // Empêche les imports apps -> tools
    // Voir docs/MIGRATION_PLAN_DEV_PREPROD_PROD.md
    // ============================================
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/modules/rm/**'],
            message:
              '⛔ RmModule est DEV ONLY - Crash prod 2026-01-11. Voir docs/MIGRATION_PLAN_DEV_PREPROD_PROD.md',
          },
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
  },
};
