/**
 * Frontend ESLint flat config (PR-9h Phase F/C0).
 * Remplace `.eslintrc.cjs`. Étend la flat partagée `@fafa/eslint-config` (qui remplace
 * `@remix-run/eslint-config`) + storybook + les règles custom préservées 1:1
 * (no-restricted-syntax Tailwind/SEO/storage, overrides test/SoT/routes).
 *
 * Test override = parité `@remix-run/eslint-config/jest-testing-library`
 * (jest + jest-dom + testing-library). Les versions legacy bundlées (jest 26 / jest-dom 4 /
 * testing-library 5) sont peer-incompatibles avec le toolchain moderne (@typescript-eslint v8 →
 * ERESOLVE, refus de `--legacy-peer-deps` = bricolage) : on prend donc les versions courantes.
 * Sur cette surface DORMANTE (0 fichier test aujourd'hui) le net est un RENFORCEMENT
 * (21 règles warn→error, 16 nouvelles) ; les seules sorties du recommended sont 3 renommages
 * (couverts par les nouveaux IDs : await-async-queries, no-await-sync-queries, no-render-in-lifecycle)
 * + 4 règles dépréciées-et-retirées en amont. Base/route/root prouvés drift=0 par `eslint --print-config`.
 */
import sharedConfig from "@fafa/eslint-config/eslint.config.js";
import storybook from "eslint-plugin-storybook";
import testingLibrary from "eslint-plugin-testing-library";
import jestDom from "eslint-plugin-jest-dom";
import jest from "eslint-plugin-jest";
import globals from "globals";

/** no-restricted-syntax — Tailwind interdites + SEO role legacy (préservé 1:1). */
const TAILWIND_SEO = [
  {
    selector: 'JSXAttribute[name.name="className"][value.value=/w-screen/]',
    message: "❌ w-screen interdit - utiliser w-full (voir docs/layout.rules.md)",
  },
  {
    selector:
      'JSXAttribute[name.name="className"][value.value=/(?<!overflow-)(?<!sm:)(?<!md:)(?<!lg:)(?<!xl:)(?<!2xl:)hidden(?!.*(?:sm:|md:|lg:|xl:|2xl:))/]',
    message: "⚠️ hidden sans breakpoint responsive - vérifier si intentionnel",
  },
  {
    selector:
      "Literal[value=/^(R3_BLOG|R3_guide|R6_BUYING_GUIDE|R3_guide_achat|R3_guide_howto|R3_conseils|R1_pieces|R6_GUIDE)$/]",
    message:
      "⚠️ Legacy SEO role literal in OUTPUT context. Use normalizeLegacyPageRole() / @repo/seo-roles canonical RoleId. (Legacy values OK in inputs, tests, fixtures.)",
  },
];
/** safe-storage guards (préservé 1:1) — sessionStorage/localStorage throws sur WebView bloqué. */
const STORAGE_GUARDS = [
  {
    selector: "MemberExpression[object.name='sessionStorage']",
    message:
      "⚠️ Use safeSessionStorage from ~/utils/safe-storage (sessionStorage.* throws SecurityError on Chrome Mobile WebView / blocked storage — Sentry 181aeb23).",
  },
  {
    selector:
      "MemberExpression[object.type='MemberExpression'][object.object.name='window'][object.property.name='sessionStorage']",
    message:
      "⚠️ Use safeSessionStorage from ~/utils/safe-storage (window.sessionStorage.* throws SecurityError on Chrome Mobile WebView / blocked storage — Sentry 181aeb23).",
  },
  {
    selector: "MemberExpression[object.name='localStorage']",
    message:
      "⚠️ Use safeLocalStorage from ~/utils/safe-storage (localStorage.* throws SecurityError on Chrome Mobile WebView / blocked storage — Sentry 181aeb23).",
  },
  {
    selector:
      "MemberExpression[object.type='MemberExpression'][object.object.name='window'][object.property.name='localStorage']",
    message:
      "⚠️ Use safeLocalStorage from ~/utils/safe-storage (window.localStorage.* throws SecurityError on Chrome Mobile WebView / blocked storage — Sentry 181aeb23).",
  },
];

export default [
  // Ignores = parité `--ignore-path .gitignore` (frontend/.gitignore) ; .server/.client gardés (Remix).
  {
    ignores: [
      "build/**",
      "public/build/**",
      ".cache/**",
      "storybook-static/**",
      "node_modules/**",
      "!**/.server",
      "!**/.client",
    ],
  },

  ...sharedConfig,
  ...storybook.configs["flat/recommended"],

  // ── Base frontend (tous fichiers) : settings résolveur TS + règles non-TS préservées ──
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    settings: {
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
        typescript: { project: ["./tsconfig.json"] },
      },
    },
    rules: {
      "jsx-a11y/anchor-has-content": "off",
      "no-restricted-syntax": ["warn", ...TAILWIND_SEO, ...STORAGE_GUARDS],
    },
  },
  // ── no-unused-vars custom (scope TS : le plugin @typescript-eslint n'est chargé que pour ts/tsx) ──
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_|^(?:request|context|index)$",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // ── Override test : jest + jest-dom + testing-library (parité jest-testing-library) ──
  {
    files: ["app/**/__tests__/**/*", "app/**/*.{spec,test}.*"],
    plugins: { "testing-library": testingLibrary, "jest-dom": jestDom, jest },
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      ...jest.configs["flat/recommended"].rules,
      ...jestDom.configs["flat/recommended"].rules,
      ...testingLibrary.configs["flat/react"].rules,
      // Parité legacy : encore active en v7 mais sortie du recommended → ré-activée explicitement.
      "testing-library/prefer-user-event": "warn",
      "testing-library/no-await-sync-events": "off",
      "jest-dom/prefer-in-document": "off",
    },
    settings: { jest: { version: 28 } },
  },

  // ── SoT canon + tests/fixtures : no-restricted-syntax désactivé (définitions de canon) ──
  {
    files: [
      "app/utils/page-role.types.ts",
      "app/utils/safe-storage.ts",
      "app/types/r6-guide.types.ts",
      "**/__tests__/**",
      "**/__fixtures__/**",
      "**/*.{spec,test}.{ts,tsx}",
    ],
    rules: { "no-restricted-syntax": "off" },
  },

  // ── Routes : Tailwind + SEO conservés, storage EXCLU (R-SEO-09 bloque l'édition des routes) ──
  {
    files: ["app/routes/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["warn", ...TAILWIND_SEO] },
  },
];
