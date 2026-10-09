import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Vendored bundles under public/ are third-party build artefacts.
  globalIgnores(['dist', 'node_modules', 'public/**/*.min.js', 'public/**/*.min.mjs']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // Components referenced only inside JSX are still "used" to the core
      // rule; jsx-uses-vars tells it so. Without this the whole codebase
      // reported hundreds of false positives.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'react/react-in-jsx-scope': 'off',
      // Prop validation is not used anywhere in this project.
      'react/prop-types': 'off',
      // Apostrophes/quotes inside JSX copy are intentional prose; escaping them
      // adds noise without changing output.
      'react/no-unescaped-entities': 'off',
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        args: 'none',
        caughtErrors: 'none',
      }],
      // This rule flags every legitimate "fetch on mount" hook, which is the
      // data-loading pattern used throughout this app. Kept as a warning so
      // genuinely accidental cascading renders remain visible in review.
      'react-hooks/set-state-in-effect': 'warn',
      // Context modules intentionally co-locate a Provider component with its
      // useX hook and constants. That is correct React architecture; the rule
      // only concerns fast-refresh granularity in development, so it is turned
      // off rather than forcing artificial file splits.
      'react-refresh/only-export-components': 'off',
    },
  },
])