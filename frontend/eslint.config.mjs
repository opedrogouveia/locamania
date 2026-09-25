import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';

import base from '../eslint.config.mjs';

/**
 * ESLint do frontend — estende a base da raiz e registra os plugins de React,
 * acessibilidade e Next desde o primeiro dia (no SafeKeep eles nunca foram
 * instalados e o lint do frontend ficou quebrado por meses).
 *
 * Os plugins entram à mão, pegando só as `rules` dos presets: o formato dos
 * presets muda entre versões e o flat config rejeita o formato antigo.
 */
const FILES = ['src/**/*.{ts,tsx}'];

export default [
  ...base,
  {
    files: FILES,
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: FILES,
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Foco automático é intencional em diálogo e busca (abrir para digitar).
      'jsx-a11y/no-autofocus': 'warn',
      // Sincronizar com sistema externo (tema no localStorage, store de toasts,
      // estado online/offline) é exatamente o caso de uso do useEffect.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
