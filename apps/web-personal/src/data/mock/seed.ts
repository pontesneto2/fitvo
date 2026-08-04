/**
 * Semente do provider em memória. Todo objeto aqui tem a forma EXATA da `*View`
 * do contrato real (`@fitvo/validation`) — inclusive as disciplinas do domínio
 * que costumam ser perdidas em mock: carga em GRAMAS inteiras (D-081, nunca
 * float de kg), timestamps ISO em UTC, e `countsTowardAdherence` como valor
 * DERIVADO no servidor (a UI só lê).
 *
 * Nada aqui inventa regra: os estados, enums e combinações são os que o
 * contrato já admite.
 */
import type {
  ExerciseLibraryExerciseView,
  ExerciseLibraryMuscleGroupView,
  PatientBondView,
  PatientOverviewResult,
  WorkoutPlanDetailView,
} from '../types';

/** Base temporal fixa: mock determinístico não "envelhece" entre recargas. */
const T0 = '2026-07-01T09:00:00.000Z';
const T1 = '2026-07-20T14:30:00.000Z';

const SPECIALTY_TRAINING = 'spec-training';

// ---- Grupos musculares (taxonomia #131) ------------------------------------
function muscleGroup(
  id: string,
  code: string,
  name: string,
  displayOrder: number,
): ExerciseLibraryMuscleGroupView {
  return { id, code, name, displayOrder };
}

export const SEED_MUSCLE_GROUPS: readonly ExerciseLibraryMuscleGroupView[] = [
  muscleGroup('mg-chest', 'CHEST', 'Peito', 1),
  muscleGroup('mg-back', 'BACK', 'Costas', 2),
  muscleGroup('mg-shoulders', 'SHOULDERS', 'Ombros', 3),
  muscleGroup('mg-biceps', 'BICEPS', 'Bíceps', 4),
  muscleGroup('mg-triceps', 'TRICEPS', 'Tríceps', 5),
  muscleGroup('mg-quads', 'QUADS', 'Quadríceps', 6),
  muscleGroup('mg-hamstrings', 'HAMSTRINGS', 'Posterior de coxa', 7),
  muscleGroup('mg-glutes', 'GLUTES', 'Glúteos', 8),
  muscleGroup('mg-calves', 'CALVES', 'Panturrilha', 9),
  muscleGroup('mg-core', 'CORE', 'Abdômen e core', 10),
  muscleGroup('mg-cardio', 'CARDIO', 'Cardiorrespiratório', 11),
];

const byId = new Map(SEED_MUSCLE_GROUPS.map((g) => [g.id, g]));

function group(id: string): ExerciseLibraryMuscleGroupView {
  const found = byId.get(id);
  if (!found) throw new Error(`Grupo muscular inexistente na semente: ${id}`);
  return found;
}

// ---- Biblioteca de exercícios (#131) ---------------------------------------
interface ExerciseSeed {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly primary: string;
  readonly secondary?: readonly string[];
  readonly visibility: ExerciseLibraryExerciseView['visibility'];
  readonly status?: ExerciseLibraryExerciseView['status'];
  readonly hasVideo?: boolean;
}

/** `ownerProfessionalProfileId` só existe em item PRIVATE (D-170/D-171): o item
 *  PLATFORM é da base comum e não tem dono. */
const OWNER_PROFILE = 'prof-1';

function exercise(seed: ExerciseSeed): ExerciseLibraryExerciseView {
  const isPrivate = seed.visibility === 'PRIVATE';
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description ?? null,
    videoStorageKey: seed.hasVideo === true ? `exercises/${seed.id}/demo.mp4` : null,
    visibility: seed.visibility,
    status: seed.status ?? 'ACTIVE',
    specialtyId: SPECIALTY_TRAINING,
    ownerProfessionalProfileId: isPrivate ? OWNER_PROFILE : null,
    primaryMuscleGroup: group(seed.primary),
    secondaryMuscleGroups: (seed.secondary ?? []).map(group),
    createdAt: T0,
    updatedAt: T0,
  };
}

