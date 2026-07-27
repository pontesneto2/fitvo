'use client';

import { Button, Card, Field, Input, Logo, Radio } from '@fitvo/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';

import { TermsFields } from '@/components/terms-fields';
import { ThemeToggle } from '@/components/theme-toggle';
import { type RegisterProfessionalInput, registerProfessionalInputSchema } from '@/lib/auth';
import { zodResolver } from '@/lib/zod-resolver';

const acceptedTermsDefaults = { termsOfUse: false, privacyPolicy: false };

function ProfessionalForm(): ReactNode {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterProfessionalInput>({
    resolver: zodResolver(registerProfessionalInputSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      documentType: 'CPF',
      document: '',
      tenantName: '',
      acceptedTerms: acceptedTermsDefaults,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await fetch('/api/auth/register/professional', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setFormError(data.error ?? 'Nao foi possivel criar a conta.');
      return;
    }
    router.replace('/painel');
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Nome completo" error={errors.name?.message}>
        <Input autoComplete="name" placeholder="Seu nome" {...register('name')} />
      </Field>
      <Field label="Nome do consultorio/clinica" error={errors.tenantName?.message}>
        <Input placeholder="Ex.: Consultorio Ana Silva" {...register('tenantName')} />
      </Field>
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
          autoComplete="new-password"
          placeholder="Minimo 8 caracteres"
          {...register('password')}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-small font-medium text-fg-muted">Tipo de documento</span>
        <div className="flex gap-4">
          <Radio value="CPF" {...register('documentType')}>
            CPF
          </Radio>
          <Radio value="CNPJ" {...register('documentType')}>
            CNPJ
          </Radio>
        </div>
        {errors.documentType?.message ? (
          <p role="alert" className="text-caption text-danger-700 dark:text-danger-400">
            {errors.documentType.message}
          </p>
        ) : null}
      </div>
      <Field label="CPF ou CNPJ" error={errors.document?.message}>
        <Input placeholder="Somente numeros" {...register('document')} />
      </Field>
      <TermsFields
        errors={{
          termsOfUse: errors.acceptedTerms?.termsOfUse,
          privacyPolicy: errors.acceptedTerms?.privacyPolicy,
        }}
        register={(name) => register(name)}
      />
      {formError ? (
        <p role="alert" className="text-caption text-danger-700 dark:text-danger-400">
          {formError}
        </p>
      ) : null}
      <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
        Criar conta
      </Button>
    </form>
  );
}

export default function CadastroPage(): ReactNode {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={36} />
          <p className="text-small text-fg-muted">Crie sua conta na FITVO</p>
        </div>
        <ProfessionalForm />
        <p className="text-center text-caption text-fg-subtle">
          Ja tem conta?{' '}
          <Link href="/login" className="underline">
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  );
}
