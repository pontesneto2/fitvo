/**
 * Schemas OpenAPI/JSON das rotas de paciente/vinculo (D-032: documentacao via
 * Swagger em /docs). O Zod (patient-schemas.ts) segue como validador autoritativo
 * nos handlers; os schemas de `body`/`params` aqui documentam e fazem a validacao
 * grosseira, e os de `response` formatam a saida e alimentam o /docs.
 */

const TAGS = ['patient'];
const bearerAuth = [{ bearerAuth: [] }];

/** Modalidade do atendimento (D-101 — ADR-0011). Escolhida pelo profissional. */
const MODALITY_VALUES = ['ONLINE', 'PRESENCIAL', 'HIBRIDO'];

const tenantParams = {
  type: 'object',
  required: ['tenantId'],
  properties: { tenantId: { type: 'string', description: 'ID do tenant do profissional.' } },
};

const inviteParams = {
  type: 'object',
  required: ['tenantId', 'inviteId'],
  properties: {
    tenantId: { type: 'string', description: 'ID do tenant do profissional.' },
    inviteId: { type: 'string', description: 'ID do convite.' },
  },
};

const bondParams = {
  type: 'object',
  required: ['tenantId', 'bondId'],
  properties: {
    tenantId: { type: 'string', description: 'ID do tenant do profissional.' },
    bondId: { type: 'string', description: 'ID do vinculo.' },
  },
};

const inviteSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    specialtyId: { type: 'string' },
    modality: { type: 'string', enum: MODALITY_VALUES },
    status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'] },
    expiresAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'email', 'specialtyId', 'modality', 'status', 'expiresAt', 'createdAt'],
};

const bondSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    patientProfileId: { type: 'string' },
    patientName: { type: 'string' },
    patientEmail: { type: 'string' },
    specialtyId: { type: 'string' },
    modality: { type: 'string', enum: MODALITY_VALUES },
    status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED'] },
    createdAt: { type: 'string', format: 'date-time' },
    archivedAt: { type: ['string', 'null'], format: 'date-time' },
  },
  required: [
    'id',
    'patientProfileId',
    'patientName',
    'patientEmail',
    'specialtyId',
    'modality',
    'status',
    'createdAt',
  ],
};

const inviteResult = {
  type: 'object',
  properties: { invite: inviteSchema, token: { type: 'string' } },
  required: ['invite', 'token'],
};

export const createInviteRouteSchema = {
  tags: TAGS,
  summary: 'Convida um paciente para uma especialidade (profissional)',
  description:
    'Cria um convite de uso unico direcionado a UMA especialidade (D-006/D-052), ' +
    'declarando a MODALIDADE do atendimento (D-101), que o vinculo herda no aceite. ' +
    'Requer perfil profissional no tenant que reivindica a especialidade-alvo. ' +
    'Devolve o token em claro UMA vez (entrega por push/e-mail e fase futura); ' +
    'o banco guarda apenas o hash.',
  security: bearerAuth,
  params: tenantParams,
  body: {
    type: 'object',
    required: ['email', 'specialtyId', 'modality'],
    properties: {
      email: { type: 'string', description: 'E-mail do paciente convidado.' },
      specialtyId: { type: 'string', description: 'Especialidade-alvo do vinculo (D-052).' },
      modality: {
        type: 'string',
        enum: MODALITY_VALUES,
        description:
          'Modalidade do atendimento (D-101). Definida pelo PROFISSIONAL — o paciente ' +
          'nao escolhe a modalidade do servico que contrata. Define o fluxo da anamnese: ' +
          'ONLINE (paciente preenche sozinho), PRESENCIAL (profissional preenche na ' +
          'consulta) ou HIBRIDO (ambos).',
      },
    },
  },
  response: { 201: inviteResult },
};

export const overviewRouteSchema = {
  tags: TAGS,
  summary: 'Lista convites pendentes e vinculos ativos do profissional',
  description:
    'Visao OPERACIONAL do proprio profissional: convites pendentes + vinculos ' +
    'ativos (ADR-0001). Requer perfil profissional no tenant.',
  security: bearerAuth,
  params: tenantParams,
  response: {
    200: {
      type: 'object',
      properties: {
        pendingInvites: { type: 'array', items: inviteSchema },
        activeBonds: { type: 'array', items: bondSchema },
      },
      required: ['pendingInvites', 'activeBonds'],
    },
  },
};

export const resendInviteRouteSchema = {
  tags: TAGS,
  summary: 'Reenvia um convite pendente (profissional)',
  description:
    'Rotaciona o token e estende a validade na mesma linha (D-055). Devolve o ' +
    'novo token em claro UMA vez. Requer perfil profissional no tenant.',
  security: bearerAuth,
  params: inviteParams,
  response: { 201: inviteResult },
};

export const revokeInviteRouteSchema = {
  tags: TAGS,
  summary: 'Revoga um convite pendente (profissional)',
  description: 'Marca o convite como REVOKED. Requer perfil profissional no tenant.',
  security: bearerAuth,
  params: inviteParams,
  response: { 204: { type: 'null', description: 'Convite revogado.' } },
};

export const archiveBondRouteSchema = {
  tags: TAGS,
  summary: 'Arquiva um vinculo ativo (profissional)',
  description:
    'ACTIVE -> ARCHIVED + archivedAt. NUNCA apaga: dados preservados (D-053). ' +
    'Requer perfil profissional no tenant.',
  security: bearerAuth,
  params: bondParams,
  response: { 204: { type: 'null', description: 'Vinculo arquivado.' } },
};

export const acceptInviteRouteSchema = {
  tags: TAGS,
  summary: 'Aceita um convite de paciente (publico, por token)',
  description:
    'Cria a conta+perfil de paciente (se novo) OU anexa/reusa o perfil na conta ' +
    'existente (multi-papel — D-041) e abre o vinculo na especialidade do convite. ' +
    'O token de uso unico e a autorizacao; nao requer Bearer.',
  body: {
    type: 'object',
    required: ['token', 'password', 'name', 'document'],
    properties: {
      token: { type: 'string', description: 'Token de uso unico recebido no convite.' },
      password: { type: 'string', minLength: 8, description: 'Senha em claro (min. 8).' },
      name: { type: 'string', minLength: 1 },
      document: {
        type: 'string',
        minLength: 11,
        maxLength: 14,
        description: 'CPF do paciente (D-043).',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        patient: {
          type: 'object',
          properties: {
            accountId: { type: 'string' },
            tenantId: { type: 'string' },
            patientProfileId: { type: 'string' },
          },
          required: ['accountId', 'tenantId', 'patientProfileId'],
        },
        bond: {
          type: 'object',
          properties: { id: { type: 'string' }, specialtyId: { type: 'string' } },
          required: ['id', 'specialtyId'],
        },
        created: { type: 'boolean' },
      },
      required: ['patient', 'bond', 'created'],
    },
  },
};
