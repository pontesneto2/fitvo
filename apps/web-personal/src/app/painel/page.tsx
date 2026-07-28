'use client';

import { Card, ErrorState, Skeleton } from '@fitvo/ui-web';
import type { ReactNode } from 'react';

import { useMe } from '@/lib/use-me';

/**
 * Rota protegida "vazia" do esqueleto: existe so para provar o fluxo. Chega aqui
 * quem tem sessao (middleware) e le a propria conta via /api/me (Bearer do cookie),
 * confirmando o login ponta a ponta.
 */
export default function PainelPage(): ReactNode {
  const { data: me, isLoading, isError } = useMe();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-h2 font-semibold text-fg">
          {isLoading ? <Skeleton variant="text" width={200} /> : `Olá, ${me?.displayName ?? ''}`}
        </h2>
        <p className="text-body text-fg-muted">
          Rota protegida no ar — o esqueleto do painel está funcionando.
        </p>
      </div>

      {isError ? (
        <ErrorState title="Sessão não carregada" message="Não foi possível ler sua conta agora." />
      ) : (
        <Card className="flex max-w-md flex-col gap-2">
          <span className="text-small font-medium text-fg-muted">Conta autenticada</span>
          {isLoading ? (
            <Skeleton variant="text" width={160} />
          ) : (
            <>
              <span className="text-body text-fg">{me?.displayName}</span>
              <span className="text-small text-fg-subtle">{me?.email}</span>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
