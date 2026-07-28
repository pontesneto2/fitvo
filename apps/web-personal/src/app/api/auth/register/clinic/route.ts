import { registerClinicSchema } from '@fitvo/validation';

import { handleCompanyRegistration } from '@/lib/register-company-bff';

/**
 * BFF do cadastro público de CLÍNICA (D-139). O corpo é compartilhado com o da
 * academia (`handleCompanyRegistration`) — aqui fica só a vertical: qual schema
 * valida e para qual rota da API vai.
 */
export function POST(request: Request): Promise<Response> {
  return handleCompanyRegistration(request, registerClinicSchema, '/auth/register/clinic');
}
