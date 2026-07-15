/**
 * Schemas OpenAPI/JSON das rotas de clinica (D-032: documentacao via Swagger em
 * /docs). O Zod (clinic-schemas.ts) segue como validador autoritativo nos
 * handlers; os schemas de `body`/`params` aqui documentam e fazem a validacao
 * grosseira, e os de `response` formatam a saida e alimentam o /docs.
 */

const TAGS = ['clinic'];
const bearerAuth = [{ bearerAuth: [] }];

const tenantParams = {
  type: 'object',
  required: ['tenantId'],
  properties: { tenantId: { type: 'string', description: 'ID do tenant da clinica.' } },
};

const inviteParams = {
  type: 'object',
  required: ['tenantId', 'inviteId'],
  properties: {
    tenantId: { type: 'string', description: 'ID do tenant da clinica.' },
    inviteId: { type: 'string', description: 'ID do convite.' },
  },
};

const inviteSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'] },
    expiresAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'email', 'status', 'expiresAt', 'createdAt'],
};

const professionalSchema = {
  type: 'object',
  properties: {
    accountId: { type: 'string' },
    professionalProfileId: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    displayName: { type: ['string', 'null'] },
    joinedAt: { type: 'string', format: 'date-time' },
  },
  required: ['accountId', 'professionalProfileId', 'name', 'email', 'joinedAt'],
};

export const createInviteRouteSchema = {
  tags: TAGS,
  summary: 'Convida um profissional para a clinica (admin)',
  description:
    'Cria um convite de uso unico (D-014/D-048). Requer CLINIC_ADMIN do tenant. ' +
    'Devolve o token em claro UMA vez (entrega por e-mail e fase futura); ' +
    'o banco guarda apenas o hash.',
  security: bearerAuth,
  params: tenantParams,
  body: {
    type: 'object',
    required: ['email'],
    properties: { email: { type: 'string', description: 'E-mail do profissional convidado.' } },
  },
  response: {
    201: {
      type: 'object',
      properties: { invite: inviteSchema, token: { type: 'string' } },
      required: ['invite', 'token'],
    },
  },
};

export const rosterRouteSchema = {
  tags: TAGS,
  summary: 'Lista profissionais e convites pendentes da clinica (admin)',
  description:
    'Visao OPERACIONAL do corpo profissional + convites pendentes (D-015). ' +
    'Nunca expoe dado clinico. Requer CLINIC_ADMIN do tenant.',
  security: bearerAuth,
  params: tenantParams,
  response: {
    200: {
      type: 'object',
      properties: {
        professionals: { type: 'array', items: professionalSchema },
        pendingInvites: { type: 'array', items: inviteSchema },
      },
      required: ['professionals', 'pendingInvites'],
    },
  },
};

export const revokeInviteRouteSchema = {
  tags: TAGS,
  summary: 'Revoga um convite pendente (admin)',
  description: 'Marca o convite como REVOKED. Requer CLINIC_ADMIN do tenant.',
  security: bearerAuth,
  params: inviteParams,
  response: { 204: { type: 'null', description: 'Convite revogado.' } },
};

export const acceptInviteRouteSchema = {
  tags: TAGS,
  summary: 'Aceita um convite de profissional (publico, por token)',
  description:
    'Cria a conta (se nova) OU vincula o perfil a conta existente, sempre no ' +
    'tenant da clinica do convite (D-048 — unica porta de entrada numa clinica). ' +
    'O token de uso unico e a autorizacao; nao requer Bearer.',
  body: {
    type: 'object',
    required: ['token', 'password', 'name', 'document', 'documentType'],
    properties: {
      token: { type: 'string', description: 'Token de uso unico recebido no convite.' },
      password: { type: 'string', minLength: 8, description: 'Senha em claro (min. 8).' },
      name: { type: 'string', minLength: 1 },
      document: {
        type: 'string',
        minLength: 11,
        maxLength: 18,
        description: 'CPF ou CNPJ do profissional (D-043).',
      },
      documentType: { type: 'string', enum: ['CPF', 'CNPJ'] },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        professional: {
          type: 'object',
          properties: { accountId: { type: 'string' }, tenantId: { type: 'string' } },
          required: ['accountId', 'tenantId'],
        },
        created: { type: 'boolean' },
      },
      required: ['professional', 'created'],
    },
  },
};
