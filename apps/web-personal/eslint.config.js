import base from '@fitvo/eslint-config/base';
import globals from 'globals';

/**
 * ESLint do web-personal = base compartilhada + globais de browser (client
 * components usam window/document/localStorage) e de node (route handlers do BFF).
 */
export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];
