/** @type {import("eslint").Linter.Config} */
module.exports = {
	root: true,
	extends: [
        "@fafa/eslint-config/base.js",
        "plugin:storybook/recommended"
    ],
	settings: {
		// tailwindcss: {
		// 	config: 'tailwind.config.ts',
		// },
		'import/resolver': {
			node: {
				extensions: ['.js', '.jsx', '.ts', '.tsx'],
			},
			typescript: {
				project: ['./tsconfig.json'],
			},
		},
	},

		rules: {
		'@typescript-eslint/no-unused-vars': ['warn', {
			argsIgnorePattern: '^_|^(?:request|context|index)$',
			varsIgnorePattern: '^_',
			caughtErrorsIgnorePattern: '^_',
		}],
		'jsx-a11y/anchor-has-content': 'off',
		// UI Lint: Classes Tailwind interdites + SEO role legacy literals (PR-3a warn)
		'no-restricted-syntax': [
			'warn',
			{
				selector: 'JSXAttribute[name.name="className"][value.value=/w-screen/]',
				message: '❌ w-screen interdit - utiliser w-full (voir docs/layout.rules.md)',
			},
			{
				selector: 'JSXAttribute[name.name="className"][value.value=/(?<!overflow-)(?<!sm:)(?<!md:)(?<!lg:)(?<!xl:)(?<!2xl:)hidden(?!.*(?:sm:|md:|lg:|xl:|2xl:))/]',
				message: '⚠️ hidden sans breakpoint responsive - vérifier si intentionnel',
			},
			// PR-3a phase 3a (warning) — legacy SEO role literals in OUTPUT context.
			// Complementary to ast-grep `seo-no-bare-role-literal.yml` which catches
			// bare R3/R6/R9/R3_GUIDE across all langs. ESLint here catches *suffixed*
			// legacy forms in TS/TSX. Together they form the union coverage tested
			// by __regression__/seo-role-canon-guard.test.ts.
			//
			// Promotion to `error` happens in PR-3b after 7 days clean observation.
			{
				selector: "Literal[value=/^(R3_BLOG|R3_guide|R6_BUYING_GUIDE|R3_guide_achat|R3_guide_howto|R3_conseils|R1_pieces|R6_GUIDE)$/]",
				message: '⚠️ Legacy SEO role literal in OUTPUT context. Use normalizeLegacyPageRole() / @repo/seo-roles canonical RoleId. (Legacy values OK in inputs, tests, fixtures.)',
			},
		],
	},

	overrides: [
		{
			extends: ['@remix-run/eslint-config/jest-testing-library'],
			files: ['app/**/__tests__/**/*', 'app/**/*.{spec,test}.*'],
			rules: {
				'testing-library/no-await-sync-events': 'off',
				'jest-dom/prefer-in-document': 'off',
			},
			// we're using vitest which has a very similar API to jest
			// (so the linting plugins work nicely), but it means we have to explicitly
			// set the jest version.
			settings: {
				jest: {
					version: 28,
				},
			},
		},
	],
};