/**
 * @fafa/eslint-config — flat config partagée (PR-9h Phase F/C0).
 *
 * Remplace l'ancien `base.js` qui étendait `@remix-run/eslint-config` (déprécié,
 * absent de React Router v7).
 *
 * FIDÉLITÉ — `@remix-run/eslint-config@2.17.5` est un config CURÉ (il cherry-pick,
 * il n'étend PAS `eslint:recommended` / `react/recommended` / `import/recommended`
 * en bloc). On NE spread donc PAS ces presets (cela ajouterait ~70 règles que
 * @remix-run omet volontairement → durcissement silencieux hors-scope). À la place :
 *   - les plugins sont déclarés (pour que les règles s'attachent) ;
 *   - l'ensemble de règles RÉSOLU de @remix-run est figé 1:1 dans
 *     `remix-legacy-rules.json` (`base` = contexte JS, `typescript` = deltas TS) ;
 *   - SEUL `@typescript-eslint/recommended` est spread (via `tseslint`), car
 *     @remix-run l'étendait réellement dans son override TS — `legacy.typescript`
 *     ne contient que ses deltas, pas le recommended complet.
 *
 * Équivalence prouvée par `eslint --print-config` (drift=0 vs baseline authentique
 * capturée avec @remix-run réinstallé) — aucune règle activée n'est retirée ni
 * affaiblie. react-hooks reste en v4 (parité comportementale ; v7 = opt-in séparé).
 */
const globals = require("globals");
const tseslint = require("typescript-eslint");
const reactPlugin = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const jsxA11y = require("eslint-plugin-jsx-a11y");
const importPlugin = require("eslint-plugin-import");
const prettier = require("eslint-config-prettier");
const legacy = require("./remix-legacy-rules.json");

const ALL = ["**/*.{js,jsx,ts,tsx}"];
const TS = ["**/*.{ts,tsx}"];

/** import/order custom (ancien base.js — préservé 1:1). */
const importOrderRules = {
  "import/no-duplicates": ["warn", { "prefer-inline": true }],
  "import/consistent-type-specifier-style": ["warn", "prefer-inline"],
  "import/order": [
    "warn",
    {
      alphabetize: { order: "asc", caseInsensitive: true },
      groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
      pathGroups: [{ pattern: "~/**", group: "internal", position: "after" }],
      pathGroupsExcludedImportTypes: ["builtin"],
    },
  ],
};

module.exports = [
  // ── Base (tous fichiers) : plugins déclarés + env + settings + règles @remix-run résolues ──
  {
    files: ALL,
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      // env browser + commonjs + node (base.js étend /node) + es2021
      globals: { ...globals.browser, ...globals.commonjs, ...globals.node, ...globals.es2021 },
    },
    settings: {
      react: legacy.settingsReact.react,
      "import/ignore": ["node_modules", "\\.(css|md|svg|json)$"],
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: { ...legacy.base, ...importOrderRules },
  },

  // ── Override TS : parser @typescript-eslint + recommended (+ eslint-recommended turn-offs) ──
  // (@remix-run étendait plugin:@typescript-eslint/recommended dans son override TS)
  ...tseslint.config({
    files: TS,
    extends: [tseslint.configs.recommended],
    languageOptions: { parserOptions: { sourceType: "module" } },
  }),
  // import/typescript : settings (parsers/resolver TS) + toggles + deltas TS @remix-run
  {
    files: TS,
    settings: importPlugin.flatConfigs.typescript.settings,
    rules: { ...importPlugin.flatConfigs.typescript.rules, ...legacy.typescript },
  },

  // ── Override routes : default exports anonymes autorisés (parité @remix-run) ──
  {
    files: ["**/routes/**/*.{js,jsx,ts,tsx}", "**/root.{js,jsx,ts,tsx}"],
    rules: { "react/display-name": "off" },
  },

  // ── Prettier en DERNIER : désactive les règles stylistiques conflictuelles ──
  prettier,
];
