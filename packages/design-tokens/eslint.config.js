/**
 * @fafa/design-tokens — ESLint flat config (PR-9h Phase F/C0).
 * Remplace `.eslintrc.cjs` (qui étendait `@fafa/eslint-config/base.js` → @remix-run).
 * Étend la flat partagée `@fafa/eslint-config` (équivalence prouvée drift=0) + le
 * parsing type-aware sur `src/**` (préserve l'ancien `parserOptions.project`).
 */
import sharedConfig from "@fafa/eslint-config/eslint.config.js";

export default [
  ...sharedConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname },
    },
  },
];
