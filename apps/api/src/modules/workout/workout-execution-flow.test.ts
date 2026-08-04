import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';

/**
 * Fluxo HTTP da EXECUÇÃO de treino — Bloco 3 (ADR-0009).
 *
 * O objeto central destes testes é a FRICÇÃO decidida para este bloco:
 * concluir o treino é check-in + avaliação, e o registro de carga real é
 * incentivado mas NUNCA obrigatório. Um teste que só provasse "conclui com
 * tudo preenchido" deixaria passar uma regressão que tornasse o `SetLog`
 * obrigatório — que é exatamente o erro de produto que mataria a adesão.
 */

const TENANT_A = 'wkx_tenant_a';
const TENANT_B = 'wkx_tenant_b';

const proPayload = {
  ...validProfessionalRegistration,
  name: 'Personal',
  specialtyId: 'spec_training',
  councilDocument: 'CREF-123456',
};

interface Aluno {
  token: string;
  patientProfileId: string;
  bondId: string;
  workoutId: string;
}

interface Conta {
  token: string;
  accountId: string;
}

/**
 * Conta com token válido + perfil de PACIENTE semeado no repositório da
 * execução. A conta de paciente só nasce pelo aceite de convite (D-135), fora
 * do escopo desta slice — o que está sob teste é a execução, não o nascimento
 * da conta (mesma convenção do Bloco 2).
 */
async function registerAccount(harness: TestHarness, email: string): Promise<Conta> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: { ...proPayload, email },
  });
  expect(res.statusCode).toBe(201);
  return { token: res.json().tokens.accessToken as string, accountId: res.json().account.id };
}

/** Profissional com perfil no tenant — o dono do vínculo e o leitor da execução. */
async function setupProfissional(
  harness: TestHarness,
  email: string,
  tenantId: string,
): Promise<{ token: string; professionalProfileId: string }> {
  const conta = await registerAccount(harness, email);
  return {
    token: conta.token,
    professionalProfileId: harness.workoutExecution.seedProfessional({
      accountId: conta.accountId,
      tenantId,
    }),
  };
}

/** Aluno com vínculo e um treino ACTIVE pronto para executar. */
async function setupAluno(
  harness: TestHarness,
  options: {
    email: string;
    tenantId: string;
    professionalProfileId: string;
    planIsFixed?: boolean;
    setIds?: string[];
  },
): Promise<Aluno> {
  const conta = await registerAccount(harness, options.email);
  const patientProfileId = harness.workoutExecution.seedPatient({ accountId: conta.accountId });
  const bondId = harness.workoutExecution.seedBond({
    tenantId: options.tenantId,
    professionalProfileId: options.professionalProfileId,
    patientProfileId,
  });
  const workoutId = harness.workoutExecution.seedWorkout({
    bondId,
    planIsFixed: options.planIsFixed ?? false,
    setIds: options.setIds ?? ['set_1', 'set_2'],
  });
  return { token: conta.token, patientProfileId, bondId, workoutId };
}

