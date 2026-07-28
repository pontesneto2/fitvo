import { isValidCnpj, isValidCpf, onlyDigits } from '@fitvo/validation';
import { describe, expect, it } from 'vitest';

/**
 * Dígito verificador de CPF/CNPJ (D-043). Cobre o algoritmo módulo-11 nos dois
 * documentos — o gate que rejeita erro de digitação e número inventado, sem
 * prometer verificação real na Receita (isso é fora de escopo).
 */
describe('onlyDigits', () => {
  it('remove máscara e mantém só dígitos', () => {
    expect(onlyDigits('529.982.247-25')).toBe('52998224725');
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });
});

describe('isValidCpf', () => {
  it('aceita CPF com dígito verificador correto (mascarado ou cru)', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
  });

  it('rejeita CPF com dígito verificador inválido', () => {
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('11122233344')).toBe(false);
    expect(isValidCpf('12345678901')).toBe(false);
  });

  it('rejeita tamanho errado e dígitos repetidos', () => {
    expect(isValidCpf('5299822472')).toBe(false); // 10 dígitos
    expect(isValidCpf('529982247250')).toBe(false); // 12 dígitos
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
  });
});

describe('isValidCnpj', () => {
  it('aceita CNPJ com dígito verificador correto (mascarado ou cru)', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita CNPJ com dígito verificador inválido', () => {
    expect(isValidCnpj('11222333000180')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
  });

  it('rejeita tamanho errado', () => {
    expect(isValidCnpj('1122233300018')).toBe(false); // 13 dígitos
    expect(isValidCnpj('112223330001810')).toBe(false); // 15 dígitos
  });
});
