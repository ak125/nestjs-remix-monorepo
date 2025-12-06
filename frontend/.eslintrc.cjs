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
		'import/order': 'warn',
		'jsx-a11y/anchor-has-content': 'off',
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