export const SEED_EXERCISES: readonly ExerciseLibraryExerciseView[] = [
  exercise({
    id: 'ex-bench-press',
    name: 'Supino reto com barra',
    description: 'Escápulas retraídas, barra na linha do mamilo, cotovelos a ~45°.',
    primary: 'mg-chest',
    secondary: ['mg-triceps', 'mg-shoulders'],
    visibility: 'PLATFORM',
    hasVideo: true,
  }),
  exercise({
    id: 'ex-incline-db-press',
    name: 'Supino inclinado com halteres',
    primary: 'mg-chest',
    secondary: ['mg-shoulders'],
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-cable-fly',
    name: 'Crucifixo na polia',
    primary: 'mg-chest',
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-pulldown',
    name: 'Puxada frontal na polia alta',
    primary: 'mg-back',
    secondary: ['mg-biceps'],
    visibility: 'PLATFORM',
    hasVideo: true,
  }),
  exercise({
    id: 'ex-barbell-row',
    name: 'Remada curvada com barra',
    primary: 'mg-back',
    secondary: ['mg-biceps'],
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-pullup',
    name: 'Barra fixa',
    description: 'Progressão: assistida na máquina até atingir 8 repetições limpas.',
    primary: 'mg-back',
    secondary: ['mg-biceps', 'mg-core'],
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-shoulder-press',
    name: 'Desenvolvimento com halteres',
    primary: 'mg-shoulders',
    secondary: ['mg-triceps'],
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-lateral-raise',
    name: 'Elevação lateral',
    primary: 'mg-shoulders',
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-biceps-curl',
    name: 'Rosca direta com barra',
    primary: 'mg-biceps',
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-triceps-pushdown',
    name: 'Tríceps na polia com corda',
    primary: 'mg-triceps',
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-squat',
    name: 'Agachamento livre',
    description: 'Profundidade até a coxa paralela ao solo; joelho acompanha a ponta do pé.',
    primary: 'mg-quads',
    secondary: ['mg-glutes', 'mg-core'],
    visibility: 'PLATFORM',
    hasVideo: true,
  }),
  exercise({
    id: 'ex-leg-press',
    name: 'Leg press 45°',
    primary: 'mg-quads',
    secondary: ['mg-glutes'],
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-romanian-deadlift',
    name: 'Levantamento terra romeno',
    primary: 'mg-hamstrings',
    secondary: ['mg-glutes', 'mg-back'],
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-hip-thrust',
    name: 'Elevação pélvica com barra',
    primary: 'mg-glutes',
    secondary: ['mg-hamstrings'],
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-calf-raise',
    name: 'Panturrilha em pé',
    primary: 'mg-calves',
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-plank',
    name: 'Prancha isométrica',
    primary: 'mg-core',
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-treadmill',
    name: 'Esteira — corrida contínua',
    primary: 'mg-cardio',
    visibility: 'PLATFORM',
  }),
  exercise({
    id: 'ex-smith-lunge',
    name: 'Afundo no Smith (variação da casa)',
    description: 'Variação própria: passada curta, foco em glúteo.',
    primary: 'mg-glutes',
    secondary: ['mg-quads'],
    visibility: 'PRIVATE',
  }),
  exercise({
    id: 'ex-band-pullapart',
    name: 'Abdução com elástico (aquecimento)',
    primary: 'mg-shoulders',
    visibility: 'PRIVATE',
  }),
  exercise({
    id: 'ex-legacy-machine',
    name: 'Peck deck antigo',
    description: 'Aparelho retirado da academia — mantido só para o histórico.',
    primary: 'mg-chest',
    visibility: 'PRIVATE',
    status: 'DISCONTINUED',
  }),
];

// ---- Alunos / vínculos (ADR-0001) ------------------------------------------
function bond(
  id: string,
  name: string,
  email: string,
  modality: PatientBondView['modality'],
  createdAt: string,
): PatientBondView {
  return {
    id,
    patientProfileId: `pp-${id}`,
    patientName: name,
    patientEmail: email,
    specialtyId: SPECIALTY_TRAINING,
    modality,
    status: 'ACTIVE',
    createdAt,
    archivedAt: null,
  };
}

