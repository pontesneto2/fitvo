'use client';

import { Button, Card, Field, Input, Logo } from '@fitvo/ui-web';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ThemeToggle } from '@/components/theme-toggle';
import { type AcceptInviteInput, acceptInviteInputSchema } from '@/lib/auth';
import { zodResolver } from '@/lib/zod-resolver';

/**
 * Aceite de convite de paciente (publico, por token — D-006/D-052/D-055). O
 * token vem da URL (link enviado pelo profissional); sem aceite de termos
 * aqui (fora do escopo atual do contrato — ver roadmap.md).
 */
export default function AceitarConvitePage(): ReactNode {
  return (
    <Suspense fallback={null}>
      <AceitarConviteForm />
    </Suspense>
  );
}

function AceitarConviteForm(): ReactNode {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [formError, setFormError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteInputSchema),
    defaultValues: { token, password: '', name: '', document: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setFormError(data.error ?? 'Nao foi possivel aceitar o convite.');
      return;
    }
    setAccepted(true);
  });

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={36} />
          <p className="text-small text-fg-muted">Aceite o convite do seu profissional</p>
        </div>
        {!token ? (
          <p role="alert" className="text-center text-small text-danger-700 dark:text-danger-400">
            Link de convite invalido ou incompleto. Peca um novo link ao seu profissional.
          </p>
        ) : accepted ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-small text-fg">
              Convite aceito. Sua conta foi criada — entre com o e-mail e a senha que voce definiu.
            </p>
            <Link href="/login">
              <Button className="w-full">Ir para o login</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <input type="hidden" {...register('token')} />
            <Field label="Nome completo" error={errors.name?.message}>
              <Input autoComplete="name" placeholder="Seu nome" {...register('name')} />
            </Field>
            <Field label="CPF" error={errors.document?.message}>
              <Input placeholder="Somente numeros" {...register('document')} />
            </Field>
            <Field label="Senha" error={errors.password?.message}>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Minimo 8 caracteres"
                {...register('password')}
              />
            </Field>
            {formError ? (
              <p role="alert" className="text-caption text-danger-700 dark:text-danger-400">
                {formError}
              </p>
            ) : null}
            <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
              Aceitar convite
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
