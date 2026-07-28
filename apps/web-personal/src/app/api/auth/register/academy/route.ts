import { registerAcademySchema } from '@fitvo/validation';

import { handleCompanyRegistration } from '@/lib/register-company-bff';

/**
 * BFF do cadastro público de ACADEMIA (D-141). Mesmo corpo do BFF da clínica —
 * é o mesmo cadastro (spec §4.2/§4.3). O que muda é o schema, e é ele que
 * carrega a regra da vertical: só profissões de CREF (o `registerAcademySchema`
 * rejeita Médico/Nutricionista antes mesmo de a API ser chamada).
 */
export function POST(request: Request): Promise<Response> {
  return handleCompanyRegistration(request, registerAcademySchema, '/auth/register/academy');
}
