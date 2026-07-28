/**
 * Validação de documento da PESSOA (CPF/CNPJ) — D-043.
 *
 * FORMATO + DÍGITO VERIFICADOR, não existência real na Receita. É a mesma
 * disciplina do conselho (D-138): "bem formado" ≠ "verificado". O DV rejeita o
 * erro de digitação e o número inventado ao acaso; não prova que o documento
 * existe/está ativo — isso seria integração externa, fora deste escopo.
 *
 * As funções recebem a string CRUA (com ou sem máscara) e normalizam para
 * dígitos internamente — a normalização de armazenamento (só dígitos) é
 * responsabilidade do schema Zod que as consome.
 */

/** Mantém só os dígitos de uma string (remove máscara, espaços, pontuação). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Dígito verificador módulo-11 sobre `digits`, com pesos DECRESCENTES a partir
 * de `startWeight` (padrão brasileiro de CPF/CNPJ). Resto < 2 ⇒ dígito 0.
 */
function mod11CheckDigit(digits: number[], startWeight: number): number {
  let weight = startWeight;
  let sum = 0;
  for (const digit of digits) {
    sum += digit * weight;
    weight -= 1;
    // CNPJ reinicia o ciclo de pesos em 9 quando chega a 1 (pesos 9..2).
    if (weight < 2) {
      weight = 9;
    }
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Todos os dígitos iguais (000..000, 111..111) passam na conta mas são inválidos. */
function allSameDigit(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

/**
 * CPF válido em formato + dígito verificador. 11 dígitos, não-repetidos, com os
 * dois DVs conferindo. Aceita entrada mascarada (normaliza antes).
 */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || allSameDigit(digits)) {
    return false;
  }
  const nums = digits.split('').map(Number);
  const dv1 = mod11CheckDigit(nums.slice(0, 9), 10);
  const dv2 = mod11CheckDigit(nums.slice(0, 10), 11);
  return dv1 === nums[9] && dv2 === nums[10];
}

/**
 * CNPJ válido em formato + dígito verificador. 14 dígitos, não-repetidos, com os
 * dois DVs conferindo. Aceita entrada mascarada (normaliza antes).
 */
export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || allSameDigit(digits)) {
    return false;
  }
  const nums = digits.split('').map(Number);
  // CNPJ: primeiro DV começa com peso 5 (sobre 12 dígitos), segundo com 6 (13).
  const dv1 = mod11CheckDigit(nums.slice(0, 12), 5);
  const dv2 = mod11CheckDigit(nums.slice(0, 13), 6);
  return dv1 === nums[12] && dv2 === nums[13];
}
