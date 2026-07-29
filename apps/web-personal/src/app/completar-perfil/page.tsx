'use client';

import { Button, Field, Input } from '@fitvo/ui-web';
import { onlyDigits } from '@fitvo/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AddressFields } from '@/components/address-fields';
import { type CompleteProfileFormInput, completeProfileFormSchema } from '@/lib/auth';
import { maskDateBr, maskPhone } from '@/lib/masks';
import { useMe } from '@/lib/use-me';
import { zodResolver } from '@/lib/zod-resolver';

/**
 * Gate de completar-perfil (spec §5) — a primeira tela de quem foi
 * pré-cadastrado por terceiro sem os dados que o app precisa para operar.
 *
 * Quem chega aqui não escolheu: o `AppShell` redireciona quando
 * `me.profileComplete === false`. Por isso a tela **não** tem navegação nem
 * escapatória — sair daqui é completar. O `profileComplete` que decide vem
 * DERIVADO do servidor; esta tela nunca refaz essa conta.
 *
 * Os campos são exatamente os que faltam a esse público (§4.4): nascimento,
 * WhatsApp e endereço. Documento, e-mail e termos ficam de fora — os dois
 * primeiros são identidade (não "dado faltando") e o terceiro já foi aceito no
 * convite (D-025).
 */
export default function CompletarPerfilPage(): ReactNode {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompleteProfileFormInput>({
    resolver: zodResolver(completeProfileFormSchema),
    defaultValues: {
      whatsapp: '',
      birthDate: '',
      address: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '' },
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // Normaliza para o FIO: só dígitos e data ISO — mesmo contrato do cadastro.
    const res = await fetch('/api/me/complete-profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        whatsapp: onlyDigits(values.whatsapp),
        birthDate: toIsoDate(values.birthDate),
        address: {
          cep: onlyDigits(values.address.cep),
          logradouro: values.address.logradouro,
          numero: values.address.numero,
          ...(values.address.complemento ? { complemento: values.address.complemento } : {}),
          bairro: values.address.bairro,
          cidade: values.address.cidade,
          state: values.address.state,
          country: 'BR',
        },
      }),
    });
    if (!res.ok) {
      setFormError('Nao foi possivel salvar. Confira os dados e tente novamente.');
      return;
    }
    // Invalida o /me para o shell reavaliar o gate com o valor novo.
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    router.replace('/painel');
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-h2 font-medium text-fg">
          {me ? `Falta pouco, ${me.displayName.split(' ')[0]}` : 'Falta pouco'}
        </h1>
        <p className="text-body text-fg-muted">
          Sua conta foi criada pela empresa. Complete os dados abaixo para continuar.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="WhatsApp" error={errors.whatsapp?.message}>
          <Input
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            {...register('whatsapp', {
              onChange: (e) => setValue('whatsapp', maskPhone(e.target.value)),
            })}
          />
        </Field>

        <Field label="Data de nascimento" error={errors.birthDate?.message}>
          <Input
            inputMode="numeric"
            autoComplete="bday"
            placeholder="00/00/0000"
            {...register('birthDate', {
              onChange: (e) => setValue('birthDate', maskDateBr(e.target.value)),
            })}
          />
        </Field>

        <AddressFields control={control} register={register} setValue={setValue} errors={errors} />

        {formError ? (
          <p role="alert" className="text-small text-danger">
            {formError}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Concluir'}
        </Button>
      </form>
    </main>
  );
}

/** `DD/MM/AAAA` (máscara da UI) → `YYYY-MM-DD` (o que o contrato espera). */
function toIsoDate(value: string): string {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}
