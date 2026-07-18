export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'fitvo-theme';

/**
 * Script sincrono injetado no <head> ANTES da pintura para evitar o flash de tema
 * (FOUC): le a preferencia salva (localStorage) ou cai no `prefers-color-scheme`
 * do SO e aplica a classe `dark` na raiz (casa com `darkMode:'class'` do preset).
 * E uma string (nao modulo) de proposito — precisa rodar antes de o bundle hidratar.
 */
export const themeInitScript = `(function(){try{var k='${THEME_STORAGE_KEY}';var s=localStorage.getItem(k);var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

/** Aplica e persiste o tema (client-side). */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage indisponivel (modo privado): o tema ainda vale para a sessao.
  }
}

/** Le o tema atual pela classe da raiz. */
export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Alterna entre claro e escuro. */
export function toggleTheme(): void {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
