'use client';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Icon,
  Select,
  Skeleton,
  Tooltip,
} from '@fitvo/ui-web';
import { Dumbbell, Plus, Video } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { ExerciseFormModal } from '@/components/library/exercise-form-modal';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { useExercises, useMuscleGroups } from '@/data/hooks';
import type { ExerciseLibraryExerciseView, ExerciseLibraryListQuery } from '@/data/types';
import { VISIBILITY_LABEL } from '@/lib/workout-labels';

const ALL_GROUPS = 'ALL';

function ExerciseCard({ exercise }: { readonly exercise: ExerciseLibraryExerciseView }): ReactNode {
  const isDiscontinued = exercise.status === 'DISCONTINUED';
  return (
    <Card className={`flex h-full flex-col gap-3 ${isDiscontinued ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-body text-body font-medium text-fg">{exercise.name}</span>
        {exercise.videoStorageKey !== null ? (
          <Tooltip content="Tem vídeo demonstrativo" side="left">
            <span className="shrink-0">
              <Icon icon={Video} size="sm" />
            </span>
          </Tooltip>
        ) : null}
      </div>

      {exercise.description !== null ? (
        <p className="line-clamp-2 text-small text-fg-muted">{exercise.description}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Badge variant="training">{exercise.primaryMuscleGroup.name}</Badge>
        {exercise.secondaryMuscleGroups.map((group) => (
          <Badge key={group.id} variant="neutral">
            {group.name}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-line pt-3">
        {/* PLATFORM x PRIVATE (D-168/D-171): o profissional precisa distinguir o
            que e base comum do que e acervo dele — a origem muda o que ele pode
            esperar do item. */}
        <Badge variant={exercise.visibility === 'PLATFORM' ? 'info' : 'brand'}>
          {VISIBILITY_LABEL[exercise.visibility]}
        </Badge>
        {isDiscontinued ? <Badge variant="warning">Descontinuado</Badge> : null}
      </div>
    </Card>
  );
}

function LibrarySkeleton(): ReactNode {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <Card key={index} className="flex flex-col gap-3">
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="rect" width={120} height={22} />
        </Card>
      ))}
    </div>
  );
}

export default function BibliotecaPage(): ReactNode {
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState(ALL_GROUPS);
  const [includeDiscontinued, setIncludeDiscontinued] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const groupsQuery = useMuscleGroups();

  // A query vai para a chave de cache: montar o objeto de forma estavel evita
  // refetch a cada tecla por identidade nova.
  const query = useMemo<ExerciseLibraryListQuery>(
    () => ({
      ...(search.trim() === '' ? {} : { search: search.trim() }),
      ...(groupId === ALL_GROUPS ? {} : { muscleGroupId: groupId }),
      ...(includeDiscontinued ? { includeDiscontinued: true } : {}),
    }),
    [search, groupId, includeDiscontinued],
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
  const platformCount = exercises.filter((e) => e.visibility === 'PLATFORM').length;
  const privateCount = exercises.length - platformCount;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Biblioteca de exercícios"
        description="A base compartilhada da FITVO mais os exercícios do seu acervo."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Icon icon={Plus} size="sm" />
            Novo exercício
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Buscar exercício"
          aria-label="Buscar exercício"
          className="lg:w-80"
        />
        <div className="lg:w-56">
          <Select
            options={groupOptions}
            value={groupId}
            onValueChange={setGroupId}
            aria-label="Filtrar por grupo muscular"
            disabled={groupsQuery.isLoading}
          />
        </div>
        {/* D-089: a delecao e LOGICA. O item descontinuado some por padrao mas
            continua no historico — a tela da propria biblioteca e o lugar onde
            ele precisa poder reaparecer. */}
        <Checkbox
          checked={includeDiscontinued}
          onChange={(event) => setIncludeDiscontinued(event.target.checked)}
        >
          Mostrar descontinuados
        </Checkbox>
      </div>

      {exercisesQuery.isError ? (
        <ErrorState
          title="Não foi possível carregar a biblioteca"
          message="Tente novamente em instantes."
          onRetry={() => void exercisesQuery.refetch()}
        />
      ) : exercisesQuery.isLoading ? (
        <LibrarySkeleton />
      ) : exercises.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Dumbbell} size="lg" />}
          title="Nenhum exercício encontrado"
          description="Ajuste a busca e os filtros, ou crie um exercício no seu acervo."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Icon icon={Plus} size="sm" />
              Novo exercício
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-small text-fg-subtle">
            {exercises.length} exercício{exercises.length === 1 ? '' : 's'} · {platformCount} da
            base FITVO · {privateCount} do seu acervo
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {exercises.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>
        </>
      )}

      <ExerciseFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        muscleGroups={groupsQuery.data?.muscleGroups ?? []}
      />
    </div>
  );
}
