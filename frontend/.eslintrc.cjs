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
			// Safe-storage guard — Sentry issue 181aeb23 (SecurityError sur Chrome
			// Mobile 148 / WebView in-app / cookies bloqués). `typeof window` ne
			// suffit pas : window existe mais l'accès à window.sessionStorage
			// throw. Toujours passer par ~/utils/safe-storage.
			{
				selector: "MemberExpression[object.name='sessionStorage']",
				message: '⚠️ Use safeSessionStorage from ~/utils/safe-storage (sessionStorage.* throws SecurityError on Chrome Mobile WebView / blocked storage — Sentry 181aeb23).',
			},
			{
				selector: "MemberExpression[object.type='MemberExpression'][object.object.name='window'][object.property.name='sessionStorage']",
				message: '⚠️ Use safeSessionStorage from ~/utils/safe-storage (window.sessionStorage.* throws SecurityError on Chrome Mobile WebView / blocked storage — Sentry 181aeb23).',
			},
			{
				selector: "MemberExpression[object.name='localStorage']",
				message: '⚠️ Use safeLocalStorage from ~/utils/safe-storage (localStorage.* throws SecurityError on Chrome Mobile WebView / blocked storage — Sentry 181aeb23).',
			},
			{
				selector: "MemberExpression[object.type='MemberExpression'][object.object.name='window'][object.property.name='localStorage']",
				message: '⚠️ Use safeLocalStorage from ~/utils/safe-storage (window.localStorage.* throws SecurityError on Chrome Mobile WebView / blocked storage — Sentry 181aeb23).',
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
		// ── PR-3a SEO role canon : SoT files exempt from legacy literal warning ──
		// These files DEFINE the canon (PageRole enum, R6GuidePayload typed
		// literals, etc.) — they MUST contain the literal forms. The legacy
		// literal rule (Literal[value=/^(R3_BLOG|...)$/]) targets OUTPUT contexts,
		// not type definitions. Mirrors backend/.eslintrc.js overrides.
		//
		// `app/utils/safe-storage.ts` est aussi exempt : c'est le wrapper canon
		// qui DOIT accéder à window.sessionStorage / window.localStorage en
		// direct (try/catch interne).
		{
			files: [
				'app/utils/page-role.types.ts',
				'app/utils/safe-storage.ts',
				'app/types/r6-guide.types.ts',
				'**/__tests__/**',
				'**/__fixtures__/**',
				'**/*.{spec,test}.{ts,tsx}',
			],
			rules: {
				'no-restricted-syntax': 'off',
			},
		},
		// ── R-SEO-09 interplay : routes/** keep Tailwind + SEO literal checks,
		//    storage selectors EXCLUDED until coupled Platform PR enables
		//    R-SEO-09 Phase 2 AST override and lets us migrate legacy direct
		//    sessionStorage/localStorage call sites in route files (e.g.
		//    checkout-payment-return.tsx GA4 dedupe key). See PR #624 follow-up.
		{
			files: ['app/routes/**/*.{ts,tsx}'],
			rules: {
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
					{
						selector: "Literal[value=/^(R3_BLOG|R3_guide|R6_BUYING_GUIDE|R3_guide_achat|R3_guide_howto|R3_conseils|R1_pieces|R6_GUIDE)$/]",
						message: '⚠️ Legacy SEO role literal in OUTPUT context. Use normalizeLegacyPageRole() / @repo/seo-roles canonical RoleId. (Legacy values OK in inputs, tests, fixtures.)',
					},
					// NOTE : storage selectors (sessionStorage.* / localStorage.*)
					// intentionally OMITTED here. R-SEO-09 hard-blocks any route
					// file edit, so eslint-disable comments cannot be added to
					// legacy direct-access call sites. Migration deferred to a
					// coupled Platform PR.
				],
			},
		},
	],
};