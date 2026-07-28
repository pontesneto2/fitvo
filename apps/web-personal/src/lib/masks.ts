/**
 * Máscaras e normalização de campos do cadastro (ADR-0015). A máscara é
 * responsabilidade da UI (D-043/D-044): o usuário digita com pontuação, o
 * contrato armazena só dígitos. Estas funções são a única fonte de
 * formatação/normalização do formulário — sem regex de máscara espalhada por
 * tela.
 */

/** Mantém só os dígitos (remove máscara, espaços, pontuação). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** CPF: 000.000.000-00 (progressivo enquanto digita). */
export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/** CNPJ: 00.000.000/0000-00 (progressivo). */
export function maskCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

/** Máscara de documento conforme o tipo selecionado. */
export function maskDocument(value: string, documentType: 'CPF' | 'CNPJ'): string {
  return documentType === 'CNPJ' ? maskCnpj(value) : maskCpf(value);
}

/** WhatsApp/celular: (00) 00000-0000 (progressivo). */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^\((\d{2})\) (\d{5})(\d)/, '($1) $2-$3');
}

/** CEP: 00000-000 (progressivo). */
export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
}

/** Data BR: 00/00/0000 (progressivo). */
export function maskDateBr(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
}

/**
 * Data BR (dd/mm/aaaa) → ISO (aaaa-mm-dd). Devolve `null` se não houver 8
 * dígitos ou a data não for de calendário (ex.: 31/02). O ISO é o que o
 * contrato (`z.iso.date()`) espera no fio.
 */
export function brDateToIso(value: string): string | null {
  const d = onlyDigits(value);
  if (d.length !== 8) {
    return null;
  }
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealDate) {
    return null;
  }
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

/** ≥ 18 anos completos hoje (UTC). Espelha o gate do servidor (D-044). */
export function isAtLeastEighteen(brDate: string): boolean {
  const iso = brDateToIso(brDate);
  if (!iso) {
    return false;
  }
  const dob = new Date(`${iso}T00:00:00Z`);
  const eighteenth = new Date(
    Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate()),
  );
  return eighteenth.getTime() <= Date.now();
}
