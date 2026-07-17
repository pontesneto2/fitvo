import base from '@fitvo/eslint-config/base';

export default [
  // Client gerado pelo Prisma. Artefato de terceiro, nao codigo nosso — lintar
  // o gerado trocaria CI flaky por lint vermelho, o mesmo erro com outra roupa.
  // Ignore PREVENTIVO: entra junto com o output-no-pacote, nao depois do CI
  // reclamar. Ver docs/troubleshooting.md §13.
  { ignores: ['src/generated/**'] },
  ...base,
];
