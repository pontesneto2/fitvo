'use client';

import { Avatar, Badge, Card, EmptyState, ErrorState, Icon, Skeleton } from '@fitvo/ui-web';
import { ChevronRight, MailQuestion, Users } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { usePatientOverview } from '@/data/hooks';
import type { PatientBondView, PatientInviteView } from '@/data/types';
import { formatDate, MODALITY_LABEL } from '@/lib/workout-labels';

/** Busca por nome ou e-mail, sem acento e sem caixa — quem digita "alcantara"
 *  espera achar "Alcântara". */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function BondCard({ bond }: { readonly bond: PatientBondView }): ReactNode {
  return (
    <Link
      href={`/painel/alunos/${bond.id}`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <Card variant="interactive" className="flex h-full items-center gap-4">
        <Avatar name={bond.patientName} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-body text-body font-medium text-fg">
            {bond.patientName}
          </span>
          <span className="truncate text-small text-fg-subtle">{bond.patientEmail}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="training">{MODALITY_LABEL[bond.modality]}</Badge>
            <span className="text-caption text-fg-subtle">Desde {formatDate(bond.createdAt)}</span>
          </div>
        </div>
        <Icon icon={ChevronRight} size="sm" />
      </Card>
    </Link>
  );
}

function InviteCard({ invite }: { readonly invite: PatientInviteView }): ReactNode {
  return (
    <Card className="flex items-center gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-50">
        <Icon icon={MailQuestion} size="sm" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-body text-body font-medium text-fg">{invite.email}</span>
        <span className="text-small text-fg-subtle">
          Convite enviado · expira em {formatDate(invite.expiresAt)}
        </span>
      </div>
      <Badge variant="warning">Aguardando aceite</Badge>
    </Card>
  );
}

function BondsSkeleton(): ReactNode {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <Card key={index} className="flex items-center gap-4">
          <Skeleton variant="circle" width={40} height={40} />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="rect" width={90} height={20} />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AlunosPage(): ReactNode {
  const { data, isLoading, isError, refetch } = usePatientOverview();
  const [search, setSearch] = useState('');

  const bonds = useMemo(() => {
    const all = data?.activeBonds ?? [];
    const term = normalize(search);
    if (term === '') return all;
    return all.filter(
      (bond) =>
        normalize(bond.patientName).includes(term) || normalize(bond.patientEmail).includes(term),
    );
  }, [data, search]);

  const invites = data?.pendingInvites ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alunos"
        description="Vínculos ativos e convites aguardando aceite."
        actions={
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar aluno"
            className="w-full sm:w-72"
          />
        }
      />

      {isError ? (
        <ErrorState
          title="Não foi possível carregar seus alunos"
          message="Tente novamente em instantes."
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <BondsSkeleton />
      ) : bonds.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Users} size="lg" />}
          title={search === '' ? 'Nenhum aluno vinculado' : 'Nenhum aluno encontrado'}
          description={
            search === ''
              ? 'Convide um aluno para começar a prescrever treinos.'
              : 'Ajuste a busca ou limpe o filtro para ver todos os vínculos.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {bonds.map((bond) => (
            <BondCard key={bond.id} bond={bond} />
          ))}
        </div>
      )}

      {/* Convite pendente ainda não é aluno: seção própria, abaixo, para não se
          misturar com quem já tem vínculo e já pode receber treino. */}
      {!isLoading && !isError && invites.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-h3 font-medium text-fg">
            Convites pendentes
            <span className="ml-2 text-small font-normal text-fg-subtle">({invites.length})</span>
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {invites.map((invite) => (
              <InviteCard key={invite.id} invite={invite} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
