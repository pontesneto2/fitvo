import { specialtyListResultSchema } from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { SpecialtyApplicationService } from './specialty-application-service';

const TAGS = ['specialty'];

/**
 * Vertical slice do catalogo de especialidades (D-047; versao na URL /v1 —
 * D-034). Rota unica, publica e so-leitura: o catalogo e fixo, sem
 * tenant/dado sensivel — o cadastro publico do profissional (sem Bearer)
 * precisa dele pra popular o select de especialidade (D-137).
 */
export function specialtyRoutes(service: SpecialtyApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista o catalogo fixo de especialidades (publico)',
          description:
            'Catalogo fixo, semeado na migracao (D-047) — sem tenant/dado sensivel. ' +
            'Usado pelo cadastro publico de profissional para popular o select.',
          response: { 200: specialtyListResultSchema },
        },
      },
      async (_request, reply) => {
        return reply.send(await service.list());
      },
    );
  };
}
