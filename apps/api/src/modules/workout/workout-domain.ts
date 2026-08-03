import type { PlanOrganization, Weekday } from '@fitvo/database';

import {
  PlanOrganizationMismatchError,
  SupersetSetCountMismatchError,
} from '../../shared/http-errors';

/**
 * REGRAS DE DOMÍNIO da prescrição de treino (ADR-0009). Funções PURAS, sem I/O:
 * são as invariantes que o banco não expressa e que o ADR chama de "invariante
 * de domínio, não do banco" — e por isso precisam de um lugar próprio, testável
 * sem Postgres e reusável por qualquer superfície (HTTP hoje, sync amanhã).
 *
 * O que mora aqui: coerência plano↔treino (D-080), contagem de séries num
 * conjugado (D-082), derivação da validade (D-083) e a regra de aderência do
 * plano fixo (D-105).
 */

/** Dias em que um plano fixo vale; lista vazia = TODO DIA (D-105). */
export interface PlanFixedSchedule {
  isFixed: boolean;
  fixedWeekdays: Weekday[];
}

/**
 * D-105 — plano FIXO não conta na aderência.
 *
 * A aderência (D-092) responde "o aluno fez o treino de hoje?". Um plano fixo
 * (alongamento/mobilidade) roda POR CIMA dos demais e não compete pelo tempo do
 * aluno: contá-lo faria o alongamento inflar o indicador de quem não treinou —
 * exatamente o efeito que o D-105 nomeia como o motivo de a distinção não ser
 * cosmética.
 *
 * Derivada, nunca armazenada: uma coluna "contaNaAderência" poderia divergir do
 * `isFixed` e criaria dois estados para uma pergunta só.
 */
export function planCountsTowardAdherence(plan: { isFixed: boolean }): boolean {
  return !plan.isFixed;
}

/**
 * D-105 — em que dias um plano fixo se aplica. Lista vazia = todo dia (o caso
 * comum e o default seguro). Plano variável não responde a esta pergunta: quem
 * carrega o dia lá é o TREINO (`Workout.weekday` — D-080).
 */
export function planAppliesOnWeekday(plan: PlanFixedSchedule, day: Weekday): boolean {
  if (!plan.isFixed) {
    return false;
  }
  return plan.fixedWeekdays.length === 0 || plan.fixedWeekdays.includes(day);
}

/**
 * D-083 — validade do plano. 30 dias por padrão, configurável; o vencimento é
 * contado a partir de QUANDO O PLANO PASSA A VALER: `releaseAt` quando há
 * liberação programada (D-084), senão o instante de referência (criação/
 * liberação imediata). Contar da criação num plano programado para daqui a 60
 * dias entregaria um plano já vencido ao aluno.
 *
 * UTC sempre (D-067) — a conversão para o fuso do usuário é só exibição.
 */
export function deriveValidUntil(input: {
  validityDays: number;
  releaseAt: Date | null;
  referenceAt: Date;
}): Date {
  const start = input.releaseAt ?? input.referenceAt;
  return new Date(start.getTime() + input.validityDays * 24 * 60 * 60 * 1000);
}

/**
 * D-080 — a organização é do PLANO e diz qual campo do treino vale: LETTER usa
 * `label` (A/B/C, executado na ordem que o aluno quiser); WEEKDAY usa `weekday`
 * (dia marcado). As duas colunas existem em `Workout`; só o plano diz qual é a
 * verdadeira, e preencher a errada deixaria um treino que não aparece em lugar
 * nenhum.
 *
 * Devolve o par normalizado a persistir — o campo da outra organização é
 * forçado a `null`, para que não sobre resíduo de uma troca de organização.
 */
