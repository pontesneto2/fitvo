/**
 * Dicionário de frases EN → pt-BR usado pelo tradutor COMPOSICIONAL de nomes de
 * exercício (`translate-exercise-name.ts`).
 *
 * Os nomes da free-exercise-db são altamente composicionais
 * (`<equipamento> <modificador> <movimento>`), então traduzir por FRASE — não
 * por palavra — cobre a maior parte do corpo com português idiomático.
 *
 * Duas regras dão a qualidade do resultado:
 *
 * 1. **Cabeça ambígua fica FORA do dicionário.** "Press" sozinho é supino,
 *    desenvolvimento ou leg press dependendo do contexto; "raise" sozinho é
 *    elevação lateral, frontal ou de panturrilha. Mapear a palavra solta
 *    produziria nome errado com cara de certo. Só entram frases DESAMBIGUADAS
 *    ("bench press", "shoulder press", "lateral raise") — o que não casa por
 *    inteiro é reportado como não-traduzido em vez de ser chutado.
 *
 * 2. **Adjetivo concorda em gênero com o movimento.** Português tem
 *    concordância e inglês não: "Remada alternado" e "Rosca inclinado" são
 *    erro visível para qualquer professor. Por isso todo núcleo declara o
 *    `gender` do substantivo e todo modificador variável declara as duas formas
 *    — "Remada alternada", "Supino alternado".
 */

/** Papel de uma frase na composição do nome final. */
export type PhraseRole = 'CORE' | 'MODIFIER' | 'EQUIPMENT';

/** Gênero do substantivo do movimento, para concordância dos modificadores. */
export type Gender = 'M' | 'F';

export interface Phrase {
  /** Frase em inglês, já normalizada (minúscula, separadores como espaço). */
  en: string;
  /** Tradução pt-BR (forma masculina, quando o termo varia). */
  pt: string;
  role: PhraseRole;
  /** Só em `CORE`: gênero do substantivo. */
  gender?: Gender;
  /** Só em `MODIFIER` variável: forma feminina. */
  ptFeminine?: string;
}

