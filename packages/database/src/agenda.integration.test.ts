import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { PrismaClient } from './index';

/**
 * Integracao — a constraint EXCLUDE da agenda (D-106, ADR-0012).
 *
 * POR QUE ESTE ARQUIVO E OBRIGATORIO, NAO OPCIONAL: o `EXCLUDE` vive em SQL cru
 * (o Prisma nao o expressa) e e INVISIVEL ao drift check NOS DOIS SENTIDOS —
 * verificado: `migrate diff --exit-code` devolve 0 com a constraint presente. Isso
 * e bom (nao quebra o job `migrate`) e ruim: se alguem a derrubar, o CI NAO
 * PERCEBE. Este teste e a unica coisa que percebe. Se a constraint sumir, ele
 * quebra — e e por isso que ele existe.
 *
 * O `@@unique` que o Prisma conhece nao expressa sobreposicao de INTERVALOS; e a
 * checagem so na aplicacao tem TOCTOU (dois agendamentos simultaneos consultam,
 * ambos passam, ambos inserem). Overbooking e exatamente o que o ADR-0012 existe
 * para evitar — e nasceria de uma corrida, nao de um bug de logica.
 */

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedAgenda() {
  const id = randomUUID().slice(0, 8);
  const tenant = await prisma.tenant.create({ data: { type: 'SOLO', name: `T-${id}` } });
  const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });

  const pro = await prisma.account.create({
    data: {
      email: `pro-${id}@ag.dev`,
      passwordHash: 'x',
      name: 'Pro',
      document: '0',
      documentType: 'CPF',
      professionalProfile: { create: { tenantId: tenant.id } },
    },
    select: { professionalProfile: { select: { id: true } } },
  });
  const patient = await prisma.account.create({
    data: {
      email: `pac-${id}@ag.dev`,
      passwordHash: 'x',
      name: 'Pac',
      document: '1',
      documentType: 'CPF',
      patientProfile: { create: {} },
    },
    select: { patientProfile: { select: { id: true } } },
  });

  const professionalProfileId = pro.professionalProfile!.id;
  const ps = await prisma.professionalSpecialty.create({
    data: { professionalProfileId, specialtyId: specialty.id },
  });
  const service = await prisma.professionalService.create({
    data: {
      professionalSpecialtyId: ps.id,
      name: 'Consulta inicial',
      durationMinutes: 60,
      priceCents: 15_000,
      type: 'FIRST_VISIT',
    },
  });
  // `prisma` aqui e um PrismaClient CRU (sem a extension de tenant, de
  // proposito -- este arquivo testa o EXCLUDE do Postgres, nao isolamento).
  // `bond` tem RLS (D-152, Slice 3/3): sem a extension, ninguem seta a
  // variavel de sessao sozinho -- bate manualmente na MESMA mini-transacao
  // do create (SET LOCAL nao sobreviveria a um round-trip separado).
  // `appointment` (usado no resto do arquivo) NAO tem RLS, e a FK contra
  // `bond` nao e afetada por RLS (checagem de integridade referencial do
  // Postgres nao passa pelas policies da tabela referenciada).
  const [, bond] = await prisma.$transaction([
    prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`,
    prisma.bond.create({
      data: {
        tenantId: tenant.id,
        patientProfileId: patient.patientProfile!.id,
        professionalProfileId,
        specialtyId: specialty.id,
        modality: 'PRESENCIAL',
      },
    }),
  ]);

  const book = (startsAt: string, endsAt: string, over?: { professionalProfileId?: string }) =>
    prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        bondId: bond.id,
        professionalProfileId: over?.professionalProfileId ?? professionalProfileId,
        serviceId: service.id,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        priceCentsAtBooking: service.priceCents,
        serviceTypeAtBooking: service.type,
      },
    });

  return { id, tenant, professionalProfileId, book };
}

describe('agenda — EXCLUDE de conflito contra Postgres real (D-106, ADR-0012)', () => {
  it('REPROVA dois agendamentos sobrepostos do mesmo profissional', async () => {
    const s = await seedAgenda();
    await s.book('2026-08-01T14:00:00Z', '2026-08-01T15:00:00Z');

    await expect(s.book('2026-08-01T14:30:00Z', '2026-08-01T15:30:00Z')).rejects.toThrow();
  });

  it('PERMITE agendamentos encostados — o limite e [), fim nao colide com inicio', async () => {
    const s = await seedAgenda();
    await s.book('2026-08-02T14:00:00Z', '2026-08-02T15:00:00Z');

    // Se isto falhar, a agenda recusa consultas em sequencia — o uso NORMAL.
    // O teste de cima sozinho passaria com um EXCLUDE bom demais.
    const encostado = await s.book('2026-08-02T15:00:00Z', '2026-08-02T16:00:00Z');
    expect(encostado.id).toBeTruthy();
  });

  it('CANCELLED libera o horario (a constraint so vale para SCHEDULED/CONFIRMED)', async () => {
    const s = await seedAgenda();
    const first = await s.book('2026-08-03T14:00:00Z', '2026-08-03T15:00:00Z');

    await expect(s.book('2026-08-03T14:00:00Z', '2026-08-03T15:00:00Z')).rejects.toThrow();

    await prisma.appointment.update({
      where: { id: first.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const remarcado = await s.book('2026-08-03T14:00:00Z', '2026-08-03T15:00:00Z');
    expect(remarcado.id).toBeTruthy();
  });

  it('nao ha conflito entre profissionais DIFERENTES no mesmo horario', async () => {
    const s = await seedAgenda();
    const outro = await seedAgenda();
    await s.book('2026-08-04T14:00:00Z', '2026-08-04T15:00:00Z');

    // Ancora: prova que o EXCLUDE discrimina por profissional, e nao trava a
    // agenda inteira da plataforma num horario.
    const paralelo = await outro.book('2026-08-04T14:00:00Z', '2026-08-04T15:00:00Z');
    expect(paralelo.id).toBeTruthy();
  });

  it('FK COMPOSTA: professional que nao e o do vinculo e IRREPRESENTAVEL', async () => {
    const s = await seedAgenda();
    const outro = await seedAgenda();

    // `professionalProfileId` e denormalizado no Appointment porque o EXCLUDE
    // exige as colunas na mesma linha. A FK composta (bondId + professionalProfileId
    // -> Bond.id + Bond.professionalProfileId) e o que impede o valor de divergir
    // do vinculo: construir, nao validar (D-102).
    await expect(
      s.book('2026-08-05T14:00:00Z', '2026-08-05T15:00:00Z', {
        professionalProfileId: outro.professionalProfileId,
      }),
    ).rejects.toThrow();
  });
});
