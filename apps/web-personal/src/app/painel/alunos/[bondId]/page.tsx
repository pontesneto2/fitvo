'use client';

import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  Modal,
  Select,
  Skeleton,
  useToast,
} from '@fitvo/ui-web';
import { CalendarClock, ChevronRight, ClipboardList, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { useBond, useCreatePlan, usePlans } from '@/data/hooks';
import type { PlanOrganization, WorkoutPlanSummaryView } from '@/data/types';
import {
  formatDate,
  MODALITY_LABEL,
  PLAN_ORGANIZATION_LABEL,
  PLAN_STATUS_BADGE,
  PLAN_STATUS_LABEL,
  WEEKDAY_SHORT_LABEL,
} from '@/lib/workout-labels';

const ORGANIZATION_OPTIONS = (Object.keys(PLAN_ORGANIZATION_LABEL) as PlanOrganization[]).map(
  (value) => ({ value, label: PLAN_ORGANIZATION_LABEL[value] }),
);

/** Vivo = o que o aluno pode estar executando ou vai executar. O resto é histórico. */
const LIVE_STATUSES = new Set<WorkoutPlanSummaryView['status']>(['DRAFT', 'SCHEDULED', 'ACTIVE']);

function PlanCard({
  plan,
  bondId,
}: {
  readonly plan: WorkoutPlanSummaryView;
  readonly bondId: string;
}): ReactNode {
  return (
    <Link
      href={`/painel/alunos/${bondId}/planos/${plan.id}`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <Card variant="interactive" className="flex h-full items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-body text-body font-medium text-fg">{plan.title}</span>
            <Badge variant={PLAN_STATUS_BADGE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
            {plan.isFixed ? <Badge variant="training">Fixo</Badge> : null}
          </div>

          {plan.goal !== null ? (
            <p className="line-clamp-2 text-small text-fg-muted">{plan.goal}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-subtle">
            <span>{PLAN_ORGANIZATION_LABEL[plan.organization]}</span>
            <span>·</span>
            <span>{plan.validityDays} dias de validade</span>
            {plan.validUntil !== null ? <span>· vence {formatDate(plan.validUntil)}</span> : null}
            {plan.releaseAt !== null ? (
              <span className="flex items-center gap-1">
                <Icon icon={CalendarClock} size="sm" />
                libera {formatDate(plan.releaseAt)}
              </span>
            ) : null}
          </div>

          {plan.isFixed && plan.fixedWeekdays.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {plan.fixedWeekdays.map((day) => (
                <Badge key={day} variant="neutral">
                  {WEEKDAY_SHORT_LABEL[day]}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <Icon icon={ChevronRight} size="sm" />
      </Card>
    </Link>
  );
}

export default function AlunoPage(): ReactNode {
  const params = useParams<{ bondId: string }>();
  const bondId = params.bondId;
  const router = useRouter();
  const { toast } = useToast();

  const bondQuery = useBond(bondId);
  const plansQuery = usePlans(bondId);
  const createPlan = useCreatePlan(bondId);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState<PlanOrganization>('LETTER');

  const plans = plansQuery.data?.plans ?? [];
  const livePlans = plans.filter((plan) => LIVE_STATUSES.has(plan.status));
  const pastPlans = plans.filter((plan) => !LIVE_STATUSES.has(plan.status));

  async function submitPlan(): Promise<void> {
    const trimmed = title.trim();
    if (trimmed === '') return;
    const created = await createPlan.mutateAsync({ title: trimmed, organization });
    setModalOpen(false);
    setTitle('');
    toast({
      variant: 'success',
      title: 'Plano criado',
      description: 'Adicione os treinos para montar a prescrição.',
    });
    router.push(`/painel/alunos/${bondId}/planos/${created.id}`);
  }

  if (bondQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o aluno"
        message="Tente novamente em instantes."
        onRetry={() => void bondQuery.refetch()}
      />
    );
  }

  const bond = bondQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        above={
          <Breadcrumb
            items={[
              { label: 'Alunos', href: '/painel/alunos' },
              { label: bond?.patientName ?? 'Aluno' },
            ]}
          />
        }
        title={bond?.patientName ?? ''}
        description={
          bond === undefined ? (
            <Skeleton variant="text" width={220} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="training">{MODALITY_LABEL[bond.modality]}</Badge>
              <span className="text-small text-fg-subtle">{bond.patientEmail}</span>
              <span className="text-small text-fg-subtle">
                · vínculo desde {formatDate(bond.createdAt)}
              </span>
            </div>
          )
        }
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Icon icon={Plus} size="sm" />
            Novo plano
          </Button>
        }
      />

      {bond !== undefined ? (
        <Card className="flex items-center gap-4">
          <Avatar name={bond.patientName} size="lg" />
          <div className="flex flex-col gap-1">
            <span className="text-small text-fg-muted">Planos de treino</span>
            <span className="font-heading text-h2 font-semibold text-fg">{livePlans.length}</span>
            <span className="text-caption text-fg-subtle">{pastPlans.length} no histórico</span>
          </div>
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-h3 font-medium text-fg">Planos ativos</h3>

        {plansQuery.isError ? (
          <ErrorState
            title="Não foi possível carregar os planos"
            message="Tente novamente em instantes."
            onRetry={() => void plansQuery.refetch()}
          />
        ) : plansQuery.isLoading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1].map((index) => (
              <Card key={index} className="flex flex-col gap-2">
                <Skeleton variant="text" width="50%" />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="rect" width={140} height={20} />
              </Card>
            ))}
          </div>
        ) : livePlans.length === 0 ? (
          <EmptyState
            icon={<Icon icon={ClipboardList} size="lg" />}
            title="Nenhum plano ativo"
            description="Monte o primeiro plano de treino deste aluno."
            action={
              <Button onClick={() => setModalOpen(true)}>
                <Icon icon={Plus} size="sm" />
                Novo plano
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {livePlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} bondId={bondId} />
            ))}
          </div>
        )}
      </section>

      {pastPlans.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-h3 font-medium text-fg">Histórico</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {pastPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} bondId={bondId} />
            ))}
          </div>
        </section>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo plano de treino"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void submitPlan()}
              loading={createPlan.isPending}
              disabled={title.trim() === ''}
            >
              Criar plano
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Título do plano" required>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Hipertrofia — bloco 1"
            />
          </Field>
          <Field
            label="Organização"
            description="A/B/C para rodízio livre; dia da semana quando os treinos são marcados."
          >
            <Select
              options={ORGANIZATION_OPTIONS}
              value={organization}
              onValueChange={(value) => setOrganization(value as PlanOrganization)}
              aria-label="Organização do plano"
            />
          </Field>
          <p className="text-caption text-fg-subtle">
            O plano nasce em rascunho — você monta os treinos antes de liberar para o aluno.
          </p>
        </div>
      </Modal>
    </div>
  );
}