function auth(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

const RATING_VALIDO = {
  score: 5,
  perceivedEffort: 8,
  comment: 'Peito detonado',
  reactions: ['DIED', 'FLEW'],
};

describe('D-086 — check-in LEVE: conclui sem nenhum SetLog', () => {
  it('abre a sessao e conclui com ZERO registro de serie', async () => {
    const harness = await buildTestHarness();
    const { professionalProfileId } = await setupProfissional(
      harness,
      'pro-leve@fitvo.dev',
      TENANT_A,
    );
    const aluno = await setupAluno(harness, {
      email: 'aluno-leve@fitvo.dev',
      tenantId: TENANT_A,
      professionalProfileId,
    });

    const aberta = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/workouts/${aluno.workoutId}/sessions`,
      headers: auth(aluno.token),
      payload: {},
    });
    expect(aberta.statusCode).toBe(201);
    expect(aberta.json().status).toBe('IN_PROGRESS');
    expect(aberta.json().completedAt).toBeNull();

    // NENHUM set-log entre abrir e concluir — este e o caminho NORMAL.
    const concluida = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/sessions/${aberta.json().id}/complete`,
      headers: auth(aluno.token),
      payload: { rating: RATING_VALIDO },
    });
    expect(concluida.statusCode).toBe(200);
    expect(concluida.json().status).toBe('COMPLETED');
    expect(concluida.json().completedAt).not.toBeNull();
    expect(concluida.json().setLogs).toEqual([]);
    expect(concluida.json().rating.score).toBe(5);

    // E o check-in ja aparece na aderencia — presenca registrada sem digitar
    // uma carga sequer.
    const aderencia = await harness.app.inject({
      method: 'GET',
      url: '/v1/workout-execution/me/adherence?from=2026-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z',
      headers: auth(aluno.token),
    });
    expect(aderencia.json().adherenceSessions).toBe(1);

    await harness.app.close();
  });

  it('sem avaliacao NAO conclui — a avaliacao e obrigatoria (D-087)', async () => {
    const harness = await buildTestHarness();
    const { professionalProfileId } = await setupProfissional(
      harness,
      'pro-sem-rating@fitvo.dev',
      TENANT_A,
    );
    const aluno = await setupAluno(harness, {
      email: 'aluno-sem-rating@fitvo.dev',
      tenantId: TENANT_A,
      professionalProfileId,
    });

    const aberta = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/workouts/${aluno.workoutId}/sessions`,
      headers: auth(aluno.token),
      payload: {},
    });
    const sessionId = aberta.json().id;

    const semRating = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/sessions/${sessionId}/complete`,
      headers: auth(aluno.token),
      payload: {},
    });
    expect(semRating.statusCode).toBe(400);

    // Nota fora de 1..5 tambem nao passa.
    const notaInvalida = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/sessions/${sessionId}/complete`,
      headers: auth(aluno.token),
      payload: { rating: { score: 9, perceivedEffort: 5 } },
    });
    expect(notaInvalida.statusCode).toBe(400);

    // E a sessao continua ABERTA: nada foi concluido pela metade.
    const detalhe = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout-execution/me/sessions/${sessionId}`,
      headers: auth(aluno.token),
    });
    expect(detalhe.json().status).toBe('IN_PROGRESS');
    expect(detalhe.json().rating).toBeNull();

    await harness.app.close();
  });

  it('o check-in acontece UMA vez — concluir de novo e 409', async () => {
    const harness = await buildTestHarness();
    const { professionalProfileId } = await setupProfissional(
      harness,
      'pro-2x@fitvo.dev',
      TENANT_A,
    );
    const aluno = await setupAluno(harness, {
      email: 'aluno-2x@fitvo.dev',
      tenantId: TENANT_A,
      professionalProfileId,
    });

    const aberta = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/workouts/${aluno.workoutId}/sessions`,
      headers: auth(aluno.token),
      payload: {},
    });
    const sessionId = aberta.json().id;
    const url = `/v1/workout-execution/me/sessions/${sessionId}/complete`;

    expect(
      (
        await harness.app.inject({
          method: 'POST',
          url,
          headers: auth(aluno.token),
          payload: { rating: RATING_VALIDO },
        })
      ).statusCode,
    ).toBe(200);

    const segunda = await harness.app.inject({
      method: 'POST',
      url,
      headers: auth(aluno.token),
      payload: { rating: RATING_VALIDO },
    });
    expect(segunda.statusCode).toBe(409);

    // O treino nao foi contado duas vezes na aderencia.
    const aderencia = await harness.app.inject({
      method: 'GET',
      url: '/v1/workout-execution/me/adherence?from=2026-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z',
      headers: auth(aluno.token),
    });
    expect(aderencia.json().adherenceSessions).toBe(1);

    await harness.app.close();
  });
});

describe('D-086 — SetLog INCENTIVADO: carga real de quem engaja', () => {
  it('registra carga real vinculada a serie prescrita, e serie livre sem plano', async () => {
    const harness = await buildTestHarness();
    const { professionalProfileId } = await setupProfissional(
      harness,
      'pro-log@fitvo.dev',
      TENANT_A,
    );
    const aluno = await setupAluno(harness, {
      email: 'aluno-log@fitvo.dev',
      tenantId: TENANT_A,
      professionalProfileId,
      setIds: ['set_prescrito'],
    });

    const aberta = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/workouts/${aluno.workoutId}/sessions`,
      headers: auth(aluno.token),
      payload: {},
    });
    const sessionId = aberta.json().id;
    const logsUrl = `/v1/workout-execution/me/sessions/${sessionId}/set-logs`;

    const vinculado = await harness.app.inject({
      method: 'POST',
      url: logsUrl,
      headers: auth(aluno.token),
      payload: { workoutSetId: 'set_prescrito', actualReps: 10, actualWeightGrams: 24000 },
    });
    expect(vinculado.statusCode).toBe(201);
    expect(vinculado.json().workoutSetId).toBe('set_prescrito');
    expect(vinculado.json().actualWeightGrams).toBe(24000);
    // Colunas TIPADAS: as demais grandezas ficam NULAS, nunca misturadas.
    expect(vinculado.json().actualDurationSeconds).toBeNull();
    expect(vinculado.json().actualDistanceMeters).toBeNull();

    // Serie LIVRE: o aluno fez algo que ninguem prescreveu.
    const livre = await harness.app.inject({
      method: 'POST',
      url: logsUrl,
      headers: auth(aluno.token),
      payload: { actualDurationSeconds: 60 },
    });
    expect(livre.statusCode).toBe(201);
    expect(livre.json().workoutSetId).toBeNull();
    expect(livre.json().actualDurationSeconds).toBe(60);
    expect(livre.json().actualWeightGrams).toBeNull();

    // Duas grandezas no MESMO registro: o contrato recusa (D-081).
    const misturado = await harness.app.inject({
      method: 'POST',
      url: logsUrl,
      headers: auth(aluno.token),
      payload: { actualWeightGrams: 20000, actualDistanceMeters: 500 },
    });
    expect(misturado.statusCode).toBe(400);

    // Serie de OUTRO treino nao pode ser referenciada (422, nao 201 silencioso).
    const foreign = await harness.app.inject({
      method: 'POST',
      url: logsUrl,
      headers: auth(aluno.token),
      payload: { workoutSetId: 'set_de_outro_treino', actualReps: 8 },
    });
    expect(foreign.statusCode).toBe(422);

    const concluida = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/sessions/${sessionId}/complete`,
      headers: auth(aluno.token),
      payload: { rating: RATING_VALIDO },
    });
    expect(concluida.json().setLogs).toHaveLength(2);

    // Sessao fechada e historico (D-100): nao recebe registro novo.
    const depois = await harness.app.inject({
      method: 'POST',
      url: logsUrl,
      headers: auth(aluno.token),
      payload: { actualReps: 5 },
    });
    expect(depois.statusCode).toBe(409);

    await harness.app.close();
  });
});

describe('D-092/D-105 — aderencia respeita o plano FIXO', () => {
  it('check-in de plano fixo nao entra na aderencia, mas nao some', async () => {
    const harness = await buildTestHarness();
    const { token: proToken, professionalProfileId } = await setupProfissional(
      harness,
      'pro-fix@fitvo.dev',
      TENANT_A,
    );
    const aluno = await setupAluno(harness, {
      email: 'aluno-fix@fitvo.dev',
      tenantId: TENANT_A,
      professionalProfileId,
    });
    // Segundo treino do MESMO aluno, mas de um plano FIXO (alongamento).
    const workoutFixo = harness.workoutExecution.seedWorkout({
      bondId: aluno.bondId,
      planIsFixed: true,
    });

    for (const workoutId of [aluno.workoutId, workoutFixo]) {
      const aberta = await harness.app.inject({
        method: 'POST',
        url: `/v1/workout-execution/me/workouts/${workoutId}/sessions`,
        headers: auth(aluno.token),
        payload: {},
      });
      await harness.app.inject({
        method: 'POST',
        url: `/v1/workout-execution/me/sessions/${aberta.json().id}/complete`,
        headers: auth(aluno.token),
        payload: { rating: RATING_VALIDO },
      });
    }

    const aderencia = await harness.app.inject({
      method: 'GET',
      url: '/v1/workout-execution/me/adherence?from=2026-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z',
      headers: auth(aluno.token),
    });
    expect(aderencia.statusCode).toBe(200);
    // Os dois check-ins aconteceram...
    expect(aderencia.json().completedSessions).toBe(2);
    // ...mas o alongamento nao infla a aderencia (D-105).
    expect(aderencia.json().adherenceSessions).toBe(1);
    const fixo = aderencia
      .json()
      .byPlan.find((plano: { isFixed: boolean }) => plano.isFixed === true);
    expect(fixo.countsTowardAdherence).toBe(false);
    expect(fixo.completedSessions).toBe(1);

    // O profissional dono do vinculo ve os MESMOS numeros, pela otica de quem
    // acompanha: a regra do D-105 mora no servidor, nao em cada consumidor.
    const doPro = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout-execution/${TENANT_A}/bonds/${aluno.bondId}/adherence?from=2026-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z`,
      headers: auth(proToken),
    });
    expect(doPro.statusCode).toBe(200);
    expect(doPro.json().completedSessions).toBe(2);
    expect(doPro.json().adherenceSessions).toBe(1);

    await harness.app.close();
  });
});

