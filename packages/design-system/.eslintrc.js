module.exports = {
  extends: ['@fafa/eslint-config/react-internal'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // 🚫 Interdit les valeurs HEX hard-codées (sauf dans tokens.css)
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/#[0-9a-fA-F]{3,6}\\b/]',
        message:
          '❌ Hard-coded HEX colors are forbidden. Use design tokens instead (e.g., colors.primary.500)',
      },
    ],
    // Permet les any temporaires dans les stories
    '@typescript-eslint/no-explicit-any': [
      'warn',
      { ignoreRestArgs: true },
    ],
  },
  overrides: [
    {
      // Autorise les HEX dans les fichiers de tokens
      files: ['src/tokens/**/*.ts', 'src/styles/**/*.css', 'scripts/**/*.js'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
    {
      // Config spécifique pour Storybook
      files: ['**/*.stories.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'import/no-anonymous-default-export': 'off',
      },
    },
  ],
};
