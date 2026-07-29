'use client';

import { Button, Card, Field, Input, Logo, Radio, Select } from '@fitvo/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { PasswordStrengthMeter } from '@/components/password-strength-meter';
import { TermsFields } from '@/components/terms-fields';
import { ThemeToggle } from '@/components/theme-toggle';
import { type RegisterProfessionalFormInput, registerProfessionalFormSchema } from '@/lib/auth';
import { brDateToIso, maskCep, maskDateBr, maskDocument, maskPhone, onlyDigits } from '@/lib/masks';
import { COUNCIL_LABEL_BY_SPECIALTY_CODE, type Specialty } from '@/lib/specialty';
import { fetchAddressByCep } from '@/lib/via-cep';
import { zodResolver } from '@/lib/zod-resolver';

import { CompanyForm } from './company-form';
import { BRAZILIAN_STATE_OPTIONS, GENDER_OPTIONS } from './options';

const acceptedTermsDefaults = { termsOfUse: false, privacyPolicy: false };

/**
 * Caminhos de autocadastro (spec §1) — os TRÊS e só estes. Paciente/aluno,
 * profissional de empresa, recepção e ESTAGIÁRIO não aparecem aqui de
 * propósito: entram por convite. O estagiário, em especial, NUNCA se
 * autocadastra (D-142) — seat supervisionado.
 *
 * Clínica e academia usam o MESMO formulário (`CompanyForm`), parametrizado
 * pela vertical: o cadastro de empresa é idêntico (spec §4.2/§4.3).
 */
const CADASTRO_MODES = [
  { value: 'professional', label: 'Sou profissional autônomo' },
  { value: 'clinic', label: 'Sou clínica' },
  { value: 'academy', label: 'Sou academia' },
] as const;
type CadastroMode = (typeof CADASTRO_MODES)[number]['value'];

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

