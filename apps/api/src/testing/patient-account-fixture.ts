import type { AcceptPatientInviteInput } from '../modules/patient/patient-application-service';
import type { NewPatientAccount } from '../modules/patient/patient-repository';
import { VALID_TEST_CPF } from './professional-registration-fixture';

/**
 * Conta de PACIENTE válida — fonte única para os testes.
 *
 * Mesma disciplina da fixture do profissional: quando o contrato do aceite
 * ganha um campo obrigatório novo, atualiza-se AQUI e os fluxos seguem verdes,
 * sem caçar payload duplicado. Isso importa mais no paciente do que em qualquer
 * outro cadastro, porque o aceite de convite é o **único** caminho de
 * nascimento da conta (D-135): todo campo obrigatório da pessoa passa por aqui.
 */

const ADDRESS = {
  cep: '01310930',
  logradouro: 'Avenida Paulista',
  numero: '1000',
  bairro: 'Bela Vista',
  cidade: 'Sao Paulo',
  state: 'SP',
  country: 'BR',
} as const;

/** Payload de WIRE do aceite (`POST /v1/patients/invites/accept`), sem o token. */
export const validPatientAcceptBody = {
  password: 'senha-forte-456',
  name: 'Paciente Fixture',
  document: VALID_TEST_CPF,
  // Obrigatório e exclusivo do paciente (spec §3.1/§4.6) — base de cálculo
  // clínico, capturado no aceite porque não há outra porta.
  biologicalSex: 'FEMALE',
  whatsapp: '11987654321',
  birthDate: '1992-03-20',
  address: ADDRESS,
  acceptedTerms: { termsOfUse: true, privacyPolicy: true },
} satisfies Omit<AcceptPatientInviteInput, 'token' | 'origin'> & {
  acceptedTerms: { termsOfUse: true; privacyPolicy: true };
};

/** Payload de REPOSITÓRIO (`NewPatientAccount`) — datas já como `Date`. */
export function validNewPatientAccount(
  overrides: Partial<NewPatientAccount> = {},
): NewPatientAccount {
  return {
    passwordHash: 'hash-nao-importa',
    name: 'Paciente Fixture',
    biologicalSex: 'FEMALE',
    document: VALID_TEST_CPF,
    whatsapp: '11987654321',
    birthDate: new Date('1992-03-20T00:00:00Z'),
    address: { ...ADDRESS },
    ...overrides,
  };
}
