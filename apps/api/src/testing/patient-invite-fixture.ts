import type { TestHarness } from './build-test-app';
import { validProfessionalRegistration } from './professional-registration-fixture';

const FIXTURE_TENANT = 'pro_tenant_patient_fixture';
const FIXTURE_SPECIALTY = 'spec_patient_fixture';

const proPayload = validProfessionalRegistration;

/**
 * Cria uma conta de paciente pelo UNICO caminho de nascimento (aceite de
 * convite — D-135/ADR-0015): profissional autonomo -> convite -> aceite.
 * Fixture para testes que so precisam de "uma conta de paciente existe" sem
 * exercitar o fluxo de convite em si (ex.: reenvio de verificacao de e-mail,
 * rejeicao de login com senha errada).
 */
export async function createPatientViaInvite(
  harness: TestHarness,
  patient: { email: string; password: string; name: string; document: string },
): Promise<{ accountId: string }> {
  const proRes = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: proPayload,
  });
  const proBody = proRes.json();
  await harness.accounts.markEmailVerified(proBody.account.id);
  harness.patient.seedProfessional({
    accountId: proBody.account.id,
    tenantId: FIXTURE_TENANT,
    specialtyIds: [FIXTURE_SPECIALTY],
  });

  const inviteRes = await harness.app.inject({
    method: 'POST',
    url: `/v1/patients/${FIXTURE_TENANT}/invites`,
    headers: { authorization: `Bearer ${proBody.tokens.accessToken}` },
    payload: { email: patient.email, specialtyId: FIXTURE_SPECIALTY, modality: 'ONLINE' },
  });
  const { token } = inviteRes.json();

  const acceptRes = await harness.app.inject({
    method: 'POST',
    url: '/v1/patients/invites/accept',
    payload: {
      token,
      password: patient.password,
      name: patient.name,
      document: patient.document,
      acceptedTerms: { termsOfUse: true, privacyPolicy: true },
    },
  });
  return { accountId: acceptRes.json().patient.accountId };
}
