'use client';

import { Badge, Button, Checkbox, Icon, Input, Select, Tooltip } from '@fitvo/ui-web';
import { workoutReplaceSetsSchema } from '@fitvo/validation';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import type { SetTechnique, WorkoutReplaceSetsInput, WorkoutSetView } from '@/data/types';
import {
  LOAD_KIND_LABEL,
  type LoadKind,
  loadKindOf,
  SET_TECHNIQUE_LABEL,
} from '@/lib/workout-labels';

/**
 * SÉRIE COMO LINHA (D-081). Cada série é uma linha independente com seus
 * próprios valores — não existe "3×12" nesta tela, e é de propósito: um plano de
 * 3 séries são 3 linhas que PODEM divergir entre si.
 *
 * Duas disciplinas do contrato aparecem direto na UI:
 *
 * - A POSIÇÃO é o índice da linha, não um campo editável. Arrastar/remover
 *   reindexa; "duas séries na mesma posição" é irrepresentável, como no contrato.
 * - A CARGA é UMA grandeza tipada por série (peso, tempo, distância ou peso
 *   corporal). O seletor de grandeza troca o campo — nunca deixa dois
 *   preenchidos, que é o que tornaria uma agregação futura somar gramas com
 *   segundos.
 *
 * A validação NÃO é reescrita aqui: o rascunho é convertido e passado pelo
 * `workoutReplaceSetsSchema` real antes de habilitar o salvar. Assim a tela
 * recusa exatamente o que a API recusaria.
 */

interface DraftSet {
  readonly key: string;
  readonly kind: LoadKind;
  readonly weightKg: string;
  readonly durationSeconds: string;
  readonly distanceMeters: string;
  readonly reps: string;
  readonly repsToFailure: boolean;
  readonly restSeconds: string;
  readonly technique: SetTechnique;
  readonly note: string;
}

let draftSequence = 0;
function nextKey(): string {
  draftSequence += 1;
  return `draft-${draftSequence}`;
}

function toDraft(set: WorkoutSetView): DraftSet {
  return {
    key: set.id,
    kind: loadKindOf(set),
    weightKg: set.weightGrams === null ? '' : String(set.weightGrams / 1000).replace('.', ','),
    durationSeconds: set.durationSeconds === null ? '' : String(set.durationSeconds),
    distanceMeters: set.distanceMeters === null ? '' : String(set.distanceMeters),
    reps: set.reps === null ? '' : String(set.reps),
    repsToFailure: set.repsToFailure,
    restSeconds: set.restSeconds === null ? '' : String(set.restSeconds),
    technique: set.technique,
    note: set.note ?? '',
  };
}

function emptyDraft(kind: LoadKind = 'WEIGHT'): DraftSet {
  return {
    key: nextKey(),
    kind,
    weightKg: '',
    durationSeconds: '',
    distanceMeters: '',
    reps: '',
    repsToFailure: false,
    restSeconds: '',
    technique: 'NORMAL',
    note: '',
  };
}

/** Aceita vírgula decimal (pt-BR) e devolve null para entrada não numérica. */
function parseDecimal(value: string): number | null {
  const cleaned = value.replace(',', '.').trim();
  if (cleaned === '') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string): number | null {
  const parsed = parseDecimal(value);
  return parsed === null ? null : Math.round(parsed);
}

/** Rascunho → corpo do contrato. Só a grandeza da `kind` escolhida é enviada. */
function toInput(draft: DraftSet): WorkoutReplaceSetsInput['sets'][number] {
  const kg = parseDecimal(draft.weightKg);
  return {
    reps: draft.repsToFailure ? undefined : (parseInteger(draft.reps) ?? undefined),
    repsToFailure: draft.repsToFailure,
    weightGrams: draft.kind === 'WEIGHT' && kg !== null ? Math.round(kg * 1000) : undefined,
    durationSeconds:
      draft.kind === 'DURATION' ? (parseInteger(draft.durationSeconds) ?? undefined) : undefined,
    distanceMeters:
      draft.kind === 'DISTANCE' ? (parseInteger(draft.distanceMeters) ?? undefined) : undefined,
    bodyweight: draft.kind === 'BODYWEIGHT',
    restSeconds: parseInteger(draft.restSeconds) ?? undefined,
    technique: draft.technique,
    note: draft.note.trim() === '' ? undefined : draft.note.trim(),
  };
}

