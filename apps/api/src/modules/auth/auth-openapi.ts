/**
 * Schemas OpenAPI/JSON das rotas de auth (D-032: documentacao via Swagger em
 * /docs). O Zod (auth-schemas.ts) segue como validador autoritativo nos handlers
 * — os schemas de `body` aqui documentam e fazem a validacao grosseira
 * (tipo/obrigatoriedade/tamanho); o formato de e-mail fica a cargo do Zod. Os
 * schemas de `response` formatam a saida e alimentam o /docs.
 */

const TAGS = ['auth'];

const emailProp = { type: 'string', description: 'E-mail de login (unico) — D-042.' };
const passwordProp = { type: 'string', minLength: 8, description: 'Senha em claro (min. 8).' };
const tokenProp = { type: 'string', description: 'Token de uso unico recebido por e-mail.' };

const tokensSchema = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    accessExpiresAt: { type: 'string', format: 'date-time' },
    refreshExpiresAt: { type: 'string', format: 'date-time' },
  },
  required: ['accessToken', 'refreshToken', 'accessExpiresAt', 'refreshExpiresAt'],
};

const accountSummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
  },
  required: ['id', 'email', 'name'],
};

const authResultSchema = {
  type: 'object',
  properties: { account: accountSummarySchema, tokens: tokensSchema },
  required: ['account', 'tokens'],
};

const acceptedSchema = {
  type: 'object',
  properties: { status: { type: 'string' } },
  required: ['status'],
};

const meSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    emailVerified: { type: 'boolean' },
  },
  required: ['id', 'email', 'name', 'emailVerified'],
};

const bearerAuth = [{ bearerAuth: [] }];

export const registerProfessionalRouteSchema = {
  tags: TAGS,
  summary: 'Cadastra um profissional (cria conta + tenant SOLO)',
  description:
    'Cria conta + tenant SOLO + perfil profissional (D-045) e dispara a verificacao de e-mail.',
  body: {
    type: 'object',
    required: ['email', 'password', 'name', 'document', 'documentType', 'tenantName'],
    properties: {
      email: emailProp,
      password: passwordProp,
      name: { type: 'string', minLength: 1 },
      document: {
        type: 'string',
        minLength: 11,
        maxLength: 18,
        description: 'CPF ou CNPJ (D-043).',
      },
      documentType: { type: 'string', enum: ['CPF', 'CNPJ'] },
      tenantName: { type: 'string', minLength: 1 },
    },
  },
  response: { 201: authResultSchema },
};

export const registerPatientRouteSchema = {
  tags: TAGS,
  summary: 'Cadastra um paciente (conta em estado minimo)',
  description: 'Autocadastro de paciente (D-006); dispara a verificacao de e-mail.',
  body: {
    type: 'object',
    required: ['email', 'password', 'name', 'document'],
    properties: {
      email: emailProp,
      password: passwordProp,
      name: { type: 'string', minLength: 1 },
      document: { type: 'string', minLength: 11, maxLength: 14, description: 'CPF (D-043).' },
    },
  },
  response: { 201: authResultSchema },
};

export const loginRouteSchema = {
  tags: TAGS,
  summary: 'Autentica por e-mail e senha (rate limited)',
  description: 'Emite access + refresh (D-029). Limitado a 5 tentativas por minuto.',
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: { email: emailProp, password: { type: 'string', minLength: 1 } },
  },
  response: { 200: authResultSchema },
};

export const refreshRouteSchema = {
  tags: TAGS,
  summary: 'Rotaciona o refresh token',
  description: 'Rotacao a cada uso com deteccao de reuso (D-029).',
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: { refreshToken: { type: 'string', minLength: 1 } },
  },
  response: {
    200: {
      type: 'object',
      properties: { tokens: tokensSchema },
      required: ['tokens'],
    },
  },
};

export const logoutRouteSchema = {
  tags: TAGS,
  summary: 'Encerra a sessao atual (revoga o refresh)',
  security: bearerAuth,
  response: { 204: { type: 'null', description: 'Sessao revogada.' } },
};

export const meRouteSchema = {
  tags: TAGS,
  summary: 'Conta autenticada (a partir do access token)',
  security: bearerAuth,
  response: { 200: meSchema },
};

export const requestEmailVerificationRouteSchema = {
  tags: TAGS,
  summary: 'Solicita/reenvia a verificacao de e-mail',
  description:
    'Sempre 202 — nao revela se o e-mail existe ou ja esta verificado (D-029). Rate limited.',
  body: {
    type: 'object',
    required: ['email'],
    properties: { email: emailProp },
  },
  response: { 202: acceptedSchema },
};

export const verifyEmailRouteSchema = {
  tags: TAGS,
  summary: 'Confirma a verificacao de e-mail (consome o token)',
  body: {
    type: 'object',
    required: ['token'],
    properties: { token: tokenProp },
  },
  response: {
    200: {
      type: 'object',
      properties: { verified: { type: 'boolean' } },
      required: ['verified'],
    },
  },
};

export const forgotPasswordRouteSchema = {
  tags: TAGS,
  summary: 'Inicia a recuperacao de senha',
  description: 'Sempre 202 — nao vaza existencia de conta (D-029). Rate limited.',
  body: {
    type: 'object',
    required: ['email'],
    properties: { email: emailProp },
  },
  response: { 202: acceptedSchema },
};

export const resetPasswordRouteSchema = {
  tags: TAGS,
  summary: 'Redefine a senha e revoga as sessoes',
  description: 'Consome o token de uso unico e revoga todas as sessoes da conta (D-029).',
  body: {
    type: 'object',
    required: ['token', 'password'],
    properties: { token: tokenProp, password: passwordProp },
  },
  response: { 204: { type: 'null', description: 'Senha redefinida.' } },
};
