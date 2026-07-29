'use client';

import { Field, Input, Select } from '@fitvo/ui-web';
import { onlyDigits } from '@fitvo/validation';
import { useState } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';

import { BRAZILIAN_STATE_OPTIONS } from '@/app/cadastro/options';
import { maskCep } from '@/lib/masks';
import { fetchAddressByCep } from '@/lib/via-cep';

/**
 * Bloco de ENDEREÇO da pessoa (D-044 · spec §3) — componente compartilhado.
 *
 * Nasceu de uma duplicação real: o mesmo fieldset existia copiado no cadastro
 * do autônomo e no da empresa, e o gate de completar-perfil (spec §5) seria a
 * terceira cópia. Três cópias do mesmo formulário divergem — e divergir aqui
 * significa uma tela aceitar um endereço que a outra recusa.
 *
 * Regras que ficam garantidas em UM lugar só:
 * - **CEP puxa no blur** (ViaCEP) e preenche logradouro/bairro/cidade/UF;
 * - **CEP inválido NÃO trava** — é UX, não gate: cai para preenchimento manual;
 * - número e complemento são **sempre** manuais;
 * - `country` não é campo (fixado `BR` na normalização de envio).
 *
 * Genérico sobre o form: recebe `control`/`register`/`setValue` do React Hook
 * Form do chamador, então serve a qualquer schema que tenha um objeto
 * `address` com estes campos.
 */

/** Forma mínima que o form do chamador precisa ter sob a chave `address`. */
export interface AddressFormShape extends FieldValues {
  address: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string | undefined;
    bairro: string;
    cidade: string;
    state?: string | undefined;
  };
}

interface AddressFieldsProps<T extends AddressFormShape> {
  readonly control: Control<T>;
  readonly register: UseFormRegister<T>;
  readonly setValue: UseFormSetValue<T>;
  readonly errors: FieldErrors<T>;
  /** Rótulo do agrupamento — o cadastro de empresa usa "Endereço do estabelecimento". */
  readonly legend?: string;
}

type AddressErrors = {
  cep?: { message?: string };
  logradouro?: { message?: string };
  numero?: { message?: string };
  complemento?: { message?: string };
  bairro?: { message?: string };
  cidade?: { message?: string };
  state?: { message?: string };
};

export function AddressFields<T extends AddressFormShape>({
  control,
  register,
  setValue,
  errors,
  legend = 'Endereço',
}: AddressFieldsProps<T>): React.ReactNode {
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notFound'>('idle');
  const addressErrors = (errors.address ?? {}) as AddressErrors;

  /** Puxa o endereço pelo CEP no blur; CEP inválido/não encontrado NÃO trava. */
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
    // shouldValidate: limpa o erro dos campos recém-preenchidos.
    const set = (field: string, value: string): void => {
      setValue(`address.${field}` as Path<T>, value as never, { shouldValidate: true });
    };
    set('logradouro', result.logradouro);
    set('bairro', result.bairro);
    set('cidade', result.cidade);
    if (result.uf) {
      set('state', result.uf);
    }
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-line p-4">
      <legend className="px-1 text-small font-medium text-fg-muted">{legend}</legend>
      <Field
        label="CEP"
        error={addressErrors.cep?.message}
        description={
          cepStatus === 'loading'
            ? 'Buscando endereço...'
            : cepStatus === 'notFound'
              ? 'CEP não encontrado — preencha manualmente.'
              : undefined
        }
      >
        <Controller
          control={control}
          name={'address.cep' as Path<T>}
          render={({ field }) => (
            <Input
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={(field.value ?? '') as string}
              onChange={(e) => field.onChange(maskCep(e.target.value))}
              onBlur={(e) => {
                field.onBlur();
                void handleCepBlur(e.target.value);
              }}
              status={addressErrors.cep ? 'error' : 'default'}
            />
          )}
        />
      </Field>
      <Field label="Logradouro" error={addressErrors.logradouro?.message}>
        <Input
          autoComplete="address-line1"
          placeholder="Rua, avenida..."
          {...register('address.logradouro' as Path<T>)}
        />
      </Field>
      <div className="flex gap-3">
        <Field label="Número" error={addressErrors.numero?.message} className="w-28">
          <Input
            inputMode="numeric"
            placeholder="Número"
            {...register('address.numero' as Path<T>)}
          />
        </Field>
        <Field
          label="Complemento (opcional)"
          error={addressErrors.complemento?.message}
          className="flex-1"
        >
          <Input
            autoComplete="address-line2"
            placeholder="Apto, bloco..."
            {...register('address.complemento' as Path<T>)}
          />
        </Field>
      </div>
      <Field label="Bairro" error={addressErrors.bairro?.message}>
        <Input placeholder="Bairro" {...register('address.bairro' as Path<T>)} />
      </Field>
      <div className="flex gap-3">
        <Field label="Cidade" error={addressErrors.cidade?.message} className="flex-1">
          <Input placeholder="Cidade" {...register('address.cidade' as Path<T>)} />
        </Field>
        <Field label="UF" error={addressErrors.state?.message} className="w-24">
          <Controller
            control={control}
            name={'address.state' as Path<T>}
            render={({ field }) => (
              <Select
                name={field.name}
                value={(field.value ?? '') as string}
                onValueChange={field.onChange}
                options={BRAZILIAN_STATE_OPTIONS}
                placeholder="UF"
                searchable
                status={addressErrors.state ? 'error' : 'default'}
              />
            )}
          />
        </Field>
      </div>
    </fieldset>
  );
}
