import { describe, expect, it } from 'vitest';

import type { WorkoutItemView } from '@/data/types';

import { groupWorkoutItems, nextSupersetGroup } from './superset-grouping';

function item(
  id: string,
  position: number,
  supersetGroup: number | null = null,
  supersetOrder: number | null = null,
): WorkoutItemView {
  return {
    id,
    workoutId: 'w-1',
    exerciseId: `ex-${id}`,
    position,
    supersetGroup,
    supersetOrder,
    note: null,
    sets: [],
  };
}

describe('groupWorkoutItems (D-082)', () => {
  it('item sem grupo sai solo, na ordem de position', () => {
    const blocks = groupWorkoutItems([item('b', 1), item('a', 0)]);
    expect(blocks.map((block) => (block.kind === 'single' ? block.item.id : null))).toEqual([
      'a',
      'b',
    ]);
  });

  it('agrupa itens do mesmo conjugado e os ordena por supersetOrder', () => {
    const blocks = groupWorkoutItems([item('x', 0, 1, 1), item('y', 1, 1, 0)]);
    expect(blocks).toHaveLength(1);
    const block = blocks[0];
    if (block === undefined || block.kind !== 'superset') {
      throw new Error('esperado bloco de conjugado');
    }
    expect(block.group).toBe(1);
    expect(block.items.map((i) => i.id)).toEqual(['y', 'x']);
  });

  it('o bloco do conjugado ocupa a posicao do PRIMEIRO item dele', () => {
    // Se o bloco fosse empilhado no fim, o conjugado "pularia" na tela para
    // depois de exercicios que vem depois dele no treino.
    const blocks = groupWorkoutItems([
      item('solo-1', 0),
      item('sup-a', 1, 2, 0),
      item('solo-2', 2),
      item('sup-b', 3, 2, 1),
    ]);
    expect(blocks.map((b) => (b.kind === 'superset' ? `grupo-${b.group}` : b.item.id))).toEqual([
      'solo-1',
      'grupo-2',
      'solo-2',
    ]);
  });

  it('conjugado com um unico item continua sendo bloco de conjugado', () => {
    const blocks = groupWorkoutItems([item('only', 0, 3, 0)]);
    expect(blocks[0]?.kind).toBe('superset');
  });

  it('grupos distintos nao se misturam', () => {
    const blocks = groupWorkoutItems([item('a', 0, 1, 0), item('b', 1, 2, 0), item('c', 2, 1, 1)]);
    expect(blocks).toHaveLength(2);
    const first = blocks[0];
    if (first === undefined || first.kind !== 'superset') {
      throw new Error('esperado conjugado');
    }
    expect(first.items.map((i) => i.id)).toEqual(['a', 'c']);
  });
});

describe('nextSupersetGroup', () => {
  it('comeca em 1 quando nao ha conjugado', () => {
    expect(nextSupersetGroup([item('a', 0)])).toBe(1);
  });

  it('nunca reusa um numero de grupo em uso', () => {
    expect(nextSupersetGroup([item('a', 0, 1, 0), item('b', 1, 4, 0)])).toBe(5);
  });
});