/** MOVIMENTOS (núcleo do nome) — `[inglês, português, gênero]`. */
const CORE_PHRASES: ReadonlyArray<readonly [string, string, Gender]> = [
  // — Empurrar: peito e ombro (cabeças ambíguas só existem desambiguadas) —
  ['bench press', 'Supino', 'M'],
  ['incline bench press', 'Supino inclinado', 'M'],
  ['decline bench press', 'Supino declinado', 'M'],
  ['chest press', 'Supino', 'M'],
  ['floor press', 'Supino no chão', 'M'],
  ['shoulder press', 'Desenvolvimento', 'M'],
  ['military press', 'Desenvolvimento militar', 'M'],
  ['overhead press', 'Desenvolvimento', 'M'],
  ['push press', 'Desenvolvimento com impulso', 'M'],
  ['arnold press', 'Desenvolvimento Arnold', 'M'],
  ['leg press', 'Leg press', 'M'],
  ['calf press', 'Panturrilha no leg press', 'F'],
  ['chest fly', 'Crucifixo', 'M'],
  ['chest flye', 'Crucifixo', 'M'],
  ['chest flyes', 'Crucifixo', 'M'],
  ['fly', 'Crucifixo', 'M'],
  ['flye', 'Crucifixo', 'M'],
  ['flyes', 'Crucifixo', 'M'],
  ['crossover', 'Crossover', 'M'],
  ['cross over', 'Crossover', 'M'],
  ['pullover', 'Pullover', 'M'],
  ['push up', 'Flexão de braço', 'F'],
  ['push ups', 'Flexão de braço', 'F'],
  ['dip', 'Mergulho', 'M'],
  ['dips', 'Mergulho', 'M'],
  ['bench dips', 'Mergulho no banco', 'M'],

  // — Puxar: costas —
  ['row', 'Remada', 'F'],
  ['rows', 'Remada', 'F'],
  ['upright row', 'Remada alta', 'F'],
  ['pulldown', 'Puxada', 'F'],
  ['pulldowns', 'Puxada', 'F'],
  ['lat pulldown', 'Puxada frontal', 'F'],
  ['front lat pulldown', 'Puxada frontal', 'F'],
  ['pull up', 'Barra fixa', 'F'],
  ['pull ups', 'Barra fixa', 'F'],
  ['pullup', 'Barra fixa', 'F'],
  ['pullups', 'Barra fixa', 'F'],
  ['chin up', 'Barra fixa supinada', 'F'],
  ['chin ups', 'Barra fixa supinada', 'F'],
  ['chins', 'Barra fixa supinada', 'F'],
  ['pull apart', 'Abertura', 'F'],
  ['pull in', 'Recolhimento de pernas', 'M'],
  ['shrug', 'Encolhimento', 'M'],
  ['shrugs', 'Encolhimento', 'M'],
  ['hyperextensions', 'Extensão lombar', 'F'],
  ['back extension', 'Extensão lombar', 'F'],
  ['back extensions', 'Extensão lombar', 'F'],

  // — Braço —
  ['curl', 'Rosca', 'F'],
  ['curls', 'Rosca', 'F'],
  ['hammer curl', 'Rosca martelo', 'F'],
  ['hammer curls', 'Rosca martelo', 'F'],
  ['preacher curl', 'Rosca scott', 'F'],
  ['preacher curls', 'Rosca scott', 'F'],
  ['concentration curl', 'Rosca concentrada', 'F'],
  ['wrist curl', 'Rosca de punho', 'F'],
  ['wrist curls', 'Rosca de punho', 'F'],
  ['finger curls', 'Rosca de dedos', 'F'],
  ['spider curl', 'Rosca spider', 'F'],
  ['drag curl', 'Rosca drag', 'F'],
  ['bicep curl', 'Rosca direta', 'F'],
  ['biceps curl', 'Rosca direta', 'F'],
  ['triceps extension', 'Extensão de tríceps', 'F'],
  ['tricep extension', 'Extensão de tríceps', 'F'],
  ['triceps pushdown', 'Tríceps na polia', 'M'],
  ['pushdown', 'Tríceps na polia', 'M'],
  ['skull crusher', 'Tríceps testa', 'M'],
  ['skullcrusher', 'Tríceps testa', 'M'],
  ['kickback', 'Coice', 'M'],
  ['kickbacks', 'Coice', 'M'],
  ['glute kickback', 'Coice de glúteo', 'M'],
  ['tricep kickback', 'Tríceps coice', 'M'],
  ['tricep dip', 'Mergulho para tríceps', 'M'],
  ['pronation', 'Pronação de punho', 'F'],
  ['supination', 'Supinação de punho', 'F'],

  // — Ombro —
  ['lateral raise', 'Elevação lateral', 'F'],
  ['side lateral raise', 'Elevação lateral', 'F'],
  ['front raise', 'Elevação frontal', 'F'],
  ['rear delt raise', 'Crucifixo inverso', 'M'],
  ['rear delt fly', 'Crucifixo inverso', 'M'],
  ['rear delt row', 'Remada para deltoide posterior', 'F'],
  ['rear delt rows', 'Remada para deltoide posterior', 'F'],
  ['reverse fly', 'Crucifixo inverso', 'M'],
  ['reverse flyes', 'Crucifixo inverso', 'M'],
  ['deltoid raise', 'Elevação de deltoide', 'F'],
  ['shoulder raise', 'Elevação de ombro', 'F'],
  ['scaption', 'Elevação em scaption', 'F'],
  ['face pull', 'Face pull', 'M'],
  ['arm circles', 'Circundução de braços', 'F'],
  ['shoulder circles', 'Circundução de ombros', 'F'],
  ['elbow circles', 'Circundução de cotovelos', 'F'],
  ['ankle circles', 'Circundução de tornozelos', 'F'],
  ['hip circles', 'Circundução de quadril', 'F'],

  // — Perna e glúteo —
  ['squat', 'Agachamento', 'M'],
  ['squats', 'Agachamento', 'M'],
  ['front squat', 'Agachamento frontal', 'M'],
  ['hack squat', 'Agachamento hack', 'M'],
  ['box squat', 'Agachamento no caixote', 'M'],
  ['split squat', 'Agachamento búlgaro', 'M'],
  ['goblet squat', 'Agachamento goblet', 'M'],
  ['jump squat', 'Agachamento com salto', 'M'],
  ['deadlift', 'Levantamento terra', 'M'],
  ['deadlifts', 'Levantamento terra', 'M'],
  ['romanian deadlift', 'Levantamento terra romeno', 'M'],
  ['stiff leg deadlift', 'Levantamento terra stiff', 'M'],
  ['stiff legged deadlift', 'Levantamento terra stiff', 'M'],
  ['sumo deadlift', 'Levantamento terra sumô', 'M'],
  ['lunge', 'Afundo', 'M'],
  ['lunges', 'Afundo', 'M'],
  ['step up', 'Subida no caixote', 'F'],
  ['step ups', 'Subida no caixote', 'F'],
  ['leg extension', 'Cadeira extensora', 'F'],
  ['leg extensions', 'Cadeira extensora', 'F'],
  ['leg curl', 'Mesa flexora', 'F'],
  ['leg curls', 'Mesa flexora', 'F'],
  ['hip thrust', 'Elevação pélvica', 'F'],
  ['glute bridge', 'Ponte de glúteo', 'F'],
  ['bridge', 'Ponte', 'F'],
  ['calf raise', 'Elevação de panturrilha', 'F'],
  ['calf raises', 'Elevação de panturrilha', 'F'],
  ['good morning', 'Bom dia', 'M'],
  ['hip adduction', 'Adução de quadril', 'F'],
  ['hip adductions', 'Adução de quadril', 'F'],
  ['hip abduction', 'Abdução de quadril', 'F'],
  ['hip extension', 'Extensão de quadril', 'F'],
  ['hip flexion', 'Flexão de quadril', 'F'],
  ['hip lift', 'Elevação de quadril', 'F'],
  ['leg raise', 'Elevação de pernas', 'F'],
  ['leg raises', 'Elevação de pernas', 'F'],
  ['hip raise', 'Elevação de quadril', 'F'],
  ['glute ham raise', 'Extensão de posterior de coxa', 'F'],
  ['butt kick', 'Chute ao glúteo', 'M'],
  ['heel touchers', 'Toque no calcanhar', 'M'],

  // — Core —
  ['crunch', 'Abdominal', 'M'],
  ['crunches', 'Abdominal', 'M'],
  ['reverse crunch', 'Abdominal invertido', 'M'],
  ['oblique crunch', 'Abdominal oblíquo', 'M'],
  ['sit up', 'Abdominal', 'M'],
  ['sit ups', 'Abdominal', 'M'],
  ['plank', 'Prancha', 'F'],
  ['side bend', 'Flexão lateral de tronco', 'F'],
  ['side bends', 'Flexão lateral de tronco', 'F'],
  ['russian twist', 'Rotação russa', 'F'],
  ['russian twists', 'Rotação russa', 'F'],
  ['ab rollout', 'Rolagem abdominal', 'F'],
  ['rollout', 'Rolagem abdominal', 'F'],
  ['knee raise', 'Elevação de joelhos', 'F'],
  ['flutter kicks', 'Tesoura (flutter kick)', 'F'],
  ['dead bug', 'Dead bug', 'M'],

  // — Levantamento olímpico / força —
  ['clean', 'Clean', 'M'],
  ['clean and jerk', 'Clean and jerk', 'M'],
  ['clean and press', 'Clean and press', 'M'],
  ['clean pull', 'Puxada de clean', 'F'],
  ['clean deadlift', 'Levantamento terra de clean', 'M'],
  ['clean shrug', 'Encolhimento de clean', 'M'],
  ['snatch', 'Arranco', 'M'],
  ['jerk', 'Jerk', 'M'],
  ['high pull', 'Puxada alta', 'F'],
  ['power clean', 'Clean de potência', 'M'],
  ['thruster', 'Thruster', 'M'],

  // — Pliometria / condicionamento —
  ['jump', 'Salto', 'M'],
  ['jumps', 'Salto', 'M'],
  ['box jump', 'Salto no caixote', 'M'],
  ['hops', 'Saltos', 'M'],
  ['burpee', 'Burpee', 'M'],
  ['burpees', 'Burpee', 'M'],
  ['mountain climber', 'Escalador', 'M'],
  ['mountain climbers', 'Escalador', 'M'],
  ['sprint', 'Tiro de velocidade', 'M'],
  ['throw', 'Arremesso', 'M'],
  ['carry', 'Caminhada com carga', 'F'],
  ['walk', 'Caminhada', 'F'],
  ['drag', 'Arrasto', 'M'],
  ['drags', 'Arrasto', 'M'],
  ['skipping', 'Skipping', 'M'],
  ['jogging', 'Corrida leve', 'F'],
  ['bicycling', 'Bicicleta ergométrica', 'F'],

  // — Alongamento e mobilidade —
  ['stretch', 'Alongamento', 'M'],
  ['circles', 'Circundução', 'F'],
  ['rotation', 'Rotação', 'F'],
  ['internal rotation', 'Rotação interna', 'F'],
  ['external rotation', 'Rotação externa', 'F'],
  ['twist', 'Rotação de tronco', 'F'],
  ['smr', 'Liberação miofascial', 'F'],
  ['pushups', 'Flexão de braço', 'F'],
  ['pushup', 'Flexão de braço', 'F'],
  ['oblique crunches', 'Abdominal oblíquo', 'M'],
  ['swing', 'Swing', 'M'],
  ['swings', 'Swing', 'M'],
  ['muscle up', 'Muscle up', 'M'],
  ['wood chop', 'Lenhador', 'M'],
  ['pistol squat', 'Agachamento pistol', 'M'],
  ['sissy squat', 'Agachamento sissy', 'M'],
  ['zercher squats', 'Agachamento zercher', 'M'],
  ['hack squats', 'Agachamento hack', 'M'],
  ['zottman curl', 'Rosca zottman', 'F'],
  ['windmill', 'Windmill', 'M'],
  ['turkish get up', 'Turkish get-up', 'M'],
  ['snatch pull', 'Puxada de arranco', 'F'],
  ['jackknife', 'Canivete', 'M'],
  ['jackknife sit up', 'Abdominal canivete', 'M'],
  ['wrist rotations', 'Rotação de punho', 'F'],
  ['wrist roller', 'Rolo de punho', 'M'],
  ['plate pinch', 'Pinça com anilha', 'F'],
  ['rope climb', 'Subida na corda', 'F'],
  ['medicine ball slam', 'Arremesso de medicine ball ao solo', 'M'],
  ['pallof press', 'Pallof press', 'M'],
  ['svend press', 'Svend press', 'M'],
  ['tate press', 'Tate press', 'M'],
  ['jm press', 'JM press', 'M'],
  ['neck press', 'Supino pescoço', 'M'],
  ['reverse hyperextension', 'Extensão lombar invertida', 'F'],
  ['leg lift', 'Elevação de pernas', 'F'],
  ['leg tucks', 'Recolhimento de pernas', 'M'],
  ['hip bridge', 'Ponte de quadril', 'F'],
  ['side laterals', 'Elevação lateral', 'F'],
  ['spider crawl', 'Caminhada do aranha', 'F'],
  ['monster walk', 'Monster walk', 'M'],
  ['iron cross', 'Cruz de ferro', 'F'],
  ['wind sprints', 'Tiros de velocidade', 'M'],
  ['speed squats', 'Agachamento de velocidade', 'M'],
];

