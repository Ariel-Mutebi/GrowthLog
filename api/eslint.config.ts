import js from '@eslint/js';
import { configs, ConfigArray } from 'typescript-eslint';
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
    },
  },
] satisfies ConfigArray;
