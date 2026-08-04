'use client';

import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  ErrorState,
  Field,
  Icon,
  Input,
  Modal,
  Select,
  Skeleton,
  Tabs,
  useToast,
} from '@fitvo/ui-web';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { PlanSettingsCard } from '@/components/prescription/plan-settings-card';
import { WorkoutPanel } from '@/components/prescription/workout-panel';
import { useBond, usePlan, usePlanStructureMutations, useUpdatePlan } from '@/data/hooks';
import type { Weekday, WorkoutView } from '@/data/types';
import {
  formatDate,
  formatWorkoutSlot,
  PLAN_STATUS_BADGE,
  PLAN_STATUS_LABEL,
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
} from '@/lib/workout-labels';

/** Rótulo da aba do treino: o slot (letra/dia) na frente do título. */
function tabLabel(workout: WorkoutView): string {
  const slot = formatWorkoutSlot(workout);
  return slot === null ? workout.title : `${slot} · ${workout.title}`;
}

/** Próxima letra livre num plano LETTER — A, B, C… sem repetir a que já existe. */
function nextLetter(workouts: readonly WorkoutView[]): string {
  const used = new Set(
    workouts.map((workout) => workout.label).filter((l): l is string => l !== null),
  );
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code);
    if (!used.has(letter)) return letter;
  }
  return 'A';
}

function PlanSkeleton(): ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton variant="text" width={280} height={28} />
      <Card className="flex flex-col gap-3">
        <Skeleton variant="rect" height={40} />
        <Skeleton variant="rect" height={40} />
      </Card>
      <Skeleton variant="rect" height={44} />
      <Card className="flex flex-col gap-3">
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="rect" height={120} />
      </Card>
    </div>
  );
}