export const SEED_OVERVIEW: PatientOverviewResult = {
  activeBonds: [
    bond('bond-1', 'Marina Alcântara', 'marina.alcantara@exemplo.com', 'ONLINE', T0),
    bond('bond-2', 'Rafael Nogueira', 'rafael.nogueira@exemplo.com', 'PRESENCIAL', T0),
    bond('bond-3', 'Camila Duarte', 'camila.duarte@exemplo.com', 'HIBRIDO', T1),
    bond('bond-4', 'Thiago Menezes', 'thiago.menezes@exemplo.com', 'ONLINE', T1),
    bond('bond-5', 'Juliana Prado', 'juliana.prado@exemplo.com', 'PRESENCIAL', T1),
  ],
  pendingInvites: [
    {
      id: 'inv-1',
      email: 'lucas.ferreira@exemplo.com',
      specialtyId: SPECIALTY_TRAINING,
      modality: 'ONLINE',
      status: 'PENDING',
      expiresAt: '2026-08-15T09:00:00.000Z',
      createdAt: T1,
    },
    {
      id: 'inv-2',
      email: 'bianca.souza@exemplo.com',
      specialtyId: SPECIALTY_TRAINING,
      modality: 'PRESENCIAL',
      status: 'PENDING',
      expiresAt: '2026-08-10T09:00:00.000Z',
      createdAt: T1,
    },
  ],
};

// ---- Planos de treino (#133) -----------------------------------------------
const KG = 1000; // gramas por quilo — D-081 guarda GRAMAS inteiras.

interface SetSeed {
  readonly reps?: number;
  readonly repsToFailure?: boolean;
  readonly kg?: number;
  readonly seconds?: number;
  readonly meters?: number;
  readonly bodyweight?: boolean;
  readonly rest?: number;
  readonly technique?: 'NORMAL' | 'DROP_SET';
  readonly note?: string;
}

function sets(
  itemId: string,
  seeds: readonly SetSeed[],
): WorkoutPlanDetailView['workouts'][number]['items'][number]['sets'] {
  return seeds.map((s, index) => ({
    id: `${itemId}-set-${index + 1}`,
    workoutItemId: itemId,
    position: index,
    reps: s.reps ?? null,
    repsToFailure: s.repsToFailure ?? false,
    weightGrams: s.kg === undefined ? null : Math.round(s.kg * KG),
    durationSeconds: s.seconds ?? null,
    distanceMeters: s.meters ?? null,
    bodyweight: s.bodyweight ?? false,
    restSeconds: s.rest ?? null,
    technique: s.technique ?? 'NORMAL',
    note: s.note ?? null,
  }));
}

interface ItemSeed {
  readonly id: string;
  readonly exerciseId: string | null;
  readonly supersetGroup?: number;
  readonly supersetOrder?: number;
  readonly note?: string;
  readonly sets: readonly SetSeed[];
}

function items(
  workoutId: string,
  seeds: readonly ItemSeed[],
): WorkoutPlanDetailView['workouts'][number]['items'] {
  return seeds.map((seed, index) => ({
    id: seed.id,
    workoutId,
    exerciseId: seed.exerciseId,
    position: index,
    supersetGroup: seed.supersetGroup ?? null,
    supersetOrder: seed.supersetOrder ?? null,
    note: seed.note ?? null,
    sets: sets(seed.id, seed.sets),
  }));
}

/**
 * Plano ATIVO organizado por LETRA (D-080), com os três casos que a tela precisa
 * saber desenhar: série-linha com valores DIVERGENTES entre si (D-081), um
 * conjugado de dois itens com descanso zero até o último (D-082) e séries por
 * tempo/distância (grandeza tipada, não peso).
 */
