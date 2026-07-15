import type { Cents, SplitRule } from './index';

/**
 * Monta as regras de split de uma cobranca do Fluxo B (D-018/D-050 — ADR-0004).
 * O dinheiro NUNCA passa pela conta do FITVO: a cobranca e emitida e o Asaas
 * repassa a taxa da plataforma para a wallet do FITVO via split; o restante fica
 * na subconta do profissional (a wallet primaria da cobranca). Modelamos aqui
 * apenas a(s) parte(s) desviada(s) por split — a regra do FITVO — de forma pura
 * e testavel, sem tocar em HTTP.
 *
 * Regras (documentadas):
 * - `platformFeeCents` (>0) vira um split de VALOR FIXO para `platformWalletId`.
 *   A taxa e sempre inteira em centavos (D-069).
 * - Se `platformWalletId` for ausente (GATED — a wallet do FITVO vem de config e
 *   pode nao estar disponivel sem credenciais Asaas), nenhum split e emitido: a
 *   cobranca ainda e criada, a taxa fica capturada como DADO no Charge, e a
 *   conciliacao real fica para o onboarding LIVE. Documentado, nao inventado.
 * - Fee <= 0 tambem nao gera split (nada a desviar).
 */
export function buildChargeSplits(params: {
  professionalWalletId?: string | null;
  platformWalletId?: string | null;
  platformFeeCents: Cents;
}): SplitRule[] {
  const { platformWalletId, platformFeeCents } = params;
  if (!platformWalletId || platformFeeCents <= 0) {
    return [];
  }
  return [{ walletId: platformWalletId, fixedAmount: platformFeeCents }];
}

/**
 * Calcula a taxa da plataforma (centavos inteiros) a partir do valor bruto e da
 * taxa em BASIS POINTS (1 bp = 0,01%). Arredonda para o centavo mais proximo —
 * nunca float no resultado (D-069). Ex.: 10000 centavos a 500 bp = 500 centavos.
 */
export function computePlatformFeeCents(amountCents: Cents, feeBasisPoints: number): Cents {
  if (feeBasisPoints <= 0 || amountCents <= 0) {
    return 0;
  }
  return Math.round((amountCents * feeBasisPoints) / 10_000);
}
