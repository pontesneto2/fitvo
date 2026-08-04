'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';

import { createMockDataProvider } from './mock/mock-provider';
import type { FitvoDataProvider } from './provider';

/**
 * O ÚNICO ponto do app que sabe qual implementação de dados está em uso. As
 * telas consomem `useDataProvider()` e enxergam só a interface — ligar a API
 * real é trocar a implementação padrão aqui.
 */
const DataProviderContext = createContext<FitvoDataProvider | null>(null);

export interface DataProviderProps {
  /** Implementação explícita (testes, Storybook). Ausente => mock em memória. */
  readonly provider?: FitvoDataProvider;
  readonly children: ReactNode;
}

export function DataProvider({ provider, children }: DataProviderProps): ReactNode {
  // O store do mock é mutável e vive na instância: recriá-lo a cada render
  // descartaria tudo que o profissional acabou de montar na tela.
  const [fallback] = useState(() => createMockDataProvider());
  return (
    <DataProviderContext.Provider value={provider ?? fallback}>
      {children}
    </DataProviderContext.Provider>
  );
}

export function useDataProvider(): FitvoDataProvider {
  const provider = useContext(DataProviderContext);
  if (provider === null) {
    throw new Error('useDataProvider deve ser usado dentro de <DataProvider>.');
  }
  return provider;
}