const PLAN_1: WorkoutPlanDetailView = {
  id: 'plan-1',
  bondId: 'bond-1',
  title: 'Hipertrofia — bloco 1',
  organization: 'LETTER',
  status: 'ACTIVE',
  validityDays: 30,
  validUntil: '2026-08-20T14:30:00.000Z',
  releaseAt: null,
  goal: 'Ganho de massa em membros inferiores, manutenção em superiores.',
  isFixed: false,
  fixedWeekdays: [],
  countsTowardAdherence: true,
  clonedFromWorkoutPlanId: null,
  createdAt: T1,
  updatedAt: T1,
  workouts: [
    {
      id: 'w-1a',
      planId: 'plan-1',
      title: 'Peito e tríceps',
      label: 'A',
      weekday: null,
      position: 0,
      items: items('w-1a', [
        {
          id: 'it-1a-1',
          exerciseId: 'ex-bench-press',
          note: 'Aquecer com 2 séries leves antes da primeira válida.',
          sets: [
            { reps: 12, kg: 40, rest: 90 },
            { reps: 10, kg: 45, rest: 90 },
            { reps: 8, kg: 50, rest: 120 },
            { repsToFailure: true, kg: 40, rest: 120, technique: 'DROP_SET' },
          ],
        },
        {
          id: 'it-1a-2',
          exerciseId: 'ex-incline-db-press',
          sets: [
            { reps: 12, kg: 18, rest: 75 },
            { reps: 12, kg: 18, rest: 75 },
            { reps: 10, kg: 20, rest: 90 },
          ],
        },
        // Conjugado (D-082): grupo 1, dois itens. O descanso é ZERO no primeiro
        // e real no último — a rodada é a série de mesma ordem nos dois.
        {
          id: 'it-1a-3',
          exerciseId: 'ex-cable-fly',
          supersetGroup: 1,
          supersetOrder: 0,
          sets: [
            { reps: 15, kg: 12, rest: 0 },
            { reps: 15, kg: 12, rest: 0 },
            { reps: 15, kg: 12, rest: 0 },
          ],
        },
        {
          id: 'it-1a-4',
          exerciseId: 'ex-triceps-pushdown',
          supersetGroup: 1,
          supersetOrder: 1,
          sets: [
            { reps: 15, kg: 25, rest: 60 },
            { reps: 15, kg: 25, rest: 60 },
            { repsToFailure: true, kg: 20, rest: 60 },
          ],
        },
        {
          id: 'it-1a-5',
          exerciseId: 'ex-plank',
          sets: [
            { seconds: 45, rest: 30 },
            { seconds: 45, rest: 30 },
            { seconds: 60, rest: 30 },
          ],
        },
      ]),
    },
    {
      id: 'w-1b',
      planId: 'plan-1',
      title: 'Costas e bíceps',
      label: 'B',
      weekday: null,
      position: 1,
      items: items('w-1b', [
        {
          id: 'it-1b-1',
          exerciseId: 'ex-pullup',
          sets: [
            { reps: 8, bodyweight: true, rest: 120 },
            { reps: 6, bodyweight: true, rest: 120 },
            { repsToFailure: true, bodyweight: true, rest: 120 },
          ],
        },
        {
          id: 'it-1b-2',
          exerciseId: 'ex-barbell-row',
          sets: [
            { reps: 12, kg: 35, rest: 90 },
            { reps: 10, kg: 40, rest: 90 },
            { reps: 10, kg: 40, rest: 90 },
          ],
        },
        {
          id: 'it-1b-3',
          exerciseId: 'ex-biceps-curl',
          sets: [
            { reps: 12, kg: 20, rest: 60 },
            { reps: 12, kg: 20, rest: 60 },
            { reps: 10, kg: 22.5, rest: 60, note: 'Cadência 2-0-2.' },
          ],
        },
      ]),
    },
    {
      id: 'w-1c',
      planId: 'plan-1',
      title: 'Pernas',
      label: 'C',
      weekday: null,
      position: 2,
      items: items('w-1c', [
        {
          id: 'it-1c-1',
          exerciseId: 'ex-squat',
          sets: [
            { reps: 10, kg: 50, rest: 150 },
            { reps: 8, kg: 60, rest: 150 },
            { reps: 8, kg: 60, rest: 150 },
            { reps: 6, kg: 65, rest: 180 },
          ],
        },
        {
          id: 'it-1c-2',
          exerciseId: 'ex-romanian-deadlift',
          sets: [
            { reps: 12, kg: 40, rest: 120 },
            { reps: 10, kg: 45, rest: 120 },
            { reps: 10, kg: 45, rest: 120 },
          ],
        },
        {
          id: 'it-1c-3',
          exerciseId: 'ex-calf-raise',
          sets: [
            { reps: 20, kg: 60, rest: 45 },
            { reps: 20, kg: 60, rest: 45 },
            { repsToFailure: true, kg: 60, rest: 45 },
          ],
        },
        {
          id: 'it-1c-4',
          exerciseId: 'ex-treadmill',
          note: 'Desaquecimento leve.',
          sets: [{ meters: 2000, rest: 0 }],
        },
      ]),
    },
  ],
};

