'use client';

import { Button, Field, Input, Select } from '@fitvo/ui-web';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { PasswordStrengthMeter } from '@/components/password-strength-meter';
import { TermsFields } from '@/components/terms-fields';
import { type RegisterClinicFormInput, registerClinicFormSchema } from '@/lib/auth';
import {
  brDateToIso,
  maskCep,
  maskCnpj,
  maskCpf,
  maskDateBr,
  maskPhone,
  onlyDigits,
} from '@/lib/masks';
import { fetchAddressByCep } from '@/lib/via-cep';
import { zodResolver } from '@/lib/zod-resolver';

import {
  BRAZILIAN_STATE_OPTIONS,
  CLINIC_ROLE_OPTIONS,
  GENDER_OPTIONS,
  MEDICAL_SPECIALTY_OPTIONS,
  SPECIALTY_CODE_OPTIONS,
} from './options';

const acceptedTermsDefaults = { termsOfUse: false, privacyPolicy: false };

const COUNCIL_LABEL_BY_SPECIALTY_CODE: Record<string, string> = {
  MEDICINE: 'CRM',
  NUTRITION: 'CRN',
  TRAINING: 'CREF',
  PERSONAL_TRAINER: 'CREF',
};

/** Cadastro público de CLÍNICA (spec §4.2 · D-139): empresa (só CNPJ) + admin (PF). */
export function ClinicForm({ onSuccess }: { onSuccess: () => void }): ReactNode {
  const [formError, setFormError] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notFound'>('idle');
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterClinicFormInput>({
    resolver: zodResolver(registerClinicFormSchema),
    defaultValues: {
      legalName: '',
      tradeName: '',
      cnpj: '',
      companyEmail: '',
      companyPhone: '',
      address: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '' },
      role: 'MANAGER_ONLY',
      name: '',
      socialName: '',
      document: '',
      email: '',
      password: '',
      confirmPassword: '',
      whatsapp: '',
      birthDate: '',
      gender: '',
      specialtyCode: '',
      councilDocument: '',
      councilState: '',
      medicalSpecialty: '',
      acceptedTerms: acceptedTermsDefaults,
    },
  });

  const role = watch('role');
  const alsoProvides = role === 'MANAGER_PROVIDER';
  const password = watch('password');
  const specialtyCode = watch('specialtyCode');
  const isDoctor = specialtyCode === 'MEDICINE';
  const councilLabel = specialtyCode
    ? (COUNCIL_LABEL_BY_SPECIALTY_CODE[specialtyCode] ?? 'conselho')
    : 'conselho';

  async function handleCepBlur(cep: string): Promise<void> {
    if (onlyDigits(cep).length !== 8) return;
    setCepStatus('loading');
    const result = await fetchAddressByCep(onlyDigits(cep));
    if (!result) {
      setCepStatus('notFound');
      return;
    }
    setCepStatus('idle');
    setValue('address.logradouro', result.logradouro, { shouldValidate: true });
    setValue('address.bairro', result.bairro, { shouldValidate: true });
    setValue('address.cidade', result.cidade, { shouldValidate: true });
    if (result.uf) setValue('address.state', result.uf, { shouldValidate: true });
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // Só envia os campos de atuação quando "também atende" — MANAGER_ONLY os
    // proíbe no servidor (spec §2). confirmPassword é só UI, não vai no payload.
    const provider =
      values.role === 'MANAGER_PROVIDER'
        ? {
            specialtyCode: values.specialtyCode,
            councilDocument: values.councilDocument,
            councilState: values.councilState,
            medicalSpecialty: values.medicalSpecialty || undefined,
          }
        : {};
    const payload = {
      legalName: values.legalName,
      tradeName: values.tradeName,
      cnpj: onlyDigits(values.cnpj),
      companyEmail: values.companyEmail,
      companyPhone: onlyDigits(values.companyPhone),
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
      role: values.role,
      name: values.name,
      socialName: values.socialName?.trim() || undefined,
      document: onlyDigits(values.document),
      email: values.email,
      password: values.password,
      whatsapp: onlyDigits(values.whatsapp),
      birthDate: brDateToIso(values.birthDate),
      gender: values.gender || undefined,
      ...provider,
      acceptedTerms: values.acceptedTerms,
    };
    const res = await fetch('/api/auth/register/clinic', {
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
      {/* Empresa */}
      <fieldset className="flex flex-col gap-4 rounded-md border border-line p-4">
        <legend className="px-1 text-small font-medium text-fg-muted">Dados da empresa</legend>
        <Field label="Razao social" error={errors.legalName?.message}>
          <Input placeholder="Razao social (contrato social)" {...register('legalName')} />
        </Field>
        <Field label="Nome fantasia" error={errors.tradeName?.message}>
          <Input placeholder="Nome de exibicao" {...register('tradeName')} />
        </Field>
        <Field label="CNPJ" error={errors.cnpj?.message}>
          <Controller
            control={control}
            name="cnpj"
            render={({ field }) => (
              <Input
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(maskCnpj(e.target.value))}
                status={errors.cnpj ? 'error' : 'default'}
              />
            )}
          />
        </Field>
        <Field label="E-mail da empresa" error={errors.companyEmail?.message}>
          <Input type="email" placeholder="contato@empresa.com" {...register('companyEmail')} />
        </Field>
        <Field label="Telefone/WhatsApp da empresa" error={errors.companyPhone?.message}>
          <Controller
            control={control}
            name="companyPhone"
            render={({ field }) => (
              <Input
                inputMode="numeric"
                placeholder="(00) 0000-0000"
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(maskPhone(e.target.value))}
                status={errors.companyPhone ? 'error' : 'default'}
              />
            )}
          />
        </Field>
        <Field
          label="CEP do estabelecimento"
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
          <Input placeholder="Rua, avenida..." {...register('address.logradouro')} />
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
            <Input placeholder="Sala, andar..." {...register('address.complemento')} />
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

      {/* Admin */}
      <fieldset className="flex flex-col gap-4 rounded-md border border-line p-4">
        <legend className="px-1 text-small font-medium text-fg-muted">Seus dados (gestor)</legend>
        <Field label="Voce e?" error={errors.role?.message}>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                options={CLINIC_ROLE_OPTIONS}
                placeholder="Selecione"
                status={errors.role ? 'error' : 'default'}
              />
            )}
          />
        </Field>

        {alsoProvides ? (
          <>
            <Field label="Profissao" error={errors.specialtyCode?.message}>
              <Controller
                control={control}
                name="specialtyCode"
                render={({ field }) => (
                  <Select
                    name={field.name}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    options={SPECIALTY_CODE_OPTIONS}
                    placeholder="Selecione a profissao"
                    status={errors.specialtyCode ? 'error' : 'default'}
                  />
                )}
              />
            </Field>
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
                      value={field.value ?? ''}
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
            {isDoctor ? (
              <Field label="Especialidade medica" error={errors.medicalSpecialty?.message}>
                <Controller
                  control={control}
                  name="medicalSpecialty"
                  render={({ field }) => (
                    <Select
                      name={field.name}
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      options={MEDICAL_SPECIALTY_OPTIONS}
                      placeholder="Selecione"
                      status={errors.medicalSpecialty ? 'error' : 'default'}
                    />
                  )}
                />
              </Field>
            ) : null}
          </>
        ) : null}

        <Field label="Nome completo" error={errors.name?.message}>
          <Input autoComplete="name" placeholder="Seu nome" {...register('name')} />
        </Field>
        <Field
          label="Nome social (opcional)"
          description="Como você quer ser chamado(a). Aparece no lugar do nome civil."
          error={errors.socialName?.message}
        >
          <Input placeholder="Nome social" {...register('socialName')} />
        </Field>
        <Field label="CPF" error={errors.document?.message}>
          <Controller
            control={control}
            name="document"
            render={({ field }) => (
              <Input
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(maskCpf(e.target.value))}
                status={errors.document ? 'error' : 'default'}
              />
            )}
          />
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
        <PasswordStrengthMeter password={password} />
        <Field label="Confirmar senha" error={errors.confirmPassword?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Repita a senha"
            {...register('confirmPassword')}
          />
        </Field>
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
        <Field label="Genero (opcional)" error={errors.gender?.message}>
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
      </fieldset>

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
        Criar conta da clinica
      </Button>
    </form>
  );
}
