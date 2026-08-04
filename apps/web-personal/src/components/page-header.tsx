import type { ReactNode } from 'react';

/**
 * Cabecalho de pagina do painel: titulo, apoio e area de acoes. Existe para as
 * telas nao repetirem a mesma pilha de `h2 + p + flex` com espacamentos
 * ligeiramente diferentes — a divergencia que faz um painel parecer montado por
 * pessoas diferentes.
 */
export interface PageHeaderProps {
  readonly title: string;
  readonly description?: ReactNode;
  /** Trilha/voltar exibida acima do titulo. */
  readonly above?: ReactNode;
  readonly actions?: ReactNode;
}

export function PageHeader({ title, description, above, actions }: PageHeaderProps): ReactNode {
  return (
    <div className="flex flex-col gap-3">
      {above}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-heading text-h2 font-semibold text-fg">{title}</h2>
          {description != null ? (
            <div className="text-body text-fg-muted">{description}</div>
          ) : null}
        </div>
        {actions != null ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