function ProfessionalForm({ onSuccess }: { onSuccess: () => void }): ReactNode {
  const [formError, setFormError] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notFound'>('idle');
  const { specialties, loadError } = useSpecialties();
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterProfessionalFormInput>({
    resolver: zodResolver(registerProfessionalFormSchema),
    defaultValues: {
      specialtyId: '',
      councilDocument: '',
      documentType: 'CPF',
      document: '',
      name: '',
      socialName: '',
      gender: '',
      email: '',
      password: '',
      confirmPassword: '',
      whatsapp: '',
      birthDate: '',
      address: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '' },
      acceptedTerms: acceptedTermsDefaults,
    },
  });

  const documentType = watch('documentType');
  const password = watch('password');
  const selectedSpecialty = specialties.find((s) => s.id === watch('specialtyId'));
  const councilLabel = selectedSpecialty
    ? COUNCIL_LABEL_BY_SPECIALTY_CODE[selectedSpecialty.code]
    : 'conselho';
  const specialtyOptions = specialties.map((s) => ({
    value: s.id,
    label: `${s.name} (${COUNCIL_LABEL_BY_SPECIALTY_CODE[s.code]})`,
  }));

  /** Puxa o endereco pelo CEP no blur; CEP invalido/nao encontrado NAO trava (preenche manual). */
  async function handleCepBlur(cep: string): Promise<void> {
    if (onlyDigits(cep).length !== 8) {
      return;
    }
    setCepStatus('loading');
    const result = await fetchAddressByCep(onlyDigits(cep));
    if (!result) {
      setCepStatus('notFound');
      return;
    }
    setCepStatus('idle');
    // shouldValidate: limpa o erro dos campos recem-preenchidos.
    setValue('address.logradouro', result.logradouro, { shouldValidate: true });
    setValue('address.bairro', result.bairro, { shouldValidate: true });
    setValue('address.cidade', result.cidade, { shouldValidate: true });
    if (result.uf) {
      setValue('address.state', result.uf, { shouldValidate: true });
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // Normaliza para o FIO (só dígitos + ISO na data). O contrato do servidor
    // (@fitvo/validation via BFF) exige dígitos; confirmPassword é só UI.
    const payload = {
      specialtyId: values.specialtyId,
      councilDocument: values.councilDocument,
      councilState: values.councilState,
      documentType: values.documentType,
      document: onlyDigits(values.document),
      name: values.name,
      // Opcionais (spec §3.1): só vão no payload quando preenchidos.
      socialName: values.socialName?.trim() || undefined,
      gender: values.gender || undefined,
      email: values.email,
      password: values.password,
      whatsapp: onlyDigits(values.whatsapp),
      birthDate: brDateToIso(values.birthDate),
      address: {
        cep: onlyDigits(values.address.cep),
        logradouro: values.address.logradouro,
        numero: values.address.numero,
        complemento: values.address.complemento || undefined,
        bairro: values.address.bairro,
        cidade: values.address.cidade,
        state: values.address.state,
        country: 'BR',
      },
      acceptedTerms: values.acceptedTerms,
    };
    const res = await fetch('/api/auth/register/professional', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setFormError(data.error ?? 'Nao foi possivel criar a conta.');
      return;
    }
    onSuccess();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {/* (1) Profissao */}
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

      {/* (2) Numero do conselho + UF */}
      <div className="flex gap-3">
        <Field
          label={`Registro no ${councilLabel}`}
          error={errors.councilDocument?.message}
          className="flex-1"
        >
          <Input placeholder="Numero do registro" {...register('councilDocument')} />
        </Field>
        <Field label="UF" error={errors.councilState?.message} className="w-24">
          <Controller
            control={control}
            name="councilState"
            render={({ field }) => (
              <Select
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                options={BRAZILIAN_STATE_OPTIONS}
                placeholder="UF"
                searchable
                status={errors.councilState ? 'error' : 'default'}
              />
            )}
          />
        </Field>
      </div>

      {/* (3) Tipo de documento + numero */}
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
      <Field label={documentType === 'CNPJ' ? 'CNPJ' : 'CPF'} error={errors.document?.message}>
        <Controller
          control={control}
          name="document"
          render={({ field }) => (
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder={documentType === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(maskDocument(e.target.value, documentType))}
              status={errors.document ? 'error' : 'default'}
            />
          )}
        />
      </Field>

      {/* (4) Nome */}
      <Field label="Nome completo" error={errors.name?.message}>
        <Input autoComplete="name" placeholder="Seu nome" {...register('name')} />
      </Field>

      {/* (4b) Nome social — opcional (spec §3.1) */}
      <Field
        label="Nome social (opcional)"
        description="Como você quer ser chamado(a). Aparece no lugar do nome civil."
        error={errors.socialName?.message}
      >
        <Input placeholder="Nome social" {...register('socialName')} />
      </Field>

      {/* (5) E-mail */}
      <Field label="E-mail" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          {...register('email')}
        />
      </Field>

      {/* (6) Senha + confirmacao + medidor */}
      <Field label="Senha" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Minimo 8 caracteres"
          {...register('password')}
        />
      </Field>
      <PasswordStrengthMeter password={password} />
      <Field label="Confirmar senha" error={errors.confirmPassword?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Repita a senha"
          {...register('confirmPassword')}
        />
      </Field>

      {/* (7) WhatsApp */}
      <Field label="WhatsApp" error={errors.whatsapp?.message}>
        <Controller
          control={control}
          name="whatsapp"
          render={({ field }) => (
            <Input
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(00) 00000-0000"
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(maskPhone(e.target.value))}
              status={errors.whatsapp ? 'error' : 'default'}
            />
          )}
        />
      </Field>

      {/* (8) Nascimento */}
      <Field label="Data de nascimento" error={errors.birthDate?.message}>
        <Controller
          control={control}
          name="birthDate"
          render={({ field }) => (
            <Input
              inputMode="numeric"
              autoComplete="bday"
              placeholder="00/00/0000"
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(maskDateBr(e.target.value))}
              status={errors.birthDate ? 'error' : 'default'}
            />
          )}
        />
      </Field>

      {/* (8b) Gênero — opcional (spec §3.1) */}
      <Field label="Gênero (opcional)" error={errors.gender?.message}>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <Select
              name={field.name}
              value={field.value ?? ''}
              onValueChange={field.onChange}
              options={GENDER_OPTIONS}
              placeholder="Selecione (opcional)"
              status={errors.gender ? 'error' : 'default'}
            />
          )}
        />
      </Field>

      {/* (9) Endereco (CEP puxa) */}
      <fieldset className="flex flex-col gap-4 rounded-md border border-line p-4">
        <legend className="px-1 text-small font-medium text-fg-muted">Endereco</legend>
        <Field
          label="CEP"
          error={errors.address?.cep?.message}
          description={
            cepStatus === 'loading'
              ? 'Buscando endereco...'
              : cepStatus === 'notFound'
                ? 'CEP nao encontrado — preencha manualmente.'
                : undefined
          }
        >
          <Controller
            control={control}
            name="address.cep"
            render={({ field }) => (
              <Input
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
                value={field.value}
                onChange={(e) => field.onChange(maskCep(e.target.value))}
                onBlur={(e) => {
                  field.onBlur();
                  void handleCepBlur(e.target.value);
                }}
                status={errors.address?.cep ? 'error' : 'default'}
              />
            )}
          />
        </Field>
        <Field label="Logradouro" error={errors.address?.logradouro?.message}>
          <Input
            autoComplete="address-line1"
            placeholder="Rua, avenida..."
            {...register('address.logradouro')}
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Numero" error={errors.address?.numero?.message} className="w-28">
            <Input inputMode="numeric" placeholder="Numero" {...register('address.numero')} />
          </Field>
          <Field
            label="Complemento (opcional)"
            error={errors.address?.complemento?.message}
            className="flex-1"
          >
            <Input
              autoComplete="address-line2"
              placeholder="Apto, bloco..."
              {...register('address.complemento')}
            />
          </Field>
        </div>
        <Field label="Bairro" error={errors.address?.bairro?.message}>
          <Input placeholder="Bairro" {...register('address.bairro')} />
        </Field>
        <div className="flex gap-3">
          <Field label="Cidade" error={errors.address?.cidade?.message} className="flex-1">
            <Input placeholder="Cidade" {...register('address.cidade')} />
          </Field>
          <Field label="UF" error={errors.address?.state?.message} className="w-24">
            <Controller
              control={control}
              name="address.state"
              render={({ field }) => (
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={BRAZILIAN_STATE_OPTIONS}
                  placeholder="UF"
                  searchable
                  status={errors.address?.state ? 'error' : 'default'}
                />
              )}
            />
          </Field>
        </div>
      </fieldset>

      {/* (10) Termos + Politica */}
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
  const router = useRouter();
  const [mode, setMode] = useState<CadastroMode>('professional');

  const onSuccess = (): void => {
    router.replace('/painel');
    router.refresh();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={36} />
          <p className="text-small text-fg-muted">Crie sua conta na FITVO</p>
        </div>
        {/* Seletor de tipo (spec §1) — os três caminhos de autocadastro. */}
        <div
          role="radiogroup"
          aria-label="Tipo de cadastro"
          className="flex gap-2 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800"
        >
          {CADASTRO_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`flex-1 rounded px-3 py-2 text-small font-medium transition-colors ${
                mode === m.value ? 'bg-bg text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'professional' ? (
          <ProfessionalForm onSuccess={onSuccess} />
        ) : (
          <CompanyForm variant={mode} onSuccess={onSuccess} />
        )}
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
