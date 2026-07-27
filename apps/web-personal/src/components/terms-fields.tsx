import { Checkbox } from '@fitvo/ui-web';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Checkboxes de aceite dos termos (D-025/D-052) — desmarcados por padrao.
 * Compartilhado entre o cadastro de profissional e o aceite de convite de
 * paciente: as duas portas de nascimento de uma Account exigem os dois
 * aceites explicitos.
 */
export function TermsFields({
  errors,
  register,
}: {
  readonly errors: {
    readonly termsOfUse?: { message?: string } | undefined;
    readonly privacyPolicy?: { message?: string } | undefined;
  };
  readonly register: (name: 'acceptedTerms.termsOfUse' | 'acceptedTerms.privacyPolicy') => object;
}): ReactNode {
  return (
    <div className="flex flex-col gap-2">
      <Checkbox {...(register('acceptedTerms.termsOfUse') as object)}>
        Li e aceito os{' '}
        <Link href="/termos" className="underline">
          Termos de Uso
        </Link>
        .
      </Checkbox>
      {errors.termsOfUse?.message ? (
        <p role="alert" className="text-caption text-danger-700 dark:text-danger-400">
          {errors.termsOfUse.message}
        </p>
      ) : null}
      <Checkbox {...(register('acceptedTerms.privacyPolicy') as object)}>
        Li e aceito a{' '}
        <Link href="/privacidade" className="underline">
          Politica de Privacidade
        </Link>
        .
      </Checkbox>
      {errors.privacyPolicy?.message ? (
        <p role="alert" className="text-caption text-danger-700 dark:text-danger-400">
          {errors.privacyPolicy.message}
        </p>
      ) : null}
    </div>
  );
}
