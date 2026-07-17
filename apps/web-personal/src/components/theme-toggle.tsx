'use client';

import { Button, Icon } from '@fitvo/ui-web';
import { Moon, Sun } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { currentTheme, type Theme, toggleTheme } from '@/lib/theme';

/**
 * Alterna claro/escuro. Le o tema real so apos montar: o tema efetivo e definido
 * pelo script anti-FOUC no <head>, entao o primeiro render (SSR/hidratacao) parte
 * de 'light' e ajusta no efeito — sem mismatch de hidratacao.
 */
export function ThemeToggle(): ReactNode {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function onToggle(): void {
    toggleTheme();
    setTheme(currentTheme());
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      <Icon icon={theme === 'dark' ? Sun : Moon} size="sm" />
    </Button>
  );
}
