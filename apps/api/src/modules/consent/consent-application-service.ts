import type { ConsentStatus } from '@fitvo/database';

import type { AccessTokenVerifier } from '../../shared/auth-context';
import { requireAuth } from '../../shared/auth-context';
import {
  ConsentAlreadyExistsError,
  ConsentRequiresActiveBondError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/http-errors';
import type { ConsentRecord, ConsentRepository } from './consent-repository';

/** Consentimento exposto na API (datas em ISO UTC — D-067). */
export interface ConsentView {
  id: string;
  granteeProfessionalProfileId: string;
  specialtyId: string;
  status: ConsentStatus;
  grantedAt: string;
  revokedAt: string | null;
}

export interface GrantConsentInput {
  granteeProfessionalProfileId: string;
  specialtyId: string;
}

function toView(consent: ConsentRecord): ConsentView {
  return {
    id: consent.id,
    granteeProfessionalProfileId: consent.granteeProfessionalProfileId,
    specialtyId: consent.specialtyId,
    status: consent.status,
    grantedAt: consent.grantedAt.toISOString(),
    revokedAt: consent.revokedAt ? consent.revokedAt.toISOString() : null,
  };
}

/**
 * Servico de aplicacao da slice de consentimento (D-016 — ADR-0003). O
 * consentimento e ato do PACIENTE (titular do dado): ele concede/revoga
 * granularmente por (profissional que recebe + especialidade). Compartilhamento
 * entre profissionais e SEMPRE autorizado pelo paciente, nunca automatico.
 *
 * Guard: `requireAuth` + a conta possui perfil de paciente. Diferente das slices
 * de profissional, NAO ha escopo de tenant aqui: o consentimento e do paciente e
 * pode cruzar tenants (ADR-0003). O isolamento de tenant (D-002) segue valendo
 * em toda OUTRA operacao do sistema.
 *
 * Regra de granularidade (default documentado): um consentimento por tripla
 * (paciente, grantee, especialidade). Reconceder um consentimento REVOKED REABRE
 * a mesma linha (reuso), em vez de inserir varias.
 */
export class ConsentApplicationService {
  constructor(
    private readonly consents: ConsentRepository,
    private readonly tokenVerifier: AccessTokenVerifier,
  ) {}

  /**
   * Paciente concede consentimento a um profissional para uma especialidade.
   * Valida: (1) o grantee existe; (2) o paciente tem vinculo ATIVO na
   * especialidade (nao se pode compartilhar dado que nao se tem). Bloqueia
   * duplicata ATIVA (409); reabre a linha se havia consentimento REVOKED.
   */
  async grantConsent(
    authorization: string | undefined,
    input: GrantConsentInput,
  ): Promise<ConsentView> {
    const { patientProfileId } = await this.requirePatient(authorization);

    const granteeExists = await this.consents.professionalExists(
      input.granteeProfessionalProfileId,
    );
    if (!granteeExists) {
      throw new NotFoundError('Profissional (grantee) nao encontrado.');
    }

    const hasBond = await this.consents.hasActiveBondInSpecialty(
      patientProfileId,
      input.specialtyId,
    );
    if (!hasBond) {
      throw new ConsentRequiresActiveBondError();
    }

    const existing = await this.consents.findConsent(
      patientProfileId,
      input.granteeProfessionalProfileId,
      input.specialtyId,
    );
    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new ConsentAlreadyExistsError();
      }
      // Reconcessao apos revogacao: reabre a MESMA linha (default documentado).
      return toView(await this.consents.reopenConsent(existing.id));
    }

    return toView(
      await this.consents.createConsent({
        patientProfileId,
        granteeProfessionalProfileId: input.granteeProfessionalProfileId,
        specialtyId: input.specialtyId,
      }),
    );
  }

  /** Paciente lista os proprios consentimentos (ATIVOS + historico revogado). */
  async listConsents(authorization: string | undefined): Promise<ConsentView[]> {
    const { patientProfileId } = await this.requirePatient(authorization);
    const consents = await this.consents.listConsents(patientProfileId);
    return consents.map(toView);
  }

  /** Paciente revoga um consentimento ATIVO seu (ACTIVE -> REVOKED). */
  async revokeConsent(authorization: string | undefined, consentId: string): Promise<void> {
    const { patientProfileId } = await this.requirePatient(authorization);
    const revoked = await this.consents.revokeConsent(patientProfileId, consentId);
    if (!revoked) {
      throw new NotFoundError('Consentimento ativo nao encontrado.');
    }
  }

  /**
   * Ponto de aplicacao FUTURO (D-016): outras slices chamarao isto antes de
   * qualquer leitura cruzada de dados do paciente. Nao ha endpoint de leitura
   * cruzada ainda — este e o gancho de enforcement (esqueleto).
   */
  hasActiveConsent(
    patientProfileId: string,
    granteeProfessionalProfileId: string,
    specialtyId: string,
  ): Promise<boolean> {
    return this.consents.hasActiveConsent(
      patientProfileId,
      granteeProfessionalProfileId,
      specialtyId,
    );
  }

  /** Guard: Bearer valido + a conta possui perfil de paciente (D-016). */
  private async requirePatient(
    authorization: string | undefined,
  ): Promise<{ patientProfileId: string }> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const patient = await this.consents.findPatientProfile(ctx.accountId);
    if (!patient) {
      throw new ForbiddenError('Requer um perfil de paciente.');
    }
    return patient;
  }
}
