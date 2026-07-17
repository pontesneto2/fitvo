import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import { z } from 'zod';

/**
 * Transform do `@fastify/swagger` em modo TRANSITÓRIO (D-032.1).
 *
 * O `jsonSchemaTransform` do type provider converte schemas Zod → OpenAPI, mas
 * **lança `InvalidSchemaError`** se receber um JSON Schema à mão (ele espera Zod).
 * Enquanto só o slice de auth usa Zod (a migração dos demais é a D-032.2), este
 * wrapper só encaminha ao conversor as rotas que declaram schema Zod; as rotas
 * em JSON Schema passam **intactas** — exatamente o que o swagger já fazia.
 *
 * Quando todos os slices forem Zod, isto vira `jsonSchemaTransform` puro e o
 * arquivo some.
 */
function routeUsesZod(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') {
    return false;
  }
  const s = schema as Record<string, unknown>;
  if ([s.body, s.querystring, s.params, s.headers].some((part) => part instanceof z.ZodType)) {
    return true;
  }
  if (s.response && typeof s.response === 'object') {
    return Object.values(s.response as Record<string, unknown>).some(
      (part) => part instanceof z.ZodType,
    );
  }
  return false;
}

export const zodAwareTransform: typeof jsonSchemaTransform = (data) => {
  if (routeUsesZod(data.schema)) {
    return jsonSchemaTransform(data);
  }
  return { schema: data.schema, url: data.url };
};
