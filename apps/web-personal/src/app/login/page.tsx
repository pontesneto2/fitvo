'use client';

import { Button, Card, Field, Input, Logo } from '@fitvo/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ThemeToggle } from '@/components/theme-toggle';
import { type LoginInput, loginInputSchema } from '@/lib/auth';
import { zodResolver } from '@/lib/zod-resolver';

export default function LoginPage(): ReactNode {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setFormError(data.error ?? 'Nao foi possivel entrar.');
      return;
    }
    router.replace('/painel');
    router.refresh();
  });

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={36} />
          <p className="text-small text-fg-muted">Entre no painel do profissional</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="E-mail" error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              {...register('email')}
            />
          </Field>
          <Field label="Senha" error={errors.password?.message}>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              {...register('password')}
            />
          </Field>
          {formError ? (
            <p role="alert" className="text-caption text-danger-700 dark:text-danger-400">
              {formError}
            </p>
          ) : null}
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            Entrar
          </Button>
        </form>
        <p className="text-center text-caption text-fg-subtle">
          Ainda nao tem conta?{' '}
          <Link href="/cadastro" className="underline">
            Criar conta
          </Link>
        </p>
      </Card>
    </main>
  );
}
