'use client';

import { Badge, Button, Card, Checkbox, Field, Input, Select, Switch } from '@fitvo/ui-web';
import { type ReactNode, useState } from 'react';

import type {
  PlanOrganization,
  Weekday,
  WorkoutPlanDetailView,
  WorkoutUpdatePlanInput,
} from '@/data/types';
import {
  PLAN_ORGANIZATION_LABEL,
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
  WEEKDAY_SHORT_LABEL,
} from '@/lib/workout-labels';

/**
 * Configuração do plano: organização, validade, objetivo e o eixo FIXO.
 *
 * D-105 aparece aqui como a regra que é: "fixo" é um EIXO PRÓPRIO do plano
 * (`isFixed` + `fixedWeekdays`), não um terceiro valor de organização. Por isso
 * o seletor de organização continua com dois valores (A/B/C ou dia da semana) e
 * o fixo é um interruptor separado — misturar os dois faria a tela sugerir uma
 * modelagem que o domínio não tem.
 *
 * `countsTowardAdherence` é EXIBIDO, nunca editado: quem deriva é o servidor.
 */
const ORGANIZATION_OPTIONS = (Object.keys(PLAN_ORGANIZATION_LABEL) as PlanOrganization[]).map(
  (value) => ({ value, label: PLAN_ORGANIZATION_LABEL[value] }),
);

export interface PlanSettingsCardProps {
  readonly plan: WorkoutPlanDetailView;
  readonly saving: boolean;
  readonly onSave: (input: WorkoutUpdatePlanInput) => void;
}

export function PlanSettingsCard({ plan, saving, onSave }: PlanSettingsCardProps): ReactNode {
  const [title, setTitle] = useState(plan.title);
  const [organization, setOrganization] = useState<PlanOrganization>(plan.organization);
  const [validityDays, setValidityDays] = useState(String(plan.validityDays));
  const [goal, setGoal] = useState(plan.goal ?? '');
  const [isFixed, setIsFixed] = useState(plan.isFixed);
  const [fixedWeekdays, setFixedWeekdays] = useState<readonly Weekday[]>(plan.fixedWeekdays);

  const parsedValidity = Number(validityDays);
  const validityError =
    !Number.isInteger(parsedValidity) || parsedValidity < 1 || parsedValidity > 365
      ? 'Informe um número inteiro de 1 a 365 dias.'
      : undefined;

  const dirty =
    title !== plan.title ||
    organization !== plan.organization ||
    validityDays !== String(plan.validityDays) ||
    goal !== (plan.goal ?? '') ||
    isFixed !== plan.isFixed ||
    fixedWeekdays.join(',') !== plan.fixedWeekdays.join(',');

  function toggleWeekday(day: Weekday): void {
    setFixedWeekdays((previous) =>
      previous.includes(day) ? previous.filter((entry) => entry !== day) : [...previous, day],
    );
  }

  function save(): void {
    if (validityError !== undefined) return;
    onSave({
      title,
      organization,
      validityDays: parsedValidity,
      goal: goal.trim() === '' ? null : goal.trim(),
      isFixed,
      // D-105: mandar dias num plano variável seria dizer duas coisas sobre
      // quando o treino acontece — o contrato recusa, e a tela não tenta.
      fixedWeekdays: isFixed ? [...fixedWeekdays] : [],
    });
  }

  return (
    <Card className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Título do plano" required>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>

        <Field
          label="Organização"
          description="Define se os treinos são A/B/C ou marcados por dia da semana."
        >
          <Select
            options={ORGANIZATION_OPTIONS}
            value={organization}
            onValueChange={(value) => setOrganization(value as PlanOrganization)}
            aria-label="Organização do plano"
          />
        </Field>

        <Field
          label="Validade (dias)"
          description="O plano vence automaticamente após esse período."
          error={validityError}
        >
          <Input
            inputMode="numeric"
            value={validityDays}
            onChange={(event) => setValidityDays(event.target.value)}
            status={validityError === undefined ? 'default' : 'error'}
          />
        </Field>

        <Field label="Objetivo" description="Aparece para o aluno junto do plano.">
          <Input
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Ex.: ganho de massa em membros inferiores"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <Switch checked={isFixed} onChange={(event) => setIsFixed(event.target.checked)}>
          Plano fixo
        </Switch>
        <p className="text-small text-fg-muted">
          O plano fixo roda por cima dos demais nos dias marcados e não entra no cálculo de
          aderência.
        </p>

        {isFixed ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-body text-small font-medium text-fg">
              Dias em que o plano fixo vale
              <span className="ml-1 font-normal text-fg-subtle">(vazio = todo dia)</span>
            </legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAY_ORDER.map((day) => (
                <Checkbox
                  key={day}
                  checked={fixedWeekdays.includes(day)}
                  onChange={() => toggleWeekday(day)}
                  aria-label={WEEKDAY_LABEL[day]}
                >
                  {WEEKDAY_SHORT_LABEL[day]}
                </Checkbox>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex items-center gap-2">
          <span className="text-small text-fg-muted">Conta para a aderência:</span>
          <Badge variant={plan.countsTowardAdherence ? 'success' : 'neutral'}>
            {plan.countsTowardAdherence ? 'Sim' : 'Não'}
          </Badge>
          <span className="text-caption text-fg-subtle">calculado pelo servidor</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={save} loading={saving} disabled={!dirty || validityError !== undefined}>
          Salvar configuração
        </Button>
        {dirty ? <Badge variant="warning">Alterações não salvas</Badge> : null}
      </div>
    </Card>
  );
}
