// @fitvo/validation — schemas Zod compartilhados (fonte única de validação e
// contrato — D-032). Cada domínio expõe seus schemas de request/response; a API
// os usa para validar e gerar o OpenAPI, web/mobile os usam para validar
// formulários no cliente. Sem redefinir DTO em cada consumidor.
//
// Barrel flat: nomes genéricos (tenantParams, invite*) são prefixados por slice
// (clinic*/patient*/billing*/intern*) para não colidir. `auth` e `consent` já
// têm nomes próprios. `company-registration` NÃO é exportado: é a base
// compartilhada de clínica/academia, consumida pelos dois módulos de vertical —
// o contrato público são os `register*Schema`.
export * from './academy';
export * from './auth';
export * from './billing';
export * from './clinic';
export * from './consent';
export * from './document';
export * from './errors';
export * from './exercise-library';
export * from './intern';
export * from './nutrition';
export * from './patient';
export * from './reception';
export * from './specialty';
export * from './terms';
export * from './workout';
