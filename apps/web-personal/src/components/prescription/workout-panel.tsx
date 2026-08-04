'use client';

import { Badge, Button, EmptyState, Icon } from '@fitvo/ui-web';
import { Dumbbell, Plus } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { useExerciseIndex } from '@/data/hooks';
import type { WorkoutItemView, WorkoutReplaceSetsInput, WorkoutView } from '@/data/types';
import { groupWorkoutItems, nextSupersetGroup } from '@/lib/superset-grouping';

import { ExercisePickerModal } from './exercise-picker-modal';
import { WorkoutItemCard } from './workout-item-card';

/**
 * Um TREINO do plano: a lista de exercícios, com os conjugados desenhados como
 * um bloco só.
 *
 * O conjugado (D-082) recebe moldura própria e numeração de rodada porque ele é
 * uma unidade de execução: os itens são feitos em sequência, sem pausa entre
 * eles, e a "série 2" é a segunda RODADA do conjunto — não a segunda série de um
 * exercício isolado. Listá-los como itens soltos perderia exatamente isso.
 */
export interface WorkoutPanelProps {
  readonly workout: WorkoutView;
  readonly savingSets: boolean;
  readonly addingItem: boolean;
  readonly onAddItem: (workoutId: string, exerciseId: string) => void;
  readonly onRemoveItem: (itemId: string) => void;
  readonly onChangeNote: (itemId: string, note: string | null) => void;
  readonly onSaveSets: (itemId: string, input: WorkoutReplaceSetsInput) => void;
  readonly onSetSuperset: (
    itemId: string,
    superset: { group: number | null; order: number | null },
  ) => void;
}

export function WorkoutPanel({
  workout,
  savingSets,
  addingItem,
  onAddItem,
  onRemoveItem,
  onChangeNote,
  onSaveSets,
  onSetSuperset,
}: WorkoutPanelProps): ReactNode {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { index, isLoading: exercisesLoading } = useExerciseIndex();

  const blocks = groupWorkoutItems(workout.items);
  const ordered = [...workout.items].sort((a, b) => a.position - b.position);

  /**
   * Conjugar = juntar este item com o PRÓXIMO da lista. Se ele já está num
   * conjugado, sai dele. `supersetGroup` e `supersetOrder` andam sempre juntos
   * (D-082) — nunca um sem o outro.
   */
  function toggleSuperset(itemId: string): void {
    const item = ordered.find((entry) => entry.id === itemId);
    if (item === undefined) return;

    if (item.supersetGroup !== null) {
      onSetSuperset(itemId, { group: null, order: null });
      return;
    }

    const next = ordered[ordered.findIndex((entry) => entry.id === itemId) + 1];
    if (next === undefined) return;

    // Se o vizinho já está num conjugado, este item entra NELE em vez de abrir
    // um grupo novo que ficaria com um item só ao lado de outro.
    const group = next.supersetGroup ?? nextSupersetGroup(workout.items);
    const order =
      next.supersetGroup === null
        ? 0
        : Math.max(
            ...workout.items
              .filter((entry) => entry.supersetGroup === group)
              .map((entry) => entry.supersetOrder ?? 0),
          ) + 1;

    onSetSuperset(itemId, { group, order });
    if (next.supersetGroup === null) onSetSuperset(next.id, { group, order: 1 });
  }

  function renderItem(item: WorkoutItemView, isSuperset: boolean, isLast: boolean): ReactNode {
    return (
      <WorkoutItemCard
        key={item.id}
        item={item}
        exercise={item.exerciseId === null ? undefined : index.get(item.exerciseId)}
        exerciseLoading={exercisesLoading}
        isSuperset={isSuperset}
        isLastOfSuperset={isLast}
        savingSets={savingSets}
        onSaveSets={onSaveSets}
        onChangeNote={onChangeNote}
        onRemove={onRemoveItem}
        onToggleSuperset={toggleSuperset}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {workout.items.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Dumbbell} size="lg" />}
          title="Treino sem exercícios"
          description="Adicione o primeiro exercício da biblioteca para começar a prescrever."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              <Icon icon={Plus} size="sm" />
              Adicionar exercício
            </Button>
          }
        />
      ) : (
        <>
          {blocks.map((block) =>
            block.kind === 'single' ? (
              renderItem(block.item, false, false)
            ) : (
              <div
                key={`superset-${block.group}`}
                className="flex flex-col gap-3 rounded-lg border-l-[3px] border-lime-500 bg-lime-50/40 p-3 dark:bg-neutral-800"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="training">Conjugado</Badge>
                  <span className="text-caption text-fg-subtle">
                    {block.items.length} exercício{block.items.length === 1 ? '' : 's'} em sequência
                    · cada série é uma rodada
                  </span>
                </div>
                {block.items.map((item, position) =>
                  renderItem(item, true, position === block.items.length - 1),
                )}
              </div>
            ),
          )}

          <div>
            <Button variant="secondary" onClick={() => setPickerOpen(true)}>
              <Icon icon={Plus} size="sm" />
              Adicionar exercício
            </Button>
          </div>
        </>
      )}

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        busy={addingItem}
        onSelect={(exerciseId) => {
          onAddItem(workout.id, exerciseId);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
