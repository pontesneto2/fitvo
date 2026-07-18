// @fitvo/validation — schemas Zod compartilhados (fonte única de validação e
// contrato — D-032). Cada domínio expõe seus schemas de request/response; a API
// os usa para validar e gerar o OpenAPI, web/mobile os usam para validar
// formulários no cliente. Sem redefinir DTO em cada consumidor.
export * from './auth';
