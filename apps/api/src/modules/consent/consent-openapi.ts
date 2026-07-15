/**
 * Schemas OpenAPI/JSON das rotas de consentimento (D-032: documentacao via
 * Swagger em /docs). O Zod (consent-schemas.ts) segue como validador autoritativo
 * nos handlers; os schemas de `body`/`params` aqui documentam e fazem a validacao
 * grosseira, e os de `response` formatam a saida e alimentam o /docs.
 */

const TAGS = ['consent'];
const bearerAuth = [{ bearerAuth: [] }];

const consentParams = {
  type: 'object',
  required: ['consentId'],
  properties: { consentId: { type: 'string', description: 'ID do consentimento.' } },
};

const consentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    granteeProfessionalProfileId: { type: 'string' },
    specialtyId: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'REVOKED'] },
    grantedAt: { type: 'string', format: 'date-time' },
    revokedAt: { type: ['string', 'null'], format: 'date-time' },
  },
  required: ['id', 'granteeProfessionalProfileId', 'specialtyId', 'status', 'grantedAt'],
};

export const grantConsentRouteSchema = {
  tags: TAGS,
  summary: 'Paciente concede consentimento a um profissional (por especialidade)',
  description:
    'O paciente (titular do dado) autoriza um profissional (grantee) a acessar ' +
    'os dados de UMA especialidade (D-016/ADR-0003). Exige vinculo ATIVO do ' +
    'paciente na especialidade. Bloqueia duplicata ativa (409); reabre um ' +
    'consentimento revogado. O consentimento e do paciente e pode cruzar tenants.',
  security: bearerAuth,
  body: {
    type: 'object',
    required: ['granteeProfessionalProfileId', 'specialtyId'],
    properties: {
      granteeProfessionalProfileId: {
        type: 'string',
        description: 'Profissional que RECEBE o acesso.',
      },
      specialtyId: {
        type: 'string',
        description: 'Especialidade cujo dado pode ser compartilhado.',
      },
    },
  },
  response: { 201: consentSchema },
};

export const listConsentsRouteSchema = {
  tags: TAGS,
  summary: 'Lista os consentimentos do proprio paciente',
  description:
    'Consentimentos ATIVOS + historico revogado do paciente autenticado ' +
    '(D-016). Requer perfil de paciente.',
  security: bearerAuth,
  response: {
    200: {
      type: 'object',
      properties: { consents: { type: 'array', items: consentSchema } },
      required: ['consents'],
    },
  },
};

export const revokeConsentRouteSchema = {
  tags: TAGS,
  summary: 'Paciente revoga um consentimento ativo',
  description: 'ACTIVE -> REVOKED + revokedAt. Requer perfil de paciente (titular).',
  security: bearerAuth,
  params: consentParams,
  response: { 204: { type: 'null', description: 'Consentimento revogado.' } },
};
