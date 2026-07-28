'use client';

import { type ReactNode, useMemo } from 'react';

/**
 * Medidor de força de senha (ADR-0015) — puramente VISUAL. O gate obrigatório
 * (mín. 8 + letra + número) vive no schema (servidor e formulário); este
 * componente só orienta o usuário a subir a barra. Maiúscula e símbolo NÃO são
 * exigidos — apenas melhoram o nível exibido.
 */

interface Criterion {
  readonly label: string;
  readonly met: boolean;
  /** Critério obrigatório para o gate mínimo (vs. bônus que só reforça). */
  readonly required: boolean;
}

type Level = 'empty' | 'fraca' | 'media' | 'forte';

function evaluate(password: string): { level: Level; criteria: Criterion[] } {
  const criteria: Criterion[] = [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8, required: true },
    { label: 'Uma letra', met: /[A-Za-z]/.test(password), required: true },
    { label: 'Um número', met: /\d/.test(password), required: true },
    { label: 'Uma maiúscula', met: /[A-Z]/.test(password), required: false },
    { label: 'Um símbolo', met: /[^A-Za-z0-9]/.test(password), required: false },
  ];

  if (password.length === 0) {
    return { level: 'empty', criteria };
  }
  const baseMet = criteria.filter((c) => c.required).every((c) => c.met);
  const bonusMet = criteria.filter((c) => !c.required && c.met).length;
  if (!baseMet) {
    return { level: 'fraca', criteria };
  }
  return { level: bonusMet >= 2 ? 'forte' : 'media', criteria };
}

const LEVEL_META: Record<
  Exclude<Level, 'empty'>,
  { label: string; bars: number; bar: string; text: string }
> = {
  fraca: {
    label: 'Senha fraca',
    bars: 1,
    bar: 'bg-danger-500',
    text: 'text-danger-700 dark:text-danger-400',
  },
  media: {
    label: 'Senha média',
    bars: 2,
    bar: 'bg-warning-500',
    text: 'text-warning-700 dark:text-warning-400',
  },
  forte: {
    label: 'Senha forte',
    bars: 3,
    bar: 'bg-brand-500',
    text: 'text-brand-700 dark:text-brand-400',
  },
};

export function PasswordStrengthMeter({ password }: { password: string }): ReactNode {
  const { level, criteria } = useMemo(() => evaluate(password), [password]);

  if (level === 'empty') {
    return null;
  }
  const meta = LEVEL_META[level];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i < meta.bars ? meta.bar : 'bg-neutral-200 dark:bg-neutral-700'}`}
            />
          ))}
        </div>
        <span className={`text-caption font-medium ${meta.text}`} aria-live="polite">
          {meta.label}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {criteria.map((c) => (
          <li
            key={c.label}
            className={`flex items-center gap-1.5 text-caption ${c.met ? 'text-fg-muted' : 'text-fg-subtle'}`}
          >
            <span aria-hidden="true">{c.met ? '✓' : '○'}</span>
            <span>
              {c.label}
              {c.required ? null : ' (opcional — reforça)'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
