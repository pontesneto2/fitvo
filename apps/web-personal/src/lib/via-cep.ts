import { BRAZILIAN_STATES } from '@/lib/auth';

/**
 * Cliente do ViaCEP (ADR-0015) — auto-preenchimento do endereço a partir do
 * CEP. É UX, não gate: qualquer falha (CEP não encontrado, rede fora, resposta
 * inesperada) devolve `null` e o formulário segue com preenchimento manual —
 * nunca trava o cadastro. O número/complemento são sempre manuais.
 */

type BrazilianState = (typeof BRAZILIAN_STATES)[number];

export interface CepAddress {
  readonly logradouro: string;
  readonly bairro: string;
  readonly cidade: string;
  /** UF só quando o ViaCEP devolve uma das 27 UFs conhecidas; senão fica manual. */
  readonly uf: BrazilianState | null;
}

interface ViaCepResponse {
  readonly logradouro?: string;
  readonly bairro?: string;
  readonly localidade?: string;
  readonly uf?: string;
  readonly erro?: boolean;
}

function toBrazilianState(uf: string | undefined): BrazilianState | null {
  return uf && (BRAZILIAN_STATES as readonly string[]).includes(uf) ? (uf as BrazilianState) : null;
}

/** Busca o endereço de um CEP (8 dígitos). `null` em qualquer falha — não trava. */
export async function fetchAddressByCep(cep: string): Promise<CepAddress | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache: 'no-store' });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) {
      return null;
    }
    return {
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      cidade: data.localidade ?? '',
      uf: toBrazilianState(data.uf),
    };
  } catch {
    return null;
  }
}
