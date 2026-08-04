'use client';

import { Badge, Button, Card, Icon, Input, Tooltip } from '@fitvo/ui-web';
import { Link2, Link2Off, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type {
  ExerciseLibraryExerciseView,
  WorkoutItemView,
  WorkoutReplaceSetsInput,
} from '@/data/types';

import { SetEditor } from './set-editor';

/**
 * Um EXERCÍCIO do treino: cabeçalho (nome vindo da biblioteca, observação,
 * ações) mais o editor de série-linha.
 *
 * O nome NÃO é copiado para o item quando ele é criado — o contrato guarda só o
 * `exerciseId` (D-089) e a tela resolve pelo índice da biblioteca. Copiar o
 * texto no momento da prescrição congelaria o nome antigo quando o exercício
 * fosse renomeado.
 */
export interface WorkoutItemCardProps {
  readonly item: WorkoutItemView;
  readonly exercise: ExerciseLibraryExerciseView | undefined;
  readonly exerciseLoading: boolean;
  readonly isSuperset: boolean;
  readonly isLastOfSuperset: boolean;
  readonly savingSets: boolean;
  readonly onSaveSets: (itemId: string, input: WorkoutReplaceSetsInput) => void;
  readonly onChangeNote: (itemId: string, note: string | null) => void;
  readonly onRemove: (itemId: string) => void;
  readonly onToggleSuperset: (itemId: string) => void;
}

export function WorkoutItemCard({
  item,
  exercise,
  exerciseLoading,
  isSuperset,
  isLastOfSuperset,
  savingSets,
  onSaveSets,
  onChangeNote,
  onRemove,
  onToggleSuperset,
}: WorkoutItemCardProps): ReactNode {
  const [note, setNote] = useState(item.note ?? '');

  const title = exercise?.name ?? (exerciseLoading ? 'Carregando…' : 'Exercício livre');

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-body font-medium text-fg">{title}</span>
            {exercise?.status === 'DISCONTINUED' ? (
              <Tooltip content="Este exercício foi descontinuado na biblioteca" side="top">
                <Badge variant="warning">Descontinuado</Badge>
              </Tooltip>
            ) : null}
          </div>
          {exercise !== undefined ? (
            <span className="text-caption text-fg-subtle">
              {exercise.primaryMuscleGroup.name}
              {exercise.secondaryMuscleGroups.length > 0
                ? ` · ${exercise.secondaryMuscleGroups.map((group) => group.name).join(', ')}`
                : ''}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-1">
          <Tooltip
            content={isSuperset ? 'Tirar do conjugado' : 'Conjugar com o próximo'}
            side="top"
          >
            <Button
              variant="ghost"
              size="sm"
              aria-label={isSuperset ? 'Tirar do conjugado' : 'Conjugar com o próximo'}
              onClick={() => onToggleSuperset(item.id)}
            >
              <Icon icon={isSuperset ? Link2Off : Link2} size="sm" />
            </Button>
          </Tooltip>
          <Tooltip content="Remover exercício" side="top">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remover ${title}`}
              onClick={() => onRemove(item.id)}
            >
              <Icon icon={Trash2} size="sm" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <Input
        aria-label={`Observação de ${title}`}
        placeholder="Observação para o aluno (opcional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => {
          const next = note.trim() === '' ? null : note.trim();
          if (next !== item.note) onChangeNote(item.id, next);
        }}
      />

      <SetEditor
        key={item.sets.map((set) => set.id).join('|')}
        sets={item.sets}
        saving={savingSets}
        isSuperset={isSuperset}
        isLastOfSuperset={isLastOfSuperset}
        onSave={(input) => onSaveSets(item.id, input)}
      />
    </Card>
  );
}
