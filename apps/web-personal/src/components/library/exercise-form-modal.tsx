'use client';

import {
  Badge,
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@fitvo/ui-web';
import { exerciseLibraryCreateExerciseSchema } from '@fitvo/validation';
import { type ReactNode, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useCreateExercise } from '@/data/hooks';
import type { ExerciseLibraryMuscleGroupView } from '@/data/types';
import { zodResolver } from '@/lib/zod-resolver';

/**
 * Criacao de exercicio (contrato #131). Valida com o MESMO schema Zod que a API
 * usa (`exerciseLibraryCreateExerciseSchema`) — nao com uma copia local das
 * regras; uma copia e exatamente o jeito de a tela aceitar o que o servidor
 * recusa.
 *
 * `visibility` nao aparece no formulario de proposito: item de profissional
 * nasce SEMPRE PRIVATE (D-170) e o proprio contrato nao aceita o campo.
 */
interface FormValues {
  name: string;
  primaryMuscleGroupId: string;
  secondaryMuscleGroupIds?: string[];
  description?: string;
}

export interface ExerciseFormModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly muscleGroups: readonly ExerciseLibraryMuscleGroupView[];
  /** Chamado com o exercicio resultante — criado OU o equivalente ja existente. */
  readonly onCreated?: (exerciseId: string) => void;
}

export function ExerciseFormModal({
  open,
  onClose,
  muscleGroups,
  onCreated,
}: ExerciseFormModalProps): ReactNode {
  const { toast } = useToast();
  const createExercise = useCreateExercise();
  const [secondary, setSecondary] = useState<readonly string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(exerciseLibraryCreateExerciseSchema as never),
    defaultValues: { name: '', primaryMuscleGroupId: '', description: '' },
  });

  const primaryId = watch('primaryMuscleGroupId');

  const options = useMemo(
    () => muscleGroups.map((group) => ({ value: group.id, label: group.name })),
    [muscleGroups],
  );

  function close(): void {
    reset();
    setSecondary([]);
    createExercise.reset();
    onClose();
  }

  function toggleSecondary(id: string): void {
    setSecondary((previous) => {
      const next = previous.includes(id)
        ? previous.filter((entry) => entry !== id)
        : [...previous, id];
      setValue('secondaryMuscleGroupIds', next);
      return next;
    });
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = await createExercise.mutateAsync({
      name: values.name,
      primaryMuscleGroupId: values.primaryMuscleGroupId,
      secondaryMuscleGroupIds: secondary.length > 0 ? [...secondary] : undefined,
      description: values.description === '' ? undefined : values.description,
    });

    // D-169: duplicata NAO e erro. O servidor devolve o item equivalente que ja
    // existe para o profissional usar — a tela precisa dizer isso, nao fingir
    // que criou nem tratar como falha.
    if (result.outcome === 'DUPLICATE_FOUND') {
      toast({
        variant: 'info',
        title: 'Esse exercício já existe',
        description: `"${result.exercise.name}" já está na sua biblioteca — use o item existente.`,
      });
    } else {
      toast({
        variant: 'success',
        title: 'Exercício criado',
        description: `"${result.exercise.name}" entrou no seu acervo.`,
      });
    }

    onCreated?.(result.exercise.id);
    close();
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Novo exercício"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={createExercise.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} loading={createExercise.isPending}>
            Criar exercício
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <Field label="Nome do exercício" required error={errors.name?.message}>
          <Input {...register('name')} placeholder="Ex.: Supino inclinado com halteres" />
        </Field>

        <Field
          label="Grupo muscular principal"
          required
          error={errors.primaryMuscleGroupId?.message}
        >
          <Select
            options={options}
            value={primaryId}
            onValueChange={(value) => setValue('primaryMuscleGroupId', value)}
            placeholder="Selecione o grupo principal"
            searchable
            searchPlaceholder="Buscar grupo"
            emptyLabel="Nenhum grupo encontrado"
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-body text-small font-medium text-fg">
            Grupos secundários
            <span className="ml-1 font-normal text-fg-subtle">(opcional)</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {muscleGroups
              .filter((group) => group.id !== primaryId)
              .map((group) => (
                <Checkbox
                  key={group.id}
                  checked={secondary.includes(group.id)}
                  onChange={() => toggleSecondary(group.id)}
                >
                  {group.name}
                </Checkbox>
              ))}
          </div>
        </fieldset>

        <Field
          label="Orientação de execução"
          description="Aparece para o aluno junto do exercício."
          error={errors.description?.message}
        >
          <Textarea {...register('description')} rows={3} />
        </Field>

        <p className="flex items-center gap-2 text-caption text-fg-subtle">
          <Badge variant="neutral">Meu acervo</Badge>
          Exercícios que você cria ficam visíveis só para você.
        </p>
      </form>
    </Modal>
  );
}
