import { AuthError } from '@fitvo/auth';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { AppError, type ProblemDetails } from './http-errors';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const { statusCode } = error as { statusCode: unknown };
    return typeof statusCode === 'number' ? statusCode : undefined;
  }
  return undefined;
}

/** Item de erro de validacao do AJV/Fastify (subconjunto usado aqui). */
interface ValidationIssue {
  instancePath?: string;
  message?: string;
  params?: Record<string, unknown>;
}

/** Erros de validacao de schema do Fastify (`schema.body` etc. — D-032). */
function fastifyValidationIssues(error: unknown): ValidationIssue[] | undefined {
  if (typeof error === 'object' && error !== null && 'validation' in error) {
    const { validation } = error as { validation: unknown };
    if (Array.isArray(validation)) {
      return validation as ValidationIssue[];
    }
  }
  return undefined;
}

/**
 * Tradutor de erros para RFC 7807 (D-031). O front traduz o ProblemDetails
 * tecnico numa mensagem amigavel ao usuario final.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const path = issue.path.join('.') || '(body)';
        (errors[path] ??= []).push(issue.message);
      }
      const problem: ProblemDetails = {
        type: 'https://fitvo.dev/problems/validation',
        title: 'Requisicao invalida',
        status: 400,
        errors,
      };
      return reply.code(400).type(PROBLEM_CONTENT_TYPE).send(problem);
    }

    const issues = fastifyValidationIssues(error);
    if (issues) {
      const errors: Record<string, string[]> = {};
      for (const issue of issues) {
        const missing =
          typeof issue.params?.missingProperty === 'string'
            ? issue.params.missingProperty
            : undefined;
        const path =
          (issue.instancePath ?? '').replace(/^\//, '').replaceAll('/', '.') || missing || '(body)';
        (errors[path] ??= []).push(issue.message ?? 'invalido');
      }
      const problem: ProblemDetails = {
        type: 'https://fitvo.dev/problems/validation',
        title: 'Requisicao invalida',
        status: 400,
        errors,
      };
      return reply.code(400).type(PROBLEM_CONTENT_TYPE).send(problem);
    }

    if (error instanceof AppError) {
      const problem: ProblemDetails = {
        type: error.problemType,
        title: error.title,
        status: error.status,
        detail: error.message,
      };
      return reply.code(error.status).type(PROBLEM_CONTENT_TYPE).send(problem);
    }

    if (error instanceof AuthError) {
      const problem: ProblemDetails = {
        type: `https://fitvo.dev/problems/${error.code.toLowerCase().replaceAll('_', '-')}`,
        title: 'Falha de autenticacao',
        status: 401,
        detail: error.message,
      };
      return reply.code(401).type(PROBLEM_CONTENT_TYPE).send(problem);
    }

    if (statusCodeOf(error) === 429) {
      const problem: ProblemDetails = {
        type: 'https://fitvo.dev/problems/rate-limit',
        title: 'Muitas requisicoes',
        status: 429,
        detail: 'Aguarde um instante antes de tentar novamente.',
      };
      return reply.code(429).type(PROBLEM_CONTENT_TYPE).send(problem);
    }

    request.log.error({ err: error }, 'erro nao tratado');
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'Erro interno',
      status: 500,
    };
    return reply.code(500).type(PROBLEM_CONTENT_TYPE).send(problem);
  });
}