export function resolveWorkoutSlot(input: {
  organization: PlanOrganization;
  label: string | null;
  weekday: Weekday | null;
}): { label: string | null; weekday: Weekday | null } {
  if (input.organization === 'LETTER') {
    if (input.weekday !== null) {
      throw new PlanOrganizationMismatchError(
        'Plano organizado por LETRA (A/B/C) nao aceita dia da semana no treino (D-080).',
      );
    }
    if (input.label === null) {
      throw new PlanOrganizationMismatchError(
        'Plano organizado por LETRA exige `label` (A/B/C) no treino (D-080).',
      );
    }
    return { label: input.label, weekday: null };
  }

  if (input.label !== null) {
    throw new PlanOrganizationMismatchError(
      'Plano organizado por DIA DA SEMANA nao aceita `label` (A/B/C) no treino (D-080).',
    );
  }
  if (input.weekday === null) {
    throw new PlanOrganizationMismatchError(
      'Plano organizado por DIA DA SEMANA exige `weekday` no treino (D-080).',
    );
  }
  return { label: null, weekday: input.weekday };
}

/** Item de um treino, reduzido ao que a invariante de conjugado precisa (D-082). */
export interface SupersetPeer {
  id: string;
  supersetGroup: number | null;
  setCount: number;
}

function groupItems(items: SupersetPeer[]): Map<number, SupersetPeer[]> {
  const byGroup = new Map<number, SupersetPeer[]>();
  for (const item of items) {
    if (item.supersetGroup === null) {
      continue;
    }
    const peers = byGroup.get(item.supersetGroup) ?? [];
    peers.push(item);
    byGroup.set(item.supersetGroup, peers);
  }
  return byGroup;
}

/**
 * D-082 — INVARIANTE DO CONJUGADO: todos os itens do mesmo `supersetGroup` têm
 * a mesma contagem de séries.
 *
 * O motivo é executável, não estético: "3 rodadas de A+B+C" significa que cada
 * item do grupo tem 3 séries e a **rodada N é a série de ordem N** de cada um
 * (por isso o ADR rejeitou um `roundCount`). Se A tem 3 séries e B tem 2, a
 * rodada 3 não existe para B e o circuito não fecha.
 *
 * ITEM COM ZERO SÉRIES É IGNORADO AQUI — e isso é a decisão, não um furo: um
 * bi-set se monta em passos (adiciono o item B ao grupo, DEPOIS prescrevo as
 * séries dele), e um item recém-adicionado nasce vazio. Barrar o zero durante a
 * montagem tornaria impossível construir o grupo pela API. O zero é cobrado no
 * momento em que o plano deixa de ser rascunho — ver
 * `assertSupersetGroupsComplete`.
 *
 * Chamada nos dois pontos que podem quebrá-la em edição: ao trocar as séries de
 * um item e ao mover um item para dentro/fora de um grupo.
 */
export function assertSupersetSetCounts(items: SupersetPeer[]): void {
  for (const [group, peers] of groupItems(items)) {
    const counts = new Set(peers.filter((peer) => peer.setCount > 0).map((peer) => peer.setCount));
    if (counts.size > 1) {
      throw new SupersetSetCountMismatchError(
        `Conjugado ${group}: os itens tem contagens de series diferentes (${[...counts]
          .sort((a, b) => a - b)
          .join(', ')}). A rodada N e a serie de ordem N de cada item (D-082).`,
      );
    }
  }
}

/**
 * D-082 no momento da LIBERAÇÃO: além de as contagens baterem, nenhum item do
 * grupo pode estar sem série. O que é rascunho aceitável durante a montagem
 * (item ainda vazio) não pode chegar ao aluno — um circuito com um exercício
 * sem série nenhuma não é executável.
 */
export function assertSupersetGroupsComplete(items: SupersetPeer[]): void {
  assertSupersetSetCounts(items);
  for (const [group, peers] of groupItems(items)) {
    if (peers.some((peer) => peer.setCount === 0)) {
      throw new SupersetSetCountMismatchError(
        `Conjugado ${group}: ha item sem serie prescrita — um conjugado incompleto ` +
          'nao e executavel pelo aluno (D-082).',
      );
    }
  }
}