const KIND_OPTIONS = (Object.keys(LOAD_KIND_LABEL) as LoadKind[]).map((kind) => ({
  value: kind,
  label: LOAD_KIND_LABEL[kind],
}));

const TECHNIQUE_OPTIONS = (Object.keys(SET_TECHNIQUE_LABEL) as SetTechnique[]).map((technique) => ({
  value: technique,
  label: SET_TECHNIQUE_LABEL[technique],
}));

export interface SetEditorProps {
  readonly sets: readonly WorkoutSetView[];
  readonly saving: boolean;
  readonly onSave: (input: WorkoutReplaceSetsInput) => void;
  /** Conjugado (D-082): a linha é a RODADA, e o descanso zera até o último item. */
  readonly isSuperset: boolean;
  readonly isLastOfSuperset: boolean;
}

export function SetEditor({
  sets,
  saving,
  onSave,
  isSuperset,
  isLastOfSuperset,
}: SetEditorProps): ReactNode {
  const [drafts, setDrafts] = useState<readonly DraftSet[]>(() => sets.map(toDraft));
  // O rascunho salvo vira a nova base de comparação; sem isso o botão "salvar"
  // continuaria aceso depois de salvar.
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(sets.map(toDraft)));

  const dirty = JSON.stringify(drafts) !== baseline;

  const validation = useMemo(() => {
    const payload = { sets: drafts.map(toInput) };
    const result = workoutReplaceSetsSchema.safeParse(payload);
    if (result.success) return { ok: true as const, payload: result.data };
    return {
      ok: false as const,
      // Primeira mensagem com o índice da linha: "erro na série 2" é acionável;
      // "erro no formulário" não é.
      message: result.error.issues
        .slice(0, 1)
        .map((issue) => {
          const index = typeof issue.path[1] === 'number' ? issue.path[1] + 1 : null;
          return index === null ? issue.message : `Série ${index}: ${issue.message}`;
        })
        .join(''),
    };
  }, [drafts]);

  function update(key: string, patch: Partial<DraftSet>): void {
    setDrafts((previous) =>
      previous.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
    );
  }

  function addSet(): void {
    setDrafts((previous) => {
      const last = previous[previous.length - 1];
      // A série nova herda a grandeza da anterior: trocar de kg para "tempo" a
      // cada linha adicionada seria trabalho manual repetido sem motivo.
      return [...previous, last === undefined ? emptyDraft() : emptyDraft(last.kind)];
    });
  }

  function duplicate(key: string): void {
    setDrafts((previous) => {
      const index = previous.findIndex((draft) => draft.key === key);
      const source = previous[index];
      if (source === undefined) return previous;
      const copy: DraftSet = { ...source, key: nextKey() };
      return [...previous.slice(0, index + 1), copy, ...previous.slice(index + 1)];
    });
  }

  function remove(key: string): void {
    setDrafts((previous) => previous.filter((draft) => draft.key !== key));
  }

  function save(): void {
    if (!validation.ok) return;
    onSave(validation.payload);
    setBaseline(JSON.stringify(drafts));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* A grade rola no eixo x em tela estreita: espremer as colunas da série
          transformaria os campos em alvos impossíveis de acertar. */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[2rem_9rem_7rem_7rem_8rem_1fr_2.5rem] items-center gap-2 border-b border-line pb-2 text-caption font-medium uppercase tracking-wide text-fg-subtle">
            <span aria-hidden="true">#</span>
            <span>Grandeza</span>
            <span>Valor</span>
            <span>Repetições</span>
            <span>Descanso (s)</span>
            <span>Técnica e observação</span>
            <span className="sr-only">Ações</span>
          </div>

          {drafts.map((draft, index) => {
            const showReps = draft.kind === 'WEIGHT' || draft.kind === 'BODYWEIGHT';
            return (
              <div
                key={draft.key}
                className="grid grid-cols-[2rem_9rem_7rem_7rem_8rem_1fr_2.5rem] items-center gap-2 border-b border-line py-2 last:border-b-0"
              >
                <span className="text-small font-medium text-fg-subtle">{index + 1}</span>

                <Select
                  options={KIND_OPTIONS}
                  value={draft.kind}
                  onValueChange={(value) => update(draft.key, { kind: value as LoadKind })}
                  aria-label={`Grandeza da série ${index + 1}`}
                />

                {draft.kind === 'BODYWEIGHT' ? (
                  <span className="text-small text-fg-subtle">—</span>
                ) : (
                  <Input
                    inputMode="decimal"
                    aria-label={`Valor da série ${index + 1}`}
                    placeholder={
                      draft.kind === 'WEIGHT' ? 'kg' : draft.kind === 'DURATION' ? 's' : 'm'
                    }
                    value={
                      draft.kind === 'WEIGHT'
                        ? draft.weightKg
                        : draft.kind === 'DURATION'
                          ? draft.durationSeconds
                          : draft.distanceMeters
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      update(
                        draft.key,
                        draft.kind === 'WEIGHT'
                          ? { weightKg: value }
                          : draft.kind === 'DURATION'
                            ? { durationSeconds: value }
                            : { distanceMeters: value },
                      );
                    }}
                  />
                )}

                {showReps ? (
                  <div className="flex flex-col gap-1">
                    <Input
                      inputMode="numeric"
                      aria-label={`Repetições da série ${index + 1}`}
                      value={draft.repsToFailure ? '' : draft.reps}
                      disabled={draft.repsToFailure}
                      onChange={(event) => update(draft.key, { reps: event.target.value })}
                    />
                    {/* D-081: "até a falha" é ESTADO PRÓPRIO, não um número
                        mágico como 999 — por isso desabilita o campo. */}
                    <Checkbox
                      checked={draft.repsToFailure}
                      onChange={(event) =>
                        update(draft.key, {
                          repsToFailure: event.target.checked,
                          reps: event.target.checked ? '' : draft.reps,
                        })
                      }
                    >
                      <span className="text-caption">Falha</span>
                    </Checkbox>
                  </div>
                ) : (
                  <span className="text-small text-fg-subtle">—</span>
                )}

                <div className="flex flex-col gap-1">
                  <Input
                    inputMode="numeric"
                    aria-label={`Descanso da série ${index + 1} em segundos`}
                    value={draft.restSeconds}
                    onChange={(event) => update(draft.key, { restSeconds: event.target.value })}
                  />
                  {isSuperset && !isLastOfSuperset ? (
                    <span className="text-caption text-fg-subtle">0 no conjugado</span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-28 shrink-0">
                    <Select
                      options={TECHNIQUE_OPTIONS}
                      value={draft.technique}
                      onValueChange={(value) =>
                        update(draft.key, { technique: value as SetTechnique })
                      }
                      aria-label={`Técnica da série ${index + 1}`}
                    />
                  </div>
                  <Input
                    aria-label={`Observação da série ${index + 1}`}
                    placeholder="Observação"
                    value={draft.note}
                    onChange={(event) => update(draft.key, { note: event.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Tooltip content="Duplicar série" side="left">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Duplicar série ${index + 1}`}
                      onClick={() => duplicate(draft.key)}
                      className="px-2"
                    >
                      <Icon icon={Copy} size="sm" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Remover série" side="left">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover série ${index + 1}`}
                      onClick={() => remove(draft.key)}
                      className="px-2"
                    >
                      <Icon icon={Trash2} size="sm" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {drafts.length === 0 ? (
        <p className="text-small text-fg-subtle">
          Nenhuma série prescrita ainda. Adicione a primeira linha.
        </p>
      ) : null}

      {!validation.ok && dirty ? (
        <p role="alert" className="text-small text-danger-700">
          {validation.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={addSet}>
          <Icon icon={Plus} size="sm" />
          Adicionar série
        </Button>
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty || !validation.ok}>
          Salvar séries
        </Button>
        {dirty ? <Badge variant="warning">Alterações não salvas</Badge> : null}
      </div>
    </div>
  );
}
