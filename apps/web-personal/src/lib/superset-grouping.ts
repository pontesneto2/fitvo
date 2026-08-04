import type { WorkoutItemView } from '@/data/types';

/**
 * Agrupamento de CONJUGADOS (D-082) para exibição.
 *
 * O contrato guarda o vínculo em dois campos por item (`supersetGroup` agrupa,
 * `supersetOrder` ordena dentro do grupo) — não numa entidade "grupo". Montar a
 * árvore de exibição é, portanto, trabalho da tela, e vive aqui como função pura
 * em vez de dentro do JSX: assim dá para testá-la sem renderizar nada.
 *
 * Regras que a função respeita, todas vindas do contrato:
 * - Item sem `supersetGroup` é solo.
 * - Itens do MESMO grupo saem juntos, ordenados por `supersetOrder`.
 * - O bloco do conjugado ocupa a posição do PRIMEIRO item dele; o resto da lista
 *   mantém a ordem de `position`. Sem isso o conjugado "pularia" para o fim.
 * - Um grupo com um único item continua sendo grupo — o profissional acabou de
 *   criar o conjugado e ainda vai adicionar o segundo exercício; escondê-lo
 *   faria o agrupamento sumir na frente dele.
 */
export type WorkoutItemBlock =
  | { readonly kind: 'single'; readonly item: WorkoutItemView }
  | {
      readonly kind: 'superset';
      readonly group: number;
      readonly items: readonly WorkoutItemView[];
    };

export function groupWorkoutItems(items: readonly WorkoutItemView[]): readonly WorkoutItemBlock[] {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const blocks: WorkoutItemBlock[] = [];
  // Os itens do grupo são acumulados à parte e só depois entram no bloco: o
  // bloco reservou o lugar na primeira aparição do grupo, e é esse lugar que
  // preserva a ordem do treino.
  const membersByGroup = new Map<number, WorkoutItemView[]>();

  for (const item of ordered) {
    if (item.supersetGroup === null) {
      blocks.push({ kind: 'single', item });
      continue;
    }

    const members = membersByGroup.get(item.supersetGroup);
    if (members === undefined) {
      membersByGroup.set(item.supersetGroup, [item]);
      blocks.push({ kind: 'superset', group: item.supersetGroup, items: [] });
    } else {
      members.push(item);
    }
  }

  return blocks.map((block) =>
    block.kind === 'superset'
      ? {
          ...block,
          items: [...(membersByGroup.get(block.group) ?? [])].sort(
            (a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0),
          ),
        }
      : block,
  );
}

/** Próximo número de grupo livre — o conjugado novo não pode reusar um em uso. */
export function nextSupersetGroup(items: readonly WorkoutItemView[]): number {
  const used = items
    .map((item) => item.supersetGroup)
    .filter((group): group is number => group !== null);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}