/**
 * MODIFICADORES — `[inglês, masculino, feminino]`. Quando o termo é invariável
 * (locução adverbial, "unilateral", "frontal"), as duas formas são iguais: a
 * repetição é intencional, deixa a invariabilidade explícita em vez de
 * implícita numa ausência.
 */
const MODIFIER_PHRASES: ReadonlyArray<readonly [string, string, string]> = [
  ['standing', 'em pé', 'em pé'],
  ['seated', 'sentado', 'sentada'],
  ['lying', 'deitado', 'deitada'],
  ['prone', 'em decúbito ventral', 'em decúbito ventral'],
  ['kneeling', 'ajoelhado', 'ajoelhada'],
  ['on knees', 'ajoelhado', 'ajoelhada'],
  ['incline', 'inclinado', 'inclinada'],
  ['decline', 'declinado', 'declinada'],
  ['flat', 'reto', 'reta'],
  ['bent over', 'curvado', 'curvada'],
  ['bent knee', 'joelhos flexionados', 'joelhos flexionados'],
  ['bent arm', 'braços flexionados', 'braços flexionados'],
  ['reverse', 'invertido', 'invertida'],
  ['inverted', 'invertido', 'invertida'],
  ['alternating', 'alternado', 'alternada'],
  ['alternate', 'alternado', 'alternada'],
  ['one arm', 'unilateral', 'unilateral'],
  ['single arm', 'unilateral', 'unilateral'],
  ['one leg', 'unilateral', 'unilateral'],
  ['single leg', 'unilateral', 'unilateral'],
  ['one legged', 'unilateral', 'unilateral'],
  ['two arm', 'bilateral', 'bilateral'],
  ['double', 'duplo', 'dupla'],
  ['close grip', 'pegada fechada', 'pegada fechada'],
  ['wide grip', 'pegada aberta', 'pegada aberta'],
  ['neutral grip', 'pegada neutra', 'pegada neutra'],
  ['hammer grip', 'pegada neutra', 'pegada neutra'],
  ['reverse grip', 'pegada invertida', 'pegada invertida'],
  ['medium grip', 'pegada média', 'pegada média'],
  ['pronated grip', 'pegada pronada', 'pegada pronada'],
  ['underhand', 'pegada supinada', 'pegada supinada'],
  ['overhand', 'pegada pronada', 'pegada pronada'],
  ['palms in', 'palmas voltadas para dentro', 'palmas voltadas para dentro'],
  ['palms up', 'palmas para cima', 'palmas para cima'],
  ['palms down', 'palmas para baixo', 'palmas para baixo'],
  ['overhead', 'acima da cabeça', 'acima da cabeça'],
  ['behind the neck', 'atrás da nuca', 'atrás da nuca'],
  ['behind head', 'atrás da nuca', 'atrás da nuca'],
  ['behind the back', 'por trás do corpo', 'por trás do corpo'],
  ['front', 'frontal', 'frontal'],
  ['side', 'lateral', 'lateral'],
  ['lateral', 'lateral', 'lateral'],
  ['rear', 'posterior', 'posterior'],
  ['backward', 'para trás', 'para trás'],
  ['forward', 'para frente', 'para frente'],
  ['elevated', 'elevado', 'elevada'],
  ['hanging', 'suspenso', 'suspensa'],
  ['weighted', 'com peso', 'com peso'],
  ['assisted', 'assistido', 'assistida'],
  ['suspended', 'suspenso', 'suspensa'],
  ['wide stance', 'base aberta', 'base aberta'],
  ['narrow stance', 'base fechada', 'base fechada'],
  ['sumo', 'sumô', 'sumô'],
  ['walking', 'caminhando', 'caminhando'],
  ['static', 'isométrico', 'isométrica'],
  ['isometric', 'isométrico', 'isométrica'],
  ['dynamic', 'dinâmico', 'dinâmica'],
  ['single', 'unilateral', 'unilateral'],
  ['stationary', 'estacionário', 'estacionária'],
  ['straight arm', 'com braços estendidos', 'com braços estendidos'],
  ['straight legged', 'com pernas estendidas', 'com pernas estendidas'],
  ['stiff legged', 'stiff', 'stiff'],
  ['mixed grip', 'pegada mista', 'pegada mista'],
  ['supinated', 'pegada supinada', 'pegada supinada'],
  ['pronated', 'pegada pronada', 'pegada pronada'],
  ['palms down', 'palmas para baixo', 'palmas para baixo'],
  ['wide', 'pegada aberta', 'pegada aberta'],
  ['close', 'pegada fechada', 'pegada fechada'],
  ['feet elevated', 'com pés elevados', 'com pés elevados'],
  ['speed', 'de velocidade', 'de velocidade'],
  ['weighted ball', 'com bola', 'com bola'],
  ['low', 'baixo', 'baixa'],
  ['high', 'alto', 'alta'],
  ['mid', 'média', 'média'],

  // PARTES DO CORPO como complemento nominal ("de X"). Existem sobretudo para
  // alongamento e liberação miofascial, onde o nome é `<parte> Stretch` /
  // `<parte>-SMR`: sem elas, "Chest Stretch" e "Calves-SMR" ficariam sem
  // tradução apesar de o núcleo ser conhecido. Invariáveis — o gênero de "de
  // peito" não depende do movimento.
  ['chest', 'de peito', 'de peito'],
  ['back', 'de costas', 'de costas'],
  ['lower back', 'de lombar', 'de lombar'],
  ['upper back', 'de dorsal', 'de dorsal'],
  ['middle back', 'de dorsal', 'de dorsal'],
  ['lat', 'de dorsal', 'de dorsal'],
  ['lats', 'de dorsal', 'de dorsal'],
  ['hamstring', 'de posterior de coxa', 'de posterior de coxa'],
  ['hamstrings', 'de posterior de coxa', 'de posterior de coxa'],
  ['quad', 'de quadríceps', 'de quadríceps'],
  ['quads', 'de quadríceps', 'de quadríceps'],
  ['quadriceps', 'de quadríceps', 'de quadríceps'],
  ['glute', 'de glúteo', 'de glúteo'],
  ['glutes', 'de glúteo', 'de glúteo'],
  ['groin', 'de adutores', 'de adutores'],
  ['adductor', 'de adutores', 'de adutores'],
  ['abductor', 'de abdutores', 'de abdutores'],
  ['calf', 'de panturrilha', 'de panturrilha'],
  ['calves', 'de panturrilha', 'de panturrilha'],
  ['neck', 'de pescoço', 'de pescoço'],
  ['shoulder', 'de ombro', 'de ombro'],
  ['shoulders', 'de ombro', 'de ombro'],
  ['hip flexor', 'de flexores de quadril', 'de flexores de quadril'],
  ['hip', 'de quadril', 'de quadril'],
  ['tricep', 'de tríceps', 'de tríceps'],
  ['triceps', 'de tríceps', 'de tríceps'],
  ['bicep', 'de bíceps', 'de bíceps'],
  ['biceps', 'de bíceps', 'de bíceps'],
  ['forearm', 'de antebraço', 'de antebraço'],
  ['forearms', 'de antebraço', 'de antebraço'],
  ['ankle', 'de tornozelo', 'de tornozelo'],
  ['wrist', 'de punho', 'de punho'],
  ['knee', 'de joelho', 'de joelho'],
  ['abdominal', 'de abdômen', 'de abdômen'],
  ['abdominals', 'de abdômen', 'de abdômen'],
  ['trap', 'de trapézio', 'de trapézio'],
  ['traps', 'de trapézio', 'de trapézio'],
  ['it band', 'da banda iliotibial', 'da banda iliotibial'],
  ['iliotibial tract', 'da banda iliotibial', 'da banda iliotibial'],
  ['anterior tibialis', 'de tibial anterior', 'de tibial anterior'],
  ['brachialis', 'de braquial', 'de braquial'],
  ['piriformis', 'de piriforme', 'de piriforme'],
  ['peroneals', 'de fibulares', 'de fibulares'],
  ['adductors', 'de adutores', 'de adutores'],
  ['upper body', 'de tronco', 'de tronco'],
  ['full body', 'de corpo inteiro', 'de corpo inteiro'],
  ['foot', 'de pé', 'de pé'],
  ['spine', 'de coluna', 'de coluna'],
];

