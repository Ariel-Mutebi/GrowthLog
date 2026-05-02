import js from '@eslint/js';
import { configs, type ConfigArray } from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';

export default [
  js.configs.recommended,
  ...configs.recommended,
  {
    plugins: {
      import: importX,
    },
    rules: {
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'eol-last': ['error', 'always'],
      'import/extensions': ['error', 'ignorePackages'],
      'comma-dangle': ['error', 'always-multiline'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
    },
    ignores: ['src/db/'],
  },
] satisfies ConfigArray;
