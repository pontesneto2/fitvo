'use client';

import { Button, Card, Field, Input, Logo } from '@fitvo/ui-web';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { ThemeToggle } from '@/components/theme-toggle';
import { type LoginInput, loginInputSchema } from '@/lib/auth';
import { zodResolver } from '@/lib/zod-resolver';

export default function LoginPage(): ReactNode {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
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
          {/* Controller (controlado), nao register (uncontrolled): os controles do
              ui-web ainda nao fazem forwardRef, entao register nao recebe o ref.
              Contorno ate o fix nos primitivos — divida em docs/roadmap.md. */}
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Field label="E-mail" error={errors.email?.message}>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Field label="Senha" error={errors.password?.message}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </Field>
            )}
          />
          {formError ? (
            <p role="alert" className="text-caption text-danger-700 dark:text-danger-400">
              {formError}
            </p>
          ) : null}
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            Entrar
          </Button>
        </form>
      </Card>
    </main>
  );
}