describe('escopo por vinculo e tenant — execucao de um aluno nao vaza', () => {
  it('sessao do aluno A e 404 para o aluno B e para o profissional de outro tenant', async () => {
    const harness = await buildTestHarness();
    const { professionalProfileId: proA } = await setupProfissional(
      harness,
      'pro-escopo@fitvo.dev',
      TENANT_A,
    );
    const { token: proBToken, professionalProfileId: proB } = await setupProfissional(
      harness,
      'pro-b-escopo@fitvo.dev',
      TENANT_B,
    );

    const alunoA = await setupAluno(harness, {
      email: 'aluno-a-escopo@fitvo.dev',
      tenantId: TENANT_A,
      professionalProfileId: proA,
    });
    const alunoB = await setupAluno(harness, {
      email: 'aluno-b-escopo@fitvo.dev',
      tenantId: TENANT_B,
      professionalProfileId: proB,
    });

    const sessaoA = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/workouts/${alunoA.workoutId}/sessions`,
      headers: auth(alunoA.token),
      payload: {},
    });
    const sessionId = sessaoA.json().id;

    // O aluno B nao le a sessao do A — 404, nao 403: dizer "existe, mas nao e
    // sua" ja vaza a existencia da execucao de outro paciente.
    const porB = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout-execution/me/sessions/${sessionId}`,
      headers: auth(alunoB.token),
    });
    expect(porB.statusCode).toBe(404);

    // Nem conclui.
    const concluiPorB = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/sessions/${sessionId}/complete`,
      headers: auth(alunoB.token),
      payload: { rating: RATING_VALIDO },
    });
    expect(concluiPorB.statusCode).toBe(404);

    // Nem registra carga na sessao alheia.
    const logPorB = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/sessions/${sessionId}/set-logs`,
      headers: auth(alunoB.token),
      payload: { actualReps: 10 },
    });
    expect(logPorB.statusCode).toBe(404);

    // A lista do B nao contem a sessao do A (nem vazia por acaso: o B nao tem
    // nenhuma).
    const listaB = await harness.app.inject({
      method: 'GET',
      url: '/v1/workout-execution/me/sessions',
      headers: auth(alunoB.token),
    });
    expect(listaB.json().sessions).toEqual([]);

    // Profissional de OUTRO tenant nao le a sessao nem o vinculo.
    const porProB = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout-execution/${TENANT_B}/sessions/${sessionId}`,
      headers: auth(proBToken),
    });
    expect(porProB.statusCode).toBe(404);

    const bondPorProB = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout-execution/${TENANT_B}/bonds/${alunoA.bondId}/sessions`,
      headers: auth(proBToken),
    });
    expect(bondPorProB.statusCode).toBe(404);

    await harness.app.close();
  });

  it('o profissional dono do vinculo LE a execucao do aluno', async () => {
    const harness = await buildTestHarness();
    const { token: proToken, professionalProfileId } = await setupProfissional(
      harness,
      'pro-le@fitvo.dev',
      TENANT_A,
    );
    const aluno = await setupAluno(harness, {
      email: 'aluno-le@fitvo.dev',
      tenantId: TENANT_A,
      professionalProfileId,
    });

    const aberta = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/workouts/${aluno.workoutId}/sessions`,
      headers: auth(aluno.token),
      payload: {},
    });
    await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/sessions/${aberta.json().id}/complete`,
      headers: auth(aluno.token),
      payload: { rating: { score: 2, perceivedEffort: 10 } },
    });

    const lista = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout-execution/${TENANT_A}/bonds/${aluno.bondId}/sessions`,
      headers: auth(proToken),
    });
    expect(lista.statusCode).toBe(200);
    expect(lista.json().sessions).toHaveLength(1);

    // Nota baixa + esforco altissimo e o sinal de ajuste da prescricao (D-092).
    const detalhe = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout-execution/${TENANT_A}/sessions/${aberta.json().id}`,
      headers: auth(proToken),
    });
    expect(detalhe.json().rating.score).toBe(2);
    expect(detalhe.json().rating.perceivedEffort).toBe(10);

    await harness.app.close();
  });
});

describe('D-165 — o aluno nao executa plano em DRAFT', () => {
  it('treino de plano em montagem e 404 para o aluno', async () => {
    const harness = await buildTestHarness();
    const { professionalProfileId } = await setupProfissional(
      harness,
      'pro-draft-exec@fitvo.dev',
      TENANT_A,
    );
    const aluno = await setupAluno(harness, {
      email: 'aluno-draft-exec@fitvo.dev',
      tenantId: TENANT_A,
      professionalProfileId,
    });
    const rascunho = harness.workoutExecution.seedWorkout({
      bondId: aluno.bondId,
      planStatus: 'DRAFT',
    });

    const res = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout-execution/me/workouts/${rascunho}/sessions`,
      headers: auth(aluno.token),
      payload: {},
    });
    expect(res.statusCode).toBe(404);

    await harness.app.close();
  });
});
