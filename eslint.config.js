const js = require('@eslint/js');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error'
    }
  },
  {
    ignores: ['node_modules/**', 'package-lock.json']
  }
];
