// .cjs (nao .js): o pacote e "type": "module" — o Jest precisa de um arquivo de
// config interpretado como CommonJS independente disso.
//
// Harness de RENDER real (design-system-components.md, pendencia registrada em
// docs/ui-primitives.md): ate aqui os testes mobile cobriam so a logica pura dos
// `*-variants.ts` (vitest, sem react-native — ver vitest.config.ts). Este preset
// cobre o outro lado — montar os componentes .tsx de verdade (RTL + preset RN),
// escopado so a `*.test.tsx` para nao colidir com os `*.test.ts` do vitest.
module.exports = {
  preset: 'react-native',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  // pnpm aninha os pacotes reais sob node_modules/.pnpm/<nome>@<versao>/node_modules/...
  // — o padrao usual de exclusao (`node_modules/(?!react-native|...)`) nao acerta esse
  // segundo nivel, e libs RN publicadas como ESM/Flow (react-native, @react-native/*,
  // react-native-svg) quebram sem transform. Mais simples e robusto: transformar tudo.
  transformIgnorePatterns: [],
};
