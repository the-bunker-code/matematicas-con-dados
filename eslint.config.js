// Configuración plana de ESLint 9. Reglas recomendadas + globales del navegador.
// eslint-config-prettier va al final: apaga las reglas de formato, que decide Prettier.
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'eqeqeq': 'error',
      'no-implicit-globals': 'error',
    },
  },
  {
    // Pruebas, scripts y configuración corren en Node.
    files: ['tests/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // El service worker tiene sus propias globales (self, caches, clients).
    files: ['sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  prettier,
];
