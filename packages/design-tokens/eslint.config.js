/**
 * @fafa/design-tokens — ESLint flat config (PR-9h Phase F/C0).
 * Remplace `.eslintrc.cjs` (qui étendait `@fafa/eslint-config/base.js` → @remix-run).
 * Étend la flat partagée `@fafa/eslint-config` (équivalence prouvée drift=0) + le
 * parsing type-aware sur `src/**` (préserve l'ancien `parserOptions.project`).
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharedConfig from "@fafa/eslint-config/eslint.config.js";

// Portable sur tout Node 20.x+ (import.meta.dirname n'existe qu'à partir de 20.11).
const here = dirname(fileURLToPath(import.meta.url));

export default [
  ...sharedConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { project: "./tsconfig.json", tsconfigRootDir: here },
    },
  },
];