/**
 * Plano FIXO (D-105) que roda por cima dos demais em dias marcados, e que NÃO
 * conta para a aderência — `countsTowardAdherence` chega DERIVADO do servidor;
 * a tela apenas exibe.
 */
const PLAN_2: WorkoutPlanDetailView = {
  id: 'plan-2',
  bondId: 'bond-1',
  title: 'Mobilidade — complementar',
  organization: 'WEEKDAY',
  status: 'ACTIVE',
  validityDays: 90,
  validUntil: '2026-10-18T14:30:00.000Z',
  releaseAt: null,
  goal: null,
  isFixed: true,
  fixedWeekdays: ['TUESDAY', 'THURSDAY'],
  countsTowardAdherence: false,
  clonedFromWorkoutPlanId: null,
  createdAt: T1,
  updatedAt: T1,
  workouts: [
    {
      id: 'w-2a',
      planId: 'plan-2',
      title: 'Mobilidade de quadril',
      label: null,
      weekday: 'TUESDAY',
      position: 0,
      items: items('w-2a', [
        {
          id: 'it-2a-1',
          exerciseId: 'ex-band-pullapart',
          sets: [
            { reps: 20, bodyweight: true, rest: 30 },
            { reps: 20, bodyweight: true, rest: 30 },
          ],
        },
      ]),
    },
  ],
};

/** Plano em RASCUNHO e ainda vazio: alimenta o estado vazio do editor. */
const PLAN_3: WorkoutPlanDetailView = {
  id: 'plan-3',
  bondId: 'bond-2',
  title: 'Adaptação — 4 semanas',
  organization: 'LETTER',
  status: 'DRAFT',
  validityDays: 28,
  validUntil: null,
  releaseAt: null,
  goal: 'Readaptação após pausa longa.',
  isFixed: false,
  fixedWeekdays: [],
  countsTowardAdherence: true,
  clonedFromWorkoutPlanId: null,
  createdAt: T1,
  updatedAt: T1,
  workouts: [],
};

/** Plano AGENDADO (D-084): já montado, liberação futura. */
const PLAN_4: WorkoutPlanDetailView = {
  id: 'plan-4',
  bondId: 'bond-3',
  title: 'Força — bloco 2',
  organization: 'LETTER',
  status: 'SCHEDULED',
  validityDays: 30,
  validUntil: null,
  releaseAt: '2026-08-11T03:00:00.000Z',
  goal: null,
  isFixed: false,
  fixedWeekdays: [],
  countsTowardAdherence: true,
  clonedFromWorkoutPlanId: 'plan-1',
  createdAt: T1,
  updatedAt: T1,
  workouts: [
    {
      id: 'w-4a',
      planId: 'plan-4',
      title: 'Full body',
      label: 'A',
      weekday: null,
      position: 0,
      items: items('w-4a', [
        {
          id: 'it-4a-1',
          exerciseId: 'ex-leg-press',
          sets: [
            { reps: 12, kg: 80, rest: 90 },
            { reps: 12, kg: 80, rest: 90 },
          ],
        },
      ]),
    },
  ],
};

/** Plano EXPIRADO (D-083): histórico, some da lista padrão de ativos. */
const PLAN_5: WorkoutPlanDetailView = {
  id: 'plan-5',
  bondId: 'bond-1',
  title: 'Adaptação — bloco inicial',
  organization: 'LETTER',
  status: 'EXPIRED',
  validityDays: 30,
  validUntil: '2026-06-30T09:00:00.000Z',
  releaseAt: null,
  goal: null,
  isFixed: false,
  fixedWeekdays: [],
  countsTowardAdherence: true,
  clonedFromWorkoutPlanId: null,
  createdAt: '2026-05-31T09:00:00.000Z',
  updatedAt: T0,
  workouts: [],
};

export const SEED_PLANS: readonly WorkoutPlanDetailView[] = [
  PLAN_1,
  PLAN_2,
  PLAN_3,
  PLAN_4,
  PLAN_5,
];