/** EQUIPAMENTO: vira sufixo preposicionado ("com barra", "na polia"). */
const EQUIPMENT_PHRASES: ReadonlyArray<readonly [string, string]> = [
  ['barbell', 'com barra'],
  ['dumbbell', 'com halteres'],
  ['dumbbells', 'com halteres'],
  ['db', 'com halteres'],
  ['two dumbbell', 'com halteres'],
  ['cable', 'na polia'],
  ['cables', 'na polia'],
  ['low pulley', 'na polia baixa'],
  ['high pulley', 'na polia alta'],
  ['high cable', 'na polia alta'],
  ['pulley', 'na polia'],
  ['machine', 'na máquina'],
  ['smith machine', 'no Smith'],
  ['smith', 'no Smith'],
  ['kettlebell', 'com kettlebell'],
  ['kettlebells', 'com kettlebell'],
  ['band', 'com elástico'],
  ['bands', 'com elástico'],
  ['ez bar', 'com barra W'],
  ['ez curl bar', 'com barra W'],
  ['e z bar', 'com barra W'],
  ['bodyweight', 'com peso corporal'],
  ['body weight', 'com peso corporal'],
  ['freehand', 'sem carga'],
  ['stability ball', 'na bola suíça'],
  ['exercise ball', 'na bola suíça'],
  ['swiss ball', 'na bola suíça'],
  ['ball', 'na bola'],
  ['bosu ball', 'no bosu'],
  ['medicine ball', 'com medicine ball'],
  ['chains', 'com correntes'],
  ['rope', 'na corda'],
  ['rope attachment', 'com corda'],
  ['straps', 'com fitas'],
  ['plate', 'com anilha'],
  ['sled', 'no trenó'],
  ['treadmill', 'na esteira'],
  ['elliptical', 'no elíptico'],
  ['on bench', 'no banco'],
  ['bench', 'no banco'],
  ['on the floor', 'no chão'],
  ['floor', 'no chão'],
  ['wall', 'na parede'],
  ['box', 'no caixote'],
  ['chair', 'na cadeira'],
  ['leverage', 'na máquina articulada'],
  ['parallel bars', 'nas paralelas'],
  ['parallel bar', 'nas paralelas'],
  ['rings', 'nas argolas'],
  ['ring', 'nas argolas'],
  ['trap bar', 'com barra hexagonal'],
  ['t bar', 'na barra T'],
  ['long bar', 'na barra longa'],
  ['physioball', 'na bola suíça'],
  ['towel', 'com toalha'],
  ['platform', 'na plataforma'],
  ['head harness', 'com cinta de cabeça'],
];

function buildCores(): Phrase[] {
  return CORE_PHRASES.map(([en, pt, gender]) => ({
    en,
    pt,
    role: 'CORE' as const,
    gender,
  }));
}

function buildModifiers(): Phrase[] {
  return MODIFIER_PHRASES.map(([en, pt, ptFeminine]) => ({
    en,
    pt,
    ptFeminine,
    role: 'MODIFIER' as const,
  }));
}

function buildEquipment(): Phrase[] {
  return EQUIPMENT_PHRASES.map(([en, pt]) => ({
    en,
    pt,
    role: 'EQUIPMENT' as const,
  }));
}

/**
 * Todas as frases, ORDENADAS DA MAIS LONGA PARA A MAIS CURTA (em número de
 * palavras). A ordem é o que garante que "bench press" ganhe de "bench" e
 * "press", e que "lat pulldown" ganhe de "pulldown" — casar a frase curta
 * primeiro produziria "Supino no banco" no lugar de "Supino".
 */
export const TRANSLATION_PHRASES: ReadonlyArray<Phrase> = [
  ...buildCores(),
  ...buildModifiers(),
  ...buildEquipment(),
].sort((a, b) => b.en.split(' ').length - a.en.split(' ').length);
