'use client';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Modal,
  Select,
  Skeleton,
} from '@fitvo/ui-web';
import { Dumbbell } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { SearchInput } from '@/components/search-input';
import { useExercises, useMuscleGroups } from '@/data/hooks';
import type { ExerciseLibraryListQuery } from '@/data/types';
import { VISIBILITY_LABEL } from '@/lib/workout-labels';

const ALL_GROUPS = 'ALL';

/**
 * Escolha do exercicio da biblioteca (D-089) ao montar o treino. Le a MESMA
 * fonte da tela de biblioteca — o profissional nao deve encontrar aqui um
 * acervo diferente do que administra la.
 *
 * Descontinuado nao aparece: o item continua valendo no historico, mas
 * prescrever um exercicio que a academia tirou de circulacao seria criar
 * dado ruim novo.
 */
export interface ExercisePickerModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSelect: (exerciseId: string) => void;
  readonly busy?: boolean;
}

export function ExercisePickerModal({
  open,
  onClose,
  onSelect,
  busy = false,
}: ExercisePickerModalProps): ReactNode {
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState(ALL_GROUPS);

  const groupsQuery = useMuscleGroups();
  const query = useMemo<ExerciseLibraryListQuery>(
    () => ({
      ...(search.trim() === '' ? {} : { search: search.trim() }),
      ...(groupId === ALL_GROUPS ? {} : { muscleGroupId: groupId }),
    }),
    [search, groupId],
  );
  const exercisesQuery = useExercises(query);

  const groupOptions = useMemo(
    () => [
      { value: ALL_GROUPS, label: 'Todos os grupos' },
      ...(groupsQuery.data?.muscleGroups ?? []).map((group) => ({
        value: group.id,
        label: group.name,
      })),
    ],
    [groupsQuery.data],
  );

  const exercises = exercisesQuery.data?.exercises ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Adicionar exercício" size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar na biblioteca"
            aria-label="Buscar exercício na biblioteca"
            className="flex-1"
          />
          <div className="sm:w-52">
            <Select
              options={groupOptions}
              value={groupId}
              onValueChange={setGroupId}
              aria-label="Filtrar por grupo muscular"
              disabled={groupsQuery.isLoading}
            />
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {exercisesQuery.isError ? (
            <ErrorState
              title="Não foi possível carregar a biblioteca"
              message="Tente novamente em instantes."
              onRetry={() => void exercisesQuery.refetch()}
            />
          ) : exercisesQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} variant="rect" height={56} />
              ))}
            </div>
          ) : exercises.length === 0 ? (
            <EmptyState
              icon={<Icon icon={Dumbbell} size="lg" />}
              title="Nenhum exercício encontrado"
              description="Ajuste a busca ou crie o exercício na sua biblioteca."
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {exercises.map((exercise) => (
                <li key={exercise.id}>
                  <Button
                    variant="ghost"
                    onClick={() => onSelect(exercise.id)}
                    disabled={busy}
                    className="h-auto w-full justify-between gap-3 py-3 text-left"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-medium text-fg">{exercise.name}</span>
                      <span className="text-caption text-fg-subtle">
                        {exercise.primaryMuscleGroup.name}
                      </span>
                    </span>
                    <Badge variant={exercise.visibility === 'PLATFORM' ? 'info' : 'brand'}>
                      {VISIBILITY_LABEL[exercise.visibility]}
                    </Badge>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
