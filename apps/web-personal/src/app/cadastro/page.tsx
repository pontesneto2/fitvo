'use client';

import { Button, Card, Field, Input, Logo, Radio, Select } from '@fitvo/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { TermsFields } from '@/components/terms-fields';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  BRAZILIAN_STATES,
  type RegisterProfessionalInput,
  registerProfessionalInputSchema,
} from '@/lib/auth';
import { COUNCIL_LABEL_BY_SPECIALTY_CODE, type Specialty } from '@/lib/specialty';
import { zodResolver } from '@/lib/zod-resolver';

const acceptedTermsDefaults = { termsOfUse: false, privacyPolicy: false };

const BRAZILIAN_STATE_OPTIONS = BRAZILIAN_STATES.map((uf) => ({ value: uf, label: uf }));

/** Carrega o catalogo fixo de especialidades (D-047) para o select do cadastro. */
function useSpecialties(): { specialties: Specialty[]; loadError: boolean } {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/specialties')
      .then((res) => {
        if (!res.ok) throw new Error('specialties fetch failed');
        return res.json() as Promise<{ specialties: Specialty[] }>;
      })
      .then((data) => {
        if (!cancelled) setSpecialties(data.specialties);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { specialties, loadError };
}

function ProfessionalForm(): ReactNode {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const { specialties, loadError } = useSpecialties();
  const {
    register,
    handleSubmit,
    control,
    watch,
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
      specialtyId: '',
      councilDocument: '',
      acceptedTerms: acceptedTermsDefaults,
    },
  });

  const selectedSpecialty = specialties.find((s) => s.id === watch('specialtyId'));
  const councilLabel = selectedSpecialty
    ? COUNCIL_LABEL_BY_SPECIALTY_CODE[selectedSpecialty.code]
    : 'conselho';
  const specialtyOptions = specialties.map((s) => ({
    value: s.id,
    label: `${s.name} (${COUNCIL_LABEL_BY_SPECIALTY_CODE[s.code]})`,
  }));

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
      <Field label="Profissao" error={errors.specialtyId?.message}>
        <Controller
          control={control}
          name="specialtyId"
          render={({ field }) => (
            <Select
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              options={specialtyOptions}
              placeholder={loadError ? 'Nao foi possivel carregar' : 'Selecione'}
              disabled={loadError}
              status={errors.specialtyId ? 'error' : 'default'}
            />
          )}
        />
      </Field>
      <Field label={`Registro no ${councilLabel}`} error={errors.councilDocument?.message}>
        <Input placeholder="Numero do registro" {...register('councilDocument')} />
      </Field>
      <Field label="UF do conselho" error={errors.councilState?.message}>
        <Controller
          control={control}
          name="councilState"
          render={({ field }) => (
            <Select
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              options={BRAZILIAN_STATE_OPTIONS}
              placeholder="Selecione a UF"
              searchable
              status={errors.councilState ? 'error' : 'default'}
            />
          )}
        />
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