export default function PlanoPage(): ReactNode {
  const params = useParams<{ bondId: string; planId: string }>();
  const bondId = params.bondId;
  const planId = params.planId;

  const { toast } = useToast();
  const bondQuery = useBond(bondId);
  const planQuery = usePlan(planId);
  const updatePlan = useUpdatePlan(planId);
  const structure = usePlanStructureMutations(planId);

  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [newWorkoutTitle, setNewWorkoutTitle] = useState('');
  const [newWorkoutWeekday, setNewWorkoutWeekday] = useState<Weekday>('MONDAY');

  const plan = planQuery.data;
  const workouts = useMemo(
    () => [...(plan?.workouts ?? [])].sort((a, b) => a.position - b.position),
    [plan],
  );

  // A aba ativa acompanha os dados: criar ou remover um treino não pode deixar
  // a tela apontando para um treino que não existe mais.
  useEffect(() => {
    const first = workouts[0];
    if (first === undefined) {
      setActiveWorkoutId(null);
      return;
    }
    setActiveWorkoutId((current) =>
      current !== null && workouts.some((workout) => workout.id === current) ? current : first.id,
    );
  }, [workouts]);

  const activeWorkout = workouts.find((workout) => workout.id === activeWorkoutId) ?? null;
  // No primeiro render o efeito de sincronizacao ainda nao rodou: a aba mostrada
  // e o primeiro treino, para as Tabs nunca ficarem sem nenhuma selecionada.
  const selectedTab = activeWorkout?.id ?? workouts[0]?.id ?? '';

  function openWorkoutModal(): void {
    setNewWorkoutTitle('');
    setNewWorkoutWeekday('MONDAY');
    setWorkoutModalOpen(true);
  }

  async function createWorkout(): Promise<void> {
    if (plan === undefined) return;
    const isLetter = plan.organization === 'LETTER';
    const title = newWorkoutTitle.trim();
    if (title === '') return;

    // D-080: o treino ocupa UM slot, e qual deles depende da organização do
    // PLANO. Mandar os dois é o que o contrato recusa.
    const created = await structure.createWorkout.mutateAsync(
      isLetter ? { title, label: nextLetter(workouts) } : { title, weekday: newWorkoutWeekday },
    );
    setActiveWorkoutId(created.id);
    setWorkoutModalOpen(false);
    toast({ variant: 'success', title: 'Treino adicionado', description: created.title });
  }

  async function removeWorkout(workoutId: string): Promise<void> {
    await structure.deleteWorkout.mutateAsync(workoutId);
    toast({ variant: 'success', title: 'Treino removido' });
  }

  if (planQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o plano"
        message="Tente novamente em instantes."
        onRetry={() => void planQuery.refetch()}
      />
    );
  }

  if (planQuery.isLoading || plan === undefined) {
    return <PlanSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        above={
          <Breadcrumb
            items={[
              { label: 'Alunos', href: '/painel/alunos' },
              {
                label: bondQuery.data?.patientName ?? 'Aluno',
                href: `/painel/alunos/${bondId}`,
              },
              { label: plan.title },
            ]}
          />
        }
        title={plan.title}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={PLAN_STATUS_BADGE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
            {plan.isFixed ? <Badge variant="training">Plano fixo</Badge> : null}
            {plan.validUntil !== null ? (
              <span className="text-small text-fg-subtle">
                Válido até {formatDate(plan.validUntil)}
              </span>
            ) : null}
            {plan.releaseAt !== null ? (
              <span className="flex items-center gap-1 text-small text-fg-subtle">
                <Icon icon={CalendarClock} size="sm" />
                Libera em {formatDate(plan.releaseAt)}
              </span>
            ) : null}
            {plan.clonedFromWorkoutPlanId !== null ? (
              <Badge variant="neutral">Cópia de outro plano</Badge>
            ) : null}
          </div>
        }
      />

      <PlanSettingsCard
        plan={plan}
        saving={updatePlan.isPending}
        onSave={(input) => {
          updatePlan.mutate(input, {
            onSuccess: () => toast({ variant: 'success', title: 'Configuração salva' }),
            onError: () =>
              toast({
                variant: 'error',
                title: 'Não foi possível salvar',
                description: 'Revise os campos e tente novamente.',
              }),
          });
        }}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-h3 font-medium text-fg">Treinos</h3>
          <Button variant="secondary" onClick={openWorkoutModal}>
            <Icon icon={Plus} size="sm" />
            Novo treino
          </Button>
        </div>

        {workouts.length === 0 ? (
          <Card className="flex flex-col items-start gap-3">
            <p className="text-body text-fg-muted">
              Este plano ainda não tem treinos.{' '}
              {plan.organization === 'LETTER'
                ? 'Crie o treino A para começar.'
                : 'Marque o primeiro dia da semana para começar.'}
            </p>
            <Button onClick={openWorkoutModal}>
              <Icon icon={Plus} size="sm" />
              Criar primeiro treino
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs
                items={workouts.map((workout) => ({
                  value: workout.id,
                  label: tabLabel(workout),
                }))}
                value={selectedTab}
                onValueChange={setActiveWorkoutId}
                accent="training"
                aria-label="Treinos do plano"
                className="min-w-0 flex-1"
              />
              {activeWorkout !== null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeWorkout(activeWorkout.id)}
                  loading={structure.deleteWorkout.isPending}
                  aria-label={`Remover treino ${activeWorkout.title}`}
                >
                  <Icon icon={Trash2} size="sm" />
                  Remover treino
                </Button>
              ) : null}
            </div>

            {activeWorkout !== null ? (
              <WorkoutPanel
                workout={activeWorkout}
                savingSets={structure.replaceSets.isPending}
                addingItem={structure.createItem.isPending}
                onAddItem={(workoutId, exerciseId) => {
                  structure.createItem.mutate({ workoutId, input: { exerciseId } });
                }}
                onRemoveItem={(itemId) => structure.deleteItem.mutate(itemId)}
                onChangeNote={(itemId, note) =>
                  structure.updateItem.mutate({ itemId, input: { note } })
                }
                onSaveSets={(itemId, input) => {
                  structure.replaceSets.mutate(
                    { itemId, input },
                    {
                      onSuccess: () => toast({ variant: 'success', title: 'Séries salvas' }),
                      onError: () =>
                        toast({
                          variant: 'error',
                          title: 'Não foi possível salvar as séries',
                          description: 'Tente novamente em instantes.',
                        }),
                    },
                  );
                }}
                onSetSuperset={(itemId, superset) =>
                  structure.updateItem.mutate({
                    itemId,
                    input: { supersetGroup: superset.group, supersetOrder: superset.order },
                  })
                }
              />
            ) : null}
          </>
        )}
      </section>

      <Modal
        open={workoutModalOpen}
        onClose={() => setWorkoutModalOpen(false)}
        title="Novo treino"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWorkoutModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void createWorkout()}
              loading={structure.createWorkout.isPending}
              disabled={newWorkoutTitle.trim() === ''}
            >
              Adicionar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Nome do treino" required>
            <Input
              value={newWorkoutTitle}
              onChange={(event) => setNewWorkoutTitle(event.target.value)}
              placeholder="Ex.: Peito e tríceps"
            />
          </Field>

          {plan.organization === 'LETTER' ? (
            <p className="text-small text-fg-muted">
              Este plano é organizado por letra — o treino entra como{' '}
              <strong className="text-fg">{nextLetter(workouts)}</strong>.
            </p>
          ) : (
            <Field label="Dia da semana" required>
              <Select
                options={WEEKDAY_ORDER.map((day) => ({ value: day, label: WEEKDAY_LABEL[day] }))}
                value={newWorkoutWeekday}
                onValueChange={(value) => setNewWorkoutWeekday(value as Weekday)}
                aria-label="Dia da semana do treino"
              />
            </Field>
          )}
        </div>
      </Modal>
    </div>
  );
}
