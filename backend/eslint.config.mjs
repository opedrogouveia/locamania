import base from '../eslint.config.mjs';

/**
 * ESLint do backend — estende a config compartilhada da raiz e adiciona o
 * ambiente Node/Jest. Necessário porque o flat config do ESLint não busca
 * configs em diretórios ancestrais.
 */
export default [
  ...base,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
];